import market from './market-v1.mjs';
import cafe from './cafe-v1.mjs';
import { lessons } from './lessons.mjs';
import { caseKey } from './academy.mjs';
import { practice } from './practice.mjs';

export const catalog = [market, cafe, practice, ...lessons];

export function latestCase(companyId, caseId, custom = []) {
  return [...catalog, ...custom].filter(item => item.companyId === companyId && item.caseId === caseId)
    .sort((a, b) => b.version - a.version)[0];
}

export function availableCases(custom = []) {
  const result = new Map();
  for (const item of [...catalog, ...custom]) {
    const key = caseKey(item);
    if (!result.has(key) || result.get(key).version < item.version) result.set(key, item);
  }
  return [...result.values()];
}
