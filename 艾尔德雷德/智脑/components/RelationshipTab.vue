<script setup lang="ts">
import { useMainStore } from '../stores/mainStore';
import type { RelationshipProfile } from '../stores/mainStore';
import {
  USER_NODE_ID,
  buildRelationshipCandidates,
  executeRelationshipAnalysis,
  makeRelationshipId,
  scanWorldbookForRelationships,
  type RelationshipCandidate,
  type RelationshipWorldbookMatch,
} from '../core/relationshipAnalysis';

const store = useMainStore();

const selectedNames = ref<string[]>([]);
const includeAllSelectedPairs = ref(false);
const isScanningWorldbook = ref(false);
const worldbookMatches = ref<RelationshipWorldbookMatch[]>([]);
const mobileTab = ref<'sidebar' | 'graph' | 'detail'>('graph');

// 分析状态持久化到 store，切 tab 不丢失
const isAnalyzing = computed(() => store.relAnalyzing);
const analysisStatus = computed(() => store.relStatus);
const analysisError = computed(() => store.relError);
const selectedNodeId = computed({
  get: () => store.relSelectedNodeId,
  set: (v) => { store.relSelectedNodeId = v; },
});
const selectedEdgeId = computed({
  get: () => store.relSelectedEdgeId,
  set: (v) => { store.relSelectedEdgeId = v; },
});

const graphW = 1000;
const graphH = 562;
const center = { x: graphW / 2, y: graphH / 2 };
const zoom = ref(1);
const pan = reactive({ x: 0, y: 0 });
const activePointers = new Map<number, { x: number; y: number }>();
let dragStart: { x: number; y: number; panX: number; panY: number } | null = null;
let pinchStart: { dist: number; zoom: number; cx: number; cy: number; panX: number; panY: number } | null = null;

const latestSummary = computed(() => store.getLatestSummary());

const allCharacters = computed(() => {
  const names = new Set<string>();
  const summary = latestSummary.value;
  if (summary) {
    for (const mem of summary.characterMemories) names.add(mem.characterName);
  }
  for (const profile of store.dynamicProfiles) names.add(profile.characterName);
  for (const profile of store.relationshipProfiles) {
    if (profile.from !== USER_NODE_ID) names.add(profile.from);
    if (profile.to !== USER_NODE_ID) names.add(profile.to);
  }
  return [...names];
});

watch(allCharacters, names => {
  if (selectedNames.value.length === 0 && names.length > 0) {
    selectedNames.value = [...names];
  } else {
    selectedNames.value = selectedNames.value.filter(name => names.includes(name));
  }
}, { immediate: true });

const selectedSet = computed(() => new Set(selectedNames.value));
const relationshipById = computed(() => new Map(store.relationshipProfiles.map(profile => [profile.id, profile])));

const inferredCandidates = computed(() =>
  buildRelationshipCandidates(
    latestSummary.value,
    store.dynamicProfiles,
    store.getFusedMemories,
    allCharacters.value,
    false,
    store.getUserName(),
  ),
);

const selectedCandidates = computed(() =>
  buildRelationshipCandidates(
    latestSummary.value,
    store.dynamicProfiles,
    store.getFusedMemories,
    selectedNames.value,
    includeAllSelectedPairs.value,
    store.getUserName(),
  ),
);

const displayEdges = computed(() => {
  const byId = new Map<string, RelationshipCandidate & { analyzed?: RelationshipProfile }>();
  for (const candidate of inferredCandidates.value) {
    byId.set(candidate.id, { ...candidate, analyzed: relationshipById.value.get(candidate.id) });
  }
  for (const profile of store.relationshipProfiles) {
    if (profile.from === USER_NODE_ID || profile.to === USER_NODE_ID || allCharacters.value.includes(profile.from) || allCharacters.value.includes(profile.to)) {
      if (!byId.has(profile.id)) {
        byId.set(profile.id, {
          id: profile.id,
          from: profile.from,
          to: profile.to,
          fromName: profile.fromName,
          toName: profile.toName,
          kind: profile.kind,
          strength: 3,
          reasons: ['已分析关系档案'],
          memoryHits: [],
          sharedEvents: [],
          analyzed: profile,
        });
      } else {
        const existing = byId.get(profile.id)!;
        byId.set(profile.id, { ...existing, analyzed: profile });
      }
    }
  }
  return [...byId.values()];
});

