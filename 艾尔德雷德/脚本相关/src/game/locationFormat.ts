import { OriginLocation } from '../types';
import { RegionMap, regions } from './mapData';

type RuntimeWorldLike = {
  currentLocation?: string;
  region?: string;
  subRegion?: string;
  landmark?: string;
  travelState?: string;
};

export type EldredLocationDisplay = {
  region?: RegionMap;
  majorName: string;
  landmarkName: string;
  fullName: string;
  detail: string;
};

const normalize = (value: unknown) => String(value ?? '').trim();

const isEmptyLocationValue = (value: string) =>
  !value || ['待开局', '未记录', '未登记', '当前位置未落定', '当前地标未落定', '随机出生点', '未定地标'].includes(value);

const splitLocationParts = (value: string) =>
  normalize(value)
    .split(/[·｜|/／>＞-]/)
    .map(part => part.trim())
    .filter(Boolean);

export const findRegionByLocationText = (...values: unknown[]) => {
  const texts = values.map(normalize).filter(Boolean);
  return regions.find(region =>
    texts.some(text =>
      text === region.id ||
      text === region.name ||
      text === region.area ||
      text.includes(region.name) ||
      region.name.includes(text) ||
      region.landmarks.some(landmark => text === landmark.name || text.includes(landmark.name)),
    ),
  );
};

export const regionNameFromIdOrText = (...values: unknown[]) => {
  const region = findRegionByLocationText(...values);
  if (region) return region.name;
  const fallback = values.map(normalize).find(value => !isEmptyLocationValue(value) && !/^[a-z0-9-]+$/i.test(value));
  return fallback || '未知大地标';
};

export const formatEldredLocation = (
  world?: RuntimeWorldLike,
  origin?: OriginLocation,
): EldredLocationDisplay => {
  const current = normalize(world?.currentLocation || origin?.name);
  const regionText = normalize(world?.region || origin?.regionId);
  const subRegion = normalize(world?.subRegion || origin?.summary);
  const landmark = normalize(world?.landmark || origin?.landmarkName);
  const parts = splitLocationParts(current);
  const region = findRegionByLocationText(regionText, current, landmark, subRegion, origin?.regionId);

  const majorName = region?.name || regionNameFromIdOrText(regionText, subRegion, current);
  const currentLooksMajor = region ? current === region.id || current === region.name || current === region.area : current === majorName;
  const parsedSmall = parts.length > 1 ? parts[parts.length - 1] : '';
  const landmarkName = [landmark, parsedSmall, current]
    .find(value => {
      if (isEmptyLocationValue(value)) return false;
      if (value === majorName || value === region?.id || value === region?.area) return false;
      if (currentLooksMajor && value === current) return false;
      return true;
    }) || '当前地标未落定';

  const fullName = majorName && landmarkName && majorName !== landmarkName
    ? `${majorName}·${landmarkName}`
    : majorName || landmarkName;

  const detail = [subRegion, origin?.summary, world?.travelState]
    .map(normalize)
    .find(value => value && value !== majorName && value !== landmarkName && value !== fullName) || '';

  return {
    region,
    majorName,
    landmarkName,
    fullName,
    detail,
  };
};
