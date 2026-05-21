import { STORAGE_KEY, createDefaultWorkspace, touch, validateWorkspace } from './schema.js';

export function loadWorkspace(storage = window.localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return createDefaultWorkspace();
  try {
    const parsed = JSON.parse(raw);
    const validation = validateWorkspace(parsed);
    return validation.valid ? parsed : createDefaultWorkspace();
  } catch {
    return createDefaultWorkspace();
  }
}

export function saveWorkspace(workspace, storage = window.localStorage) {
  const next = touch(workspace);
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function replaceWorkspace(workspace, storage = window.localStorage) {
  const validation = validateWorkspace(workspace);
  if (!validation.valid) throw new Error(validation.error);
  storage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  return workspace;
}

export function resetWorkspace(storage = window.localStorage) {
  const workspace = createDefaultWorkspace();
  storage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  return workspace;
}