const inferredConnectedNames = computed(() => {
  const names = new Set<string>();
  for (const edge of inferredCandidates.value) {
    if (edge.kind !== 'character-character') continue;
    if (edge.from !== USER_NODE_ID) names.add(edge.from);
    if (edge.to !== USER_NODE_ID) names.add(edge.to);
  }
  return names;
});

const worldbookMap = computed(() => new Map(worldbookMatches.value.map(match => [match.characterName, match])));

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
  kind: 'user' | 'character';
  selected: boolean;
  analyzed: boolean;
  worldbookFound: boolean | null;
}

const graphNodes = computed<GraphNode[]>(() => {
  const nodes: GraphNode[] = [{
    id: USER_NODE_ID,
    label: store.getUserName() || '{{user}}',
    x: center.x,
    y: center.y,
    kind: 'user',
    selected: true,
    analyzed: true,
    worldbookFound: null,
  }];

  const components = buildComponents(allCharacters.value, displayEdges.value);
  const total = Math.max(components.length, 1);
  components.forEach((component, compIdx) => {
    const sectorStart = -Math.PI / 2 + (Math.PI * 2 * compIdx) / total;
    const sectorWidth = Math.PI * 2 / total;
    component.forEach((name, idx) => {
      const localCount = Math.max(component.length, 1);
      const angle = sectorStart + sectorWidth * ((idx + 0.5) / localCount);
      const ring = component.length <= 3 ? 190 : (idx % 2 === 0 ? 205 : 265);
      const profileAnalyzed = store.relationshipProfiles.some(profile => profile.from === name || profile.to === name);
      nodes.push({
        id: name,
        label: name,
        x: center.x + Math.cos(angle) * ring,
        y: center.y + Math.sin(angle) * ring,
        kind: 'character',
        selected: selectedSet.value.has(name),
        analyzed: profileAnalyzed,
        worldbookFound: worldbookMap.value.get(name)?.found ?? null,
      });
    });
  });

  return nodes;
});

const graphNodeMap = computed(() => new Map(graphNodes.value.map(node => [node.id, node])));

const selectedNode = computed(() => graphNodes.value.find(node => node.id === selectedNodeId.value));
const selectedEdge = computed(() => displayEdges.value.find(edge => edge.id === selectedEdgeId.value));
const selectedRelationship = computed(() => selectedEdge.value?.analyzed || (selectedEdgeId.value ? relationshipById.value.get(selectedEdgeId.value) : undefined));

const analysisCountText = computed(() => {
  const count = selectedCandidates.value.length;
  const selectedCount = selectedNames.value.length;
  return `${selectedCount} 个角色，${count} 条关系`;
});

function buildComponents(names: string[], edges: Array<{ from: string; to: string }>): string[][] {
  const graph = new Map<string, Set<string>>();
  for (const name of names) graph.set(name, new Set());
  for (const edge of edges) {
    if (edge.from === USER_NODE_ID || edge.to === USER_NODE_ID) continue;
    if (!graph.has(edge.from) || !graph.has(edge.to)) continue;
    graph.get(edge.from)!.add(edge.to);
    graph.get(edge.to)!.add(edge.from);
  }
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const name of names) {
    if (visited.has(name)) continue;
    const queue = [name];
    const component: string[] = [];
    visited.add(name);
    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);
      for (const next of graph.get(current) || []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    components.push(component);
  }
  return components.sort((a, b) => b.length - a.length);
}

function selectAll() {
  selectedNames.value = [...allCharacters.value];
}

