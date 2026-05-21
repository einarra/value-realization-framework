export const STORAGE_KEY = 'aiValueFrameworkWorkspace.v1';

export const PHASES = [
  { id: 'intro', title: 'Intro', exportable: false },
  { id: 'phase1', title: 'Align on AI ambition', exportable: true },
  { id: 'phase2', title: 'Discover opportunities', exportable: true },
  { id: 'phase3', title: 'Shape use cases', exportable: true },
  { id: 'phase4', title: 'Score and prioritize', exportable: true },
  { id: 'phase5', title: 'Build portfolio roadmap', exportable: true }
];

export const PHASE1_LANES = [
  'Weaknesses',
  'Strengths',
  'Issues in workprocesses',
  'Issues in tools or data',
  'Risks',
  'Strategic options (possibilities)'
];

export const ROADMAP_PLACEMENTS = ['Now', 'Next', 'Later'];
export const ROADMAP_STATUSES = ['Candidate', 'Planned', 'In progress', 'Paused', 'Done'];

export function nowIso() {
  return new Date().toISOString();
}

export function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createDefaultWorkspace() {
  const timestamp = nowIso();
  return {
    version: 1,
    workspace: {
      name: 'AI Value Realization Workspace',
      createdAt: timestamp,
      updatedAt: timestamp
    },
    phase1: { cards: [] },
    phase2: { opportunities: [] },
    phase3: { useCases: [] },
    phase4: { scores: {} },
    phase5: { roadmapItems: [] }
  };
}

export function touch(workspace) {
  return {
    ...workspace,
    workspace: {
      ...workspace.workspace,
      updatedAt: nowIso()
    }
  };
}

export function validateWorkspace(candidate) {
  if (!candidate || typeof candidate !== 'object') return { valid: false, error: 'Import must be a JSON object.' };
  if (candidate.version !== 1) return { valid: false, error: 'Only workspace version 1 is supported.' };
  if (!candidate.workspace || typeof candidate.workspace.name !== 'string') return { valid: false, error: 'Missing workspace metadata.' };
  if (!candidate.phase1 || !Array.isArray(candidate.phase1.cards)) return { valid: false, error: 'Missing phase1.cards array.' };
  if (!candidate.phase2 || !Array.isArray(candidate.phase2.opportunities)) return { valid: false, error: 'Missing phase2.opportunities array.' };
  if (!candidate.phase3 || !Array.isArray(candidate.phase3.useCases)) return { valid: false, error: 'Missing phase3.useCases array.' };
  if (!candidate.phase4 || typeof candidate.phase4.scores !== 'object' || Array.isArray(candidate.phase4.scores)) return { valid: false, error: 'Missing phase4.scores object.' };
  if (!candidate.phase5 || !Array.isArray(candidate.phase5.roadmapItems)) return { valid: false, error: 'Missing phase5.roadmapItems array.' };
  return { valid: true, error: null };
}
