import { useEffect, useState } from 'react';
import { Download, RefreshCcw, ScrollText } from 'lucide-react';
import {
  DedicatedInstallResult,
  DedicatedResourceStatus,
  ELDRED_DEDICATED_PRESET_NAME,
  ELDRED_DEDICATED_WORLDBOOK_NAME,
  getDedicatedResourceStatus,
  installDedicatedResources,
} from '../../game/dedicatedResources';

const readStatus = (): DedicatedResourceStatus => {
  try {
    return getDedicatedResourceStatus();
  } catch {
    return {
      presetImported: false,
      presetLoaded: false,
      worldbookImported: false,
      worldbookEnabled: false,
    };
  }
};

export function SystemPanel() {
  const [status, setStatus] = useState<DedicatedResourceStatus>(() => readStatus());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<DedicatedInstallResult | null>(null);

  const refresh = () => setStatus(readStatus());

  useEffect(() => {
    refresh();
  }, []);

  const install = async () => {
    setBusy(true);
    setMessage('导入中');
    setResult(null);
    try {
      const nextResult = await installDedicatedResources();
      setResult(nextResult);
      setMessage('导入完成');
      refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto p-2 md:p-0">
      <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-[16rem_1fr]">
        <div className="pixel-vertical-card w-full min-h-[18rem]">
          <div className="pixel-card-crown" />
          <div className="pixel-card-body">
            <div className="pixel-token-icon">
              <ScrollText className="w-4 h-4" />
            </div>
            <div className="text-center">
              <div className="font-serif text-base text-fantasy-gold tracking-wider">专用资源</div>
              <div className="mt-2 text-xs leading-6 text-amber-50/80">
                {ELDRED_DEDICATED_PRESET_NAME}
                <br />
                {ELDRED_DEDICATED_WORLDBOOK_NAME}
              </div>
            </div>
          </div>
          <div className="pixel-card-gems" aria-hidden="true"><span /><span /><span /></div>
        </div>

        <div className="glass-panel rounded-lg border-fantasy-gold/40 p-5 md:p-6">
          <div className="mb-5 flex flex-col gap-3 border-b border-fantasy-gold/20 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-serif text-xl text-fantasy-gold">控制台资源</h2>
              <div className="mt-1 text-xs text-gray-400">{status.loadedPresetName || '未读取到当前预设'}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={refresh} disabled={busy} className="btn-rpg rounded px-3 py-2 text-xs">
                <RefreshCcw className="mr-1 inline h-3 w-3" />刷新
              </button>
              <button onClick={install} disabled={busy} className="btn-rpg rounded px-4 py-2 text-xs">
                <Download className="mr-1 inline h-3 w-3" />导入
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <StatusTile label="预设已导入" active={status.presetImported} />
            <StatusTile label="预设已加载" active={status.presetLoaded} />
            <StatusTile label="世界书已导入" active={status.worldbookImported} />
            <StatusTile label="世界书已启用" active={status.worldbookEnabled} />
          </div>

          <div className="mt-5 rounded border border-fantasy-gold/20 bg-black/30 p-4 text-sm text-gray-300">
            {message || '待操作'}
          </div>

          {result && (
            <div className="mt-4 grid gap-2 text-xs text-gray-400 sm:grid-cols-2">
              <div className="rounded border border-white/10 bg-white/5 p-3">来源条目：{result.sourceEntries}</div>
              <div className="rounded border border-white/10 bg-white/5 p-3">新增条目：{result.added}</div>
              <div className="rounded border border-white/10 bg-white/5 p-3">覆盖条目：{result.overwritten}</div>
              <div className="rounded border border-white/10 bg-white/5 p-3">本次启用：{result.enabledGlobally ? '是' : '否'}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusTile({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`pixel-data-tile p-3 text-sm ${active ? 'text-green-200' : 'text-gray-400'}`}>
      <span className={`pixel-status-dot mr-2 align-[-0.1rem] ${active ? 'bg-green-400' : 'bg-gray-600'}`} />
      {label}
    </div>
  );
}