function clearSelected() {
  selectedNames.value = [];
}

function toggleName(name: string) {
  if (selectedSet.value.has(name)) {
    selectedNames.value = selectedNames.value.filter(item => item !== name);
  } else {
    selectedNames.value = [...selectedNames.value, name];
  }
}

async function selectWorldbookCharacters() {
  isScanningWorldbook.value = true;
  store.relError = '';
  try {
    worldbookMatches.value = await scanWorldbookForRelationships(latestSummary.value, allCharacters.value);
    selectedNames.value = worldbookMatches.value.filter(match => match.found).map(match => match.characterName);
  } catch (error: any) {
    store.relError = error?.message || String(error);
  } finally {
    isScanningWorldbook.value = false;
  }
}

function selectInferredCharacters() {
  selectedNames.value = [...inferredConnectedNames.value];
}

function resetView() {
  zoom.value = 1;
  pan.x = 0;
  pan.y = 0;
}

function graphTransform() {
  return `translate(${pan.x} ${pan.y}) scale(${zoom.value})`;
}

function edgePath(edge: RelationshipCandidate) {
  const from = graphNodeMap.value.get(edge.from);
  const to = graphNodeMap.value.get(edge.to);
  if (!from || !to) return '';
  const midX = (from.x + to.x) / 2;
  const midY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const curve = edge.kind === 'user-character' ? 0 : 34;
  const cx = midX - (dy / len) * curve;
  const cy = midY + (dx / len) * curve;
  return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
}

function edgeClass(edge: RelationshipCandidate & { analyzed?: RelationshipProfile }) {
  return {
    analyzed: !!edge.analyzed,
    inferred: !edge.analyzed,
    active: selectedEdgeId.value === edge.id || selectedNodeId.value === edge.from || selectedNodeId.value === edge.to,
    muted: selectedNodeId.value !== USER_NODE_ID && selectedNodeId.value !== edge.from && selectedNodeId.value !== edge.to && selectedEdgeId.value !== edge.id,
  };
}

function selectNode(nodeId: string) {
  selectedNodeId.value = nodeId;
  selectedEdgeId.value = '';
  mobileTab.value = 'detail';
}

function selectEdge(edgeId: string) {
  selectedEdgeId.value = edgeId;
  selectedNodeId.value = '';
  mobileTab.value = 'detail';
}

function edgeStrokeWidth(edge: RelationshipCandidate & { analyzed?: RelationshipProfile }) {
  return edge.analyzed ? 2.6 + Math.min(edge.strength, 4) * 0.35 : 1.4 + Math.min(edge.strength, 4) * 0.25;
}

function pointerDistance() {
  const points = [...activePointers.values()];
  if (points.length < 2) return 0;
  const dx = points[0].x - points[1].x;
  const dy = points[0].y - points[1].y;
  return Math.sqrt(dx * dx + dy * dy);
}

function pointerCenter() {
  const points = [...activePointers.values()];
  return {
    x: (points[0].x + points[1].x) / 2,
    y: (points[0].y + points[1].y) / 2,
  };
}

function onWheel(e: WheelEvent) {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const mx = e.clientX - rect.left;  // 鼠标在视口内的坐标
  const my = e.clientY - rect.top;
  const oldZoom = zoom.value;
  const next = _.clamp(oldZoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.45, 2.4);
  const scale = next / oldZoom;
  // 中心缩放：保持鼠标下的点不动
  zoom.value = next;
  pan.x = mx - scale * (mx - pan.x);
  pan.y = my - scale * (my - pan.y);
}

function onPointerDown(e: PointerEvent) {
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size >= 2) {
    const c = pointerCenter();
    pinchStart = { dist: pointerDistance(), zoom: zoom.value, cx: c.x, cy: c.y, panX: pan.x, panY: pan.y };
    dragStart = null;
    return;
  }
  dragStart = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
}

