import { validateWorkspace } from './schema.js';

export function buildExportPayload(workspace, targetPhase) {
  if (targetPhase === 'workspace') {
    return {
      exportType: 'workspace',
      exportedAt: new Date().toISOString(),
      data: workspace
    };
  }
  if (!workspace[targetPhase]) throw new Error(`Unknown phase: ${targetPhase}`);
  return {
    exportType: 'phase',
    phase: targetPhase,
    exportedAt: new Date().toISOString(),
    data: workspace[targetPhase]
  };
}

export function downloadJson(payload, filename) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function parseWorkspaceJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file.');
  }
  const workspace = parsed.exportType === 'workspace' && parsed.data ? parsed.data : parsed;
  const validation = validateWorkspace(workspace);
  if (!validation.valid) throw new Error(`Import must contain a full workspace. ${validation.error}`);
  return workspace;
}
