import { STORAGE_KEY, createDefaultWorkspace, touch, validateWorkspace } from './schema.js';
import { API_BASE_URL } from './config.js';

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

// ---------------------------------------------------------------------------
// Remote (API-backed) save and load
// ---------------------------------------------------------------------------

export async function saveWorkspaceRemote(projectId, workspace, token) {
  const res = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/workspace`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(workspace),
  });
  if (!res.ok) throw new Error(`Remote save failed: ${res.status}`);
}

export async function loadWorkspaceRemote(projectId, token) {
  const res = await fetch(`${API_BASE_URL}/api/v1/projects/${projectId}/workspace`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (res.status === 404) return null; // no snapshot saved yet — start fresh
  if (!res.ok) throw new Error(`Remote load failed: ${res.status}`);
  const row = await res.json();
  return row.data; // the workspace JSON lives in row.data
}