function onPointerMove(e: PointerEvent) {
  if (!activePointers.has(e.pointerId)) return;
  activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (activePointers.size >= 2 && pinchStart) {
    const c = pointerCenter();
    const ratio = pointerDistance() / Math.max(1, pinchStart.dist);
    const newZoom = _.clamp(pinchStart.zoom * ratio, 0.45, 2.4);
    const scale = newZoom / pinchStart.zoom;
    // 中心缩放(保持双指中心不动) + 跟随手指移动
    zoom.value = newZoom;
    pan.x = pinchStart.cx - scale * (pinchStart.cx - pinchStart.panX) + (c.x - pinchStart.cx) / newZoom;
    pan.y = pinchStart.cy - scale * (pinchStart.cy - pinchStart.panY) + (c.y - pinchStart.cy) / newZoom;
    return;
  }
  if (!dragStart) return;
  // 拖拽速度 ×1.8：跟踪光标但更快
  pan.x = dragStart.panX + (e.clientX - dragStart.x) / zoom.value * 1.8;
  pan.y = dragStart.panY + (e.clientY - dragStart.y) / zoom.value * 1.8;
}

function onPointerUp(e: PointerEvent) {
  activePointers.delete(e.pointerId);
  if (activePointers.size < 2) pinchStart = null;
  if (activePointers.size === 0) dragStart = null;
}

async function runAnalysis() {
  store.relError = '';
  store.relStatus = '';
  if (!latestSummary.value) {
    store.relError = '没有大总结，无法分析关系';
    return;
  }
  if (selectedNames.value.length === 0) {
    store.relError = '请先选择至少一个角色';
    return;
  }
  const candidates = selectedCandidates.value;
  if (candidates.length === 0) {
    store.relError = '选中角色之间没有可分析的候选关系';
    return;
  }
  const ok = confirm(`将分析 ${analysisCountText.value}。\n\n只生成关系档案，不修改记忆、大总结或世界书。`);
  if (!ok) return;

  store.relAnalyzing = true;
  try {
    store.relStatus = `正在分析 ${analysisCountText.value}...`;
    const result = await executeRelationshipAnalysis({
      latestSummary: latestSummary.value,
      dynamicProfiles: store.dynamicProfiles,
      candidates,
      getFusedMemories: store.getFusedMemories,
      userName: store.getUserName(),
    });
    worldbookMatches.value = result.worldbookMatches;
    store.updateRelationshipProfiles(result.profiles);
    store.relStatus = `已生成 ${result.profiles.length} 条关系档案`;
    if (result.profiles.length > 0) {
      selectedEdgeId.value = result.profiles[0].id;
      selectedNodeId.value = '';
    }
  } catch (error: any) {
    store.relError = error?.message || String(error);
  } finally {
    store.relAnalyzing = false;
  }
}
</script>

