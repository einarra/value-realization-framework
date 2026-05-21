import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWorkspaceJson } from '../js/export.js';

test('logistics reseller demo import contains realistic data across all phases', () => {
  const raw = readFileSync(new URL('../demo-data/logistics-reseller-demo-workspace.json', import.meta.url), 'utf8');
  const workspace = parseWorkspaceJson(raw);

  assert.equal(workspace.workspace.name, 'Nordic Supply Direct — AI Value Realization Demo');
  assert.ok(workspace.phase1.cards.length >= 12);
  assert.ok(workspace.phase1.cards.some((card) => card.priority === 'Pri 1'));
  assert.ok(workspace.phase1.cards.some((card) => card.priority === 'Pri 2'));
  assert.ok(workspace.phase2.opportunities.some((opportunity) => opportunity.category === 'decided'));
  assert.ok(workspace.phase2.opportunities.some((opportunity) => opportunity.category === 'recommended'));
  assert.ok(workspace.phase2.opportunities.some((opportunity) => opportunity.category === 'strategic option'));
  assert.ok(workspace.phase3.useCases.length >= 3);
  assert.ok(Object.keys(workspace.phase4.scores).length >= workspace.phase3.useCases.length);
  assert.ok(workspace.phase5.roadmapItems.length >= 3);
});
