import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultWorkspace, validateWorkspace, PHASES, PHASE1_LANES } from '../js/schema.js';

test('default workspace has intro navigation, five data phases, and phase 1 lanes', () => {
  const workspace = createDefaultWorkspace();
  assert.equal(workspace.version, 1);
  assert.equal(PHASES.length, 6);
  assert.equal(PHASES[0].id, 'intro');
  assert.equal(PHASES[0].exportable, false);
  assert.deepEqual(PHASES.filter((phase) => phase.exportable).map((phase) => phase.id), ['phase1', 'phase2', 'phase3', 'phase4', 'phase5']);
  assert.deepEqual(PHASE1_LANES, [
    'Weaknesses',
    'Strengths',
    'Issues in workprocesses',
    'Issues in tools or data',
    'Risks',
    'Strategic options (possibilities)'
  ]);
  assert.deepEqual(workspace.phase1.cards, []);
  assert.deepEqual(workspace.phase2.opportunities, []);
  assert.deepEqual(workspace.phase3.useCases, []);
  assert.deepEqual(workspace.phase4.scores, {});
  assert.deepEqual(workspace.phase5.roadmapItems, []);
});

test('validateWorkspace accepts a valid workspace', () => {
  const result = validateWorkspace(createDefaultWorkspace());
  assert.equal(result.valid, true);
  assert.equal(result.error, null);
});

test('validateWorkspace rejects invalid imports', () => {
  assert.equal(validateWorkspace(null).valid, false);
  assert.equal(validateWorkspace({ version: 2 }).valid, false);
  assert.equal(validateWorkspace({ version: 1, phase1: {} }).valid, false);
});