<template>
  <div class="zhino-relationship">
    <div class="zhino-rel-toolbar">
      <div class="zhino-rel-title">
        <span>关系网</span>
        <span class="zhino-rel-sub">{{ analysisCountText }}</span>
      </div>
      <div class="zhino-rel-actions">
        <button class="zhino-btn-sm" @click="selectAll">全选</button>
        <button class="zhino-btn-sm" @click="clearSelected">全部取消</button>
        <button class="zhino-btn-sm" :disabled="isScanningWorldbook" @click="selectWorldbookCharacters">
          {{ isScanningWorldbook ? '扫描中...' : '只选世界书角色' }}
        </button>
        <button class="zhino-btn-sm" @click="selectInferredCharacters">只选推断线角色</button>
        <button class="zhino-btn-sm" @click="resetView">重置视角</button>
      </div>
    </div>

    <div class="zhino-rel-hint">
      虚线是记忆推断，实线是已分析关系。关系分析只生成档案，不修改记忆、大总结或世界书。
    </div>

    <div class="zhino-rel-mobile-tabs">
      <button :class="{ active: mobileTab === 'sidebar' }" @click="mobileTab = 'sidebar'">角色</button>
      <button :class="{ active: mobileTab === 'graph' }" @click="mobileTab = 'graph'">关系图</button>
      <button :class="{ active: mobileTab === 'detail' }" @click="mobileTab = 'detail'">详情</button>
    </div>

    <div class="zhino-rel-main">
      <aside class="zhino-rel-sidebar" :class="{ active: mobileTab === 'sidebar' }">
        <div class="zhino-rel-section-title">选择角色</div>
        <div v-if="allCharacters.length === 0" class="zhino-empty-hint">暂无角色数据</div>
        <div v-else class="zhino-rel-select-list">
          <button
            v-for="name in allCharacters"
            :key="name"
            class="zhino-rel-select-item"
            :class="{ active: selectedSet.has(name), inferred: inferredConnectedNames.has(name) }"
            @click="toggleName(name)"
          >
            <span class="zhino-rel-check">{{ selectedSet.has(name) ? '✓' : '' }}</span>
            <span class="zhino-rel-name">{{ name }}</span>
            <span v-if="worldbookMap.get(name)?.found" class="zhino-rel-wb">世</span>
          </button>
        </div>

        <label class="zhino-rel-toggle">
          <input v-model="includeAllSelectedPairs" type="checkbox">
          <span>分析选中角色之间的全部组合</span>
        </label>

        <button class="zhino-rel-analyze" :disabled="isAnalyzing || selectedCandidates.length === 0" @click="runAnalysis">
          {{ isAnalyzing ? '分析中...' : '分析选中角色' }}
        </button>
        <div v-if="analysisStatus" class="zhino-rel-status">{{ analysisStatus }}</div>
        <div v-if="analysisError" class="zhino-rel-error">{{ analysisError }}</div>
      </aside>

      <div
        class="zhino-rel-graph-wrap"
        :class="{ active: mobileTab === 'graph' }"
        @wheel.prevent="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <svg class="zhino-rel-svg" :viewBox="`0 0 ${graphW} ${graphH}`">
          <defs>
            <filter id="rel-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <g :transform="graphTransform()">
            <path class="zhino-rel-center-ring" :d="`M ${center.x - 170} ${center.y} a 170 170 0 1 0 340 0 a 170 170 0 1 0 -340 0`" />
            <path class="zhino-rel-outer-ring" :d="`M ${center.x - 265} ${center.y} a 265 265 0 1 0 530 0 a 265 265 0 1 0 -530 0`" />

            <path
              v-for="edge in displayEdges"
              :key="edge.id"
              class="zhino-rel-edge-hit"
              :d="edgePath(edge)"
              @click.stop="selectEdge(edge.id)"
            />
            <path
              v-for="edge in displayEdges"
              :key="'line-' + edge.id"
              class="zhino-rel-edge"
              :class="edgeClass(edge)"
              :d="edgePath(edge)"
              :stroke-width="edgeStrokeWidth(edge)"
            />

            <g
              v-for="node in graphNodes"
              :key="node.id"
              class="zhino-rel-node"
              :class="{ user: node.kind === 'user', selected: node.selected, active: selectedNodeId === node.id, analyzed: node.analyzed }"
              :transform="`translate(${node.x} ${node.y})`"
              @click.stop="selectNode(node.id)"
            >
              <rect :x="node.kind === 'user' ? -62 : -54" y="-18" :width="node.kind === 'user' ? 124 : 108" height="36" rx="6" />
              <text text-anchor="middle" dominant-baseline="central">{{ node.label }}</text>
              <circle v-if="node.worldbookFound === true" cx="48" cy="-15" r="5" class="zhino-rel-node-wb" />
            </g>
          </g>
        </svg>
      </div>

      <aside class="zhino-rel-detail" :class="{ active: mobileTab === 'detail' }">
        <template v-if="selectedRelationship">
          <div class="zhino-rel-section-title">{{ selectedRelationship.fromName }} 与 {{ selectedRelationship.toName }}</div>
          <div class="zhino-rel-detail-chip">{{ selectedRelationship.relationType }}</div>
          <div class="zhino-rel-detail-block">
            <span>关系怎么来的</span>
            <p>{{ selectedRelationship.origin || '证据不足' }}</p>
          </div>
          <div class="zhino-rel-detail-block">
            <span>当前状态</span>
            <p>{{ selectedRelationship.currentState || '待观察' }}</p>
          </div>
          <div class="zhino-rel-detail-block">
            <span>关系张力</span>
            <p>{{ selectedRelationship.tension || '无明显张力' }}</p>
          </div>
          <div class="zhino-rel-detail-block">
            <span>禁止误读</span>
            <ul>
              <li v-for="(item, idx) in selectedRelationship.misreadWarnings" :key="idx">{{ item }}</li>
            </ul>
          </div>
          <div class="zhino-rel-detail-meta">
            <span>可信度：{{ selectedRelationship.confidence }}</span>
            <span>v{{ selectedRelationship.basedOnSummaryVersion }}</span>
          </div>
        </template>
        <template v-else-if="selectedEdge">
          <div class="zhino-rel-section-title">{{ selectedEdge.fromName }} 与 {{ selectedEdge.toName }}</div>
          <div class="zhino-rel-detail-chip inferred">推断关系</div>
          <div class="zhino-rel-detail-block">
            <span>推断来源</span>
            <p>{{ selectedEdge.reasons.join('；') }}</p>
          </div>
          <div class="zhino-rel-detail-block">
            <span>命中的记忆</span>
            <ul>
              <li v-for="(hit, idx) in selectedEdge.memoryHits.slice(0, 5)" :key="idx">{{ hit.owner }}：{{ hit.text }}</li>
            </ul>
          </div>
        </template>
        <template v-else-if="selectedNode">
          <div class="zhino-rel-section-title">{{ selectedNode.label }}</div>
          <div class="zhino-rel-detail-chip" :class="{ inferred: selectedNode.kind !== 'user' && !selectedNode.analyzed }">
            {{ selectedNode.kind === 'user' ? '中心节点' : selectedNode.analyzed ? '已有关系档案' : '待分析' }}
          </div>
          <div v-if="selectedNode.kind !== 'user'" class="zhino-rel-detail-block">
            <span>世界书</span>
            <p>{{ selectedNode.worldbookFound === null ? '尚未扫描' : selectedNode.worldbookFound ? '已命中世界书条目' : '未命中，按普通NPC处理' }}</p>
          </div>
          <div class="zhino-rel-detail-block">
            <span>关联关系（点击查看详情）</span>
            <ul class="zhino-rel-edge-list">
              <li
                v-for="edge in displayEdges.filter(e => e.from === selectedNode?.id || e.to === selectedNode?.id).slice(0, 8)"
                :key="edge.id"
                class="zhino-rel-edge-item"
                :class="{ analyzed: edge.analyzed }"
                @click="selectEdge(edge.id)"
              >
                <span class="zhino-rel-edge-names">{{ edge.fromName }} ↔ {{ edge.toName }}</span>
                <span class="zhino-rel-edge-tag">{{ edge.analyzed ? '已分析' : '推断' }}</span>
              </li>
            </ul>
          </div>
        </template>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.zhino-relationship {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.zhino-rel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.zhino-rel-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: rgba(255, 255, 255, 0.86);
  font-size: 14px;
  font-weight: 700;
}

