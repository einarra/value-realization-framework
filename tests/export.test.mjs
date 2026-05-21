import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultWorkspace } from '../js/schema.js';
import { buildExportPayload, parseWorkspaceJson } from '../js/export.js';

test('buildExportPayload exports a single phase', () => {
  const workspace = createDefaultWorkspace();
  workspace.phase1.cards.push({ id: 'card_1', lane: 'Weaknesses', text: 'Manual work', createdAt: 'x', updatedAt: 'x' });
  const payload = buildExportPayload(workspace, 'phase1');
  assert.equal(payload.exportType, 'phase');
  assert.equal(payload.phase, 'phase1');
  assert.equal(payload.data.cards.length, 1);
});

test('buildExportPayload exports full workspace', () => {
  const workspace = createDefaultWorkspace();
  const payload = buildExportPayload(workspace, 'workspace');
  assert.equal(payload.exportType, 'workspace');
  assert.equal(payload.data.version, 1);
});

test('parseWorkspaceJson accepts valid workspace JSON', () => {
  const workspace = createDefaultWorkspace();
  const parsed = parseWorkspaceJson(JSON.stringify(workspace));
  assert.equal(parsed.version, 1);
});

test('parseWorkspaceJson rejects invalid JSON and phase exports', () => {
  assert.throws(() => parseWorkspaceJson('{'), /Invalid JSON/);
  assert.throws(() => parseWorkspaceJson(JSON.stringify({ exportType: 'phase' })), /full workspace/);
});

test('full workspace export and import preserves current phase data shape', () => {
  const workspace = createDefaultWorkspace();
  workspace.phase1.cards.push({
    id: 'card_1',
    lane: 'Weaknesses',
    text: 'Manual triage is slow',
    priority: 'Pri 1',
    createdAt: '2026-05-19T09:00:00.000Z',
    updatedAt: '2026-05-19T09:00:00.000Z'
  });
  workspace.phase2.opportunities.push({
    id: 'opp_1',
    text: 'AI-assisted triage recommendations',
    category: 'decided',
    linkedIssueIds: ['card_1'],
    createdAt: '2026-05-19T10:00:00.000Z',
    updatedAt: '2026-05-19T10:00:00.000Z'
  });
  workspace.phase3.useCases.push({
    id: 'uc_1',
    name: 'AI-assisted triage recommendations',
    opportunityId: 'opp_1',
    proposedSolution: 'Role (Who): As a case worker...\nGoal (What): I want triage suggestions...\nBenefit (Why): so that cases move faster.',
    targetUsers: 'Case workers',
    expectedValue: 'Reduced cycle time',
    processImpact: 'Review suggestions before routing',
    dataNeeds: 'Historical case data',
    risks: 'Wrong routing',
    dependencies: 'Case management integration',
    owner: 'Operations lead',
    governance: 'Human review required',
    modelType: 'Classification plus retrieval',
    integrationNeeds: 'Workflow integration',
    compliance: 'Approved internal data only',
    kpis: 'Cycle time, routing accuracy',
    effortEstimate: 'Medium',
    createdAt: '2026-05-19T11:00:00.000Z',
    updatedAt: '2026-05-19T11:00:00.000Z'
  });
  workspace.phase4.scores.uc_1 = { businessValue: 5, feasibility: 4 };
  workspace.phase5.roadmapItems.push({
    useCaseId: 'uc_1',
    placement: 'Now',
    status: 'Planned',
    owner: 'Operations lead',
    dependencies: 'Case management integration',
    investmentTheme: 'Operational productivity'
  });

  const exported = buildExportPayload(workspace, 'workspace');
  const imported = parseWorkspaceJson(JSON.stringify(exported));

  assert.deepEqual(imported.phase1.cards[0].priority, 'Pri 1');
  assert.deepEqual(imported.phase2.opportunities[0].category, 'decided');
  assert.deepEqual(imported.phase2.opportunities[0].text, 'AI-assisted triage recommendations');
  assert.match(imported.phase3.useCases[0].proposedSolution, /Role \(Who\)/);
  assert.deepEqual(imported.phase4.scores.uc_1, { businessValue: 5, feasibility: 4 });
  assert.equal(imported.phase5.roadmapItems[0].investmentTheme, 'Operational productivity');
});

test('current phase export includes updated phase-specific fields', () => {
  const workspace = createDefaultWorkspace();
  workspace.phase1.cards.push({ id: 'card_1', lane: 'Risks', text: 'Data quality risk', priority: 'Pri 2' });
  workspace.phase2.opportunities.push({ id: 'opp_1', text: 'Data quality assistant', category: 'recommended', linkedIssueIds: ['card_1'] });

  assert.equal(buildExportPayload(workspace, 'phase1').data.cards[0].priority, 'Pri 2');
  assert.equal(buildExportPayload(workspace, 'phase2').data.opportunities[0].category, 'recommended');
});
