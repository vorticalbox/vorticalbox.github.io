import type { Save } from './types';

const key = 'railway-adventure-save';
const defaults: Save = { history: [], best: 0, muted: false };

export function loadSave(): Save {
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(key) || '{}') };
  } catch {
    return { ...defaults };
  }
}

export function persistSave(save: Save) {
  localStorage.setItem(key, JSON.stringify(save));
}