.zhino-rel-sub {
  color: rgba(255, 255, 255, 0.38);
  font-size: 11px;
  font-weight: 400;
}

.zhino-rel-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.zhino-rel-hint {
  border: 1px solid rgba(248, 113, 113, 0.18);
  border-radius: 6px;
  background: rgba(248, 113, 113, 0.06);
  padding: 6px 9px;
  color: rgba(255, 255, 255, 0.58);
  font-size: 11px;
}

.zhino-rel-main {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr) 230px;
  gap: 10px;
}

.zhino-rel-sidebar,
.zhino-rel-detail {
  min-height: 0;
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.025);
  padding: 10px;
}

.zhino-rel-section-title {
  margin-bottom: 8px;
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
  font-weight: 700;
}

.zhino-rel-select-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.zhino-rel-select-item {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.035);
  color: rgba(255, 255, 255, 0.64);
  cursor: pointer;
  font-size: 12px;
  text-align: left;
}

.zhino-rel-select-item.active {
  border-color: rgba(248, 113, 113, 0.32);
  background: rgba(248, 113, 113, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

.zhino-rel-select-item.inferred:not(.active) {
  border-color: rgba(248, 113, 113, 0.14);
}

.zhino-rel-check {
  width: 18px;
  color: rgba(248, 113, 113, 0.9);
  text-align: center;
  flex-shrink: 0;
}

.zhino-rel-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.zhino-rel-wb {
  margin-left: auto;
  border: 1px solid rgba(96, 165, 250, 0.35);
  border-radius: 4px;
  padding: 0 3px;
  color: rgba(147, 197, 253, 0.9);
  font-size: 10px;
}

.zhino-rel-toggle {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 10px;
  color: rgba(255, 255, 255, 0.56);
  font-size: 11px;
  line-height: 1.4;
}

.zhino-rel-analyze {
  width: 100%;
  margin-top: 10px;
  border: 1px solid rgba(248, 113, 113, 0.35);
  border-radius: 6px;
  background: rgba(248, 113, 113, 0.12);
  color: rgba(254, 202, 202, 0.95);
  cursor: pointer;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 700;
}

.zhino-rel-analyze:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zhino-rel-status,
.zhino-rel-error {
  margin-top: 7px;
  font-size: 11px;
  line-height: 1.45;
}

.zhino-rel-status {
  color: rgba(167, 139, 250, 0.85);
}

.zhino-rel-error {
  color: rgba(248, 113, 113, 0.9);
}

.zhino-rel-graph-wrap {
  min-height: 0;
  border: 1px solid rgba(248, 113, 113, 0.14);
  border-radius: 8px;
  background:
    linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
    #060810;
  background-size: 28px 28px;
  overflow: hidden;
  cursor: grab;
  touch-action: none;
}

.zhino-rel-graph-wrap:active {
  cursor: grabbing;
}

.zhino-rel-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.zhino-rel-center-ring,
.zhino-rel-outer-ring {
  fill: none;
  stroke: rgba(255, 255, 255, 0.05);
  stroke-width: 1;
}

.zhino-rel-edge-hit {
  fill: none;
  stroke: transparent;
  stroke-width: 14;
  cursor: pointer;
}

.zhino-rel-edge {
  fill: none;
  stroke: rgba(248, 113, 113, 0.45);
  transition: opacity 0.15s, stroke 0.15s;
  pointer-events: none;
}

.zhino-rel-edge.inferred {
  stroke-dasharray: 7 8;
  opacity: 0.46;
}

.zhino-rel-edge.analyzed {
  stroke: rgba(239, 68, 68, 0.86);
  filter: url(#rel-glow);
  opacity: 0.9;
}

.zhino-rel-edge.active {
  stroke: rgba(254, 202, 202, 1);
  opacity: 1;
}

.zhino-rel-edge.muted {
  opacity: 0.12;
}

.zhino-rel-node {
  cursor: pointer;
}

.zhino-rel-node rect {
  fill: rgba(14, 17, 28, 0.96);
  stroke: rgba(255, 255, 255, 0.14);
  stroke-width: 1;
  transition: fill 0.15s, stroke 0.15s;
}

.zhino-rel-node text {
  fill: rgba(255, 255, 255, 0.78);
  font-size: 13px;
  font-weight: 600;
  pointer-events: none;
}

.zhino-rel-node.user rect {
  fill: rgba(127, 29, 29, 0.9);
  stroke: rgba(254, 202, 202, 0.75);
}

.zhino-rel-node.user text {
  fill: rgba(255, 255, 255, 0.96);
}

.zhino-rel-node.selected rect {
  stroke: rgba(248, 113, 113, 0.65);
}

.zhino-rel-node.active rect,
.zhino-rel-node.analyzed.active rect {
  fill: rgba(127, 29, 29, 0.86);
  stroke: rgba(254, 202, 202, 0.9);
}

.zhino-rel-node.analyzed rect {
  stroke: rgba(239, 68, 68, 0.72);
}

.zhino-rel-node-wb {
  fill: rgba(96, 165, 250, 0.95);
}

.zhino-rel-detail-chip {
  display: inline-flex;
  max-width: 100%;
  margin-bottom: 10px;
  border: 1px solid rgba(248, 113, 113, 0.28);
  border-radius: 999px;
  background: rgba(248, 113, 113, 0.1);
  padding: 2px 8px;
  color: rgba(254, 202, 202, 0.92);
  font-size: 11px;
}

.zhino-rel-detail-chip.inferred {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.56);
}

.zhino-rel-detail-block {
  margin-bottom: 10px;
}

.zhino-rel-detail-block span {
  display: block;
  margin-bottom: 4px;
  color: rgba(255, 255, 255, 0.38);
  font-size: 11px;
}

.zhino-rel-detail-block p,
.zhino-rel-detail-block li {
  color: rgba(255, 255, 255, 0.72);
  font-size: 12px;
  line-height: 1.55;
}

.zhino-rel-detail-block p {
  margin: 0;
}

.zhino-rel-detail-block ul {
  margin: 0;
  padding-left: 16px;
}

.zhino-rel-edge-list {
  list-style: none;
  padding: 0 !important;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.zhino-rel-edge-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.zhino-rel-edge-item:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.14);
}

.zhino-rel-edge-item.analyzed {
  border-color: rgba(100, 180, 255, 0.2);
  background: rgba(100, 180, 255, 0.06);
}

.zhino-rel-edge-item.analyzed:hover {
  background: rgba(100, 180, 255, 0.12);
}

.zhino-rel-edge-names {
  color: rgba(255, 255, 255, 0.82);
  font-size: 13px;
}

.zhino-rel-edge-tag {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.5);
}

