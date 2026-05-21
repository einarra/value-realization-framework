import test from 'node:test';
import assert from 'node:assert/strict';
import { getPrioritizedIssues, createOpportunityForIssue, updateOpportunity, deleteOpportunityById, getOpportunityText } from '../js/phases/phase2.js';

test('getPrioritizedIssues returns only Pri 1 and Pri 2 issues sorted by priority', () => {
  const workspace = {
    phase1: {
      cards: [
        { id: 'c1', text: 'No priority', priority: '', lane: 'Risks' },
        { id: 'c2', text: 'Second priority', priority: 'Pri 2', lane: 'Weaknesses' },
        { id: 'c3', text: 'First priority', priority: 'Pri 1', lane: 'Issues in tools or data' },
        { id: 'c4', text: 'Third priority', priority: 'Pri 3', lane: 'Strengths' }
      ]
    }
  };
  assert.deepEqual(getPrioritizedIssues(workspace).map((issue) => issue.id), ['c3', 'c2']);
});

test('createOpportunityForIssue adds a possible opportunity linked to the issue', () => {
  const draft = { phase2: { opportunities: [] } };
  createOpportunityForIssue(draft, 'card_1');
  assert.equal(draft.phase2.opportunities.length, 1);
  assert.equal(draft.phase2.opportunities[0].text, '');
  assert.equal(draft.phase2.opportunities[0].category, 'possible');
  assert.deepEqual(draft.phase2.opportunities[0].linkedIssueIds, ['card_1']);
});

test('updateOpportunity changes text and category', () => {
  const draft = { phase2: { opportunities: [{ id: 'opp_1', text: '', category: 'possible', linkedIssueIds: ['card_1'] }] } };
  updateOpportunity(draft, 'opp_1', { text: 'Automate intake', category: 'recommended' });
  assert.equal(draft.phase2.opportunities[0].text, 'Automate intake');
  assert.equal(draft.phase2.opportunities[0].category, 'recommended');
});

test('getOpportunityText falls back to old title and description fields', () => {
  assert.equal(getOpportunityText({ text: 'New text', title: 'Old title' }), 'New text');
  assert.equal(getOpportunityText({ title: 'Old title', description: 'Old description' }), 'Old title — Old description');
});

test('deleteOpportunityById removes the selected opportunity', () => {
  const draft = { phase2: { opportunities: [{ id: 'opp_1' }, { id: 'opp_2' }] }, phase3: { useCases: [{ opportunityId: 'opp_1' }] } };
  deleteOpportunityById(draft, 'opp_1');
  assert.deepEqual(draft.phase2.opportunities.map((opportunity) => opportunity.id), ['opp_2']);
  assert.equal(draft.phase3.useCases[0].opportunityId, '');
});