.zhino-rel-edge-item.analyzed .zhino-rel-edge-tag {
  background: rgba(100, 180, 255, 0.15);
  color: rgba(130, 200, 255, 0.85);
}

.zhino-rel-detail-meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  padding-top: 8px;
  color: rgba(255, 255, 255, 0.36);
  font-size: 11px;
}

.zhino-btn-sm {
  padding: 4px 10px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.62);
  cursor: pointer;
  font-size: 11px;
  transition: all 0.15s;
}

.zhino-btn-sm:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.9);
}

.zhino-btn-sm:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.zhino-empty-hint {
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
}

/* 移动端底部标签栏 */
.zhino-rel-mobile-tabs {
  display: none;
  gap: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.zhino-rel-mobile-tabs button {
  flex: 1;
  padding: 8px 0;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  color: rgba(255, 255, 255, 0.45);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
}
.zhino-rel-mobile-tabs button.active {
  color: rgba(255, 255, 255, 0.9);
  border-bottom-color: rgba(200, 180, 255, 0.7);
}

@media (max-width: 768px) {
  .zhino-rel-mobile-tabs {
    display: flex;
  }
  .zhino-rel-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .zhino-rel-main {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr;
  }

  .zhino-rel-sidebar,
  .zhino-rel-graph-wrap,
  .zhino-rel-detail {
    display: none;
    max-height: none;
  }
  .zhino-rel-sidebar.active,
  .zhino-rel-graph-wrap.active,
  .zhino-rel-detail.active {
    display: block;
  }
}
</style>
