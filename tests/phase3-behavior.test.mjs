import test from 'node:test';
import assert from 'node:assert/strict';
import { getDecidedOpportunities, createUseCaseForOpportunity, getOpportunityDisplayText, USER_STORY_TEMPLATE, USE_CASE_FIELDS, PRIMARY_USE_CASE_FIELD } from '../js/phases/phase3.js';

test('getDecidedOpportunities returns only decided opportunities', () => {
  const workspace = {
    phase2: {
      opportunities: [
        { id: 'opp_1', category: 'possible', text: 'Possible idea' },
        { id: 'opp_2', category: 'decided', text: 'Decided idea' },
        { id: 'opp_3', category: 'recommended', text: 'Recommended idea' }
      ]
    }
  };
  assert.deepEqual(getDecidedOpportunities(workspace).map((opportunity) => opportunity.id), ['opp_2']);
});

test('createUseCaseForOpportunity creates one linked use case using opportunity text as the initial name', () => {
  const draft = { phase3: { useCases: [] } };
  const opportunity = { id: 'opp_1', text: 'Automate triage' };
  createUseCaseForOpportunity(draft, opportunity);
  assert.equal(draft.phase3.useCases.length, 1);
  assert.equal(draft.phase3.useCases[0].opportunityId, 'opp_1');
  assert.equal(draft.phase3.useCases[0].name, 'Automate triage');
  assert.equal(draft.phase3.useCases[0].proposedSolution, USER_STORY_TEMPLATE);
});

test('createUseCaseForOpportunity does not create duplicates for the same opportunity', () => {
  const draft = { phase3: { useCases: [{ id: 'uc_1', opportunityId: 'opp_1' }] } };
  createUseCaseForOpportunity(draft, { id: 'opp_1', text: 'Automate triage' });
  assert.equal(draft.phase3.useCases.length, 1);
});

test('use case fields hide problemOpportunity and use name-free full-width user story as primary field', () => {
  assert.equal(USE_CASE_FIELDS.some(([key]) => key === 'problemOpportunity'), false);
  assert.equal(USE_CASE_FIELDS.some(([key]) => key === 'name'), false);
  assert.deepEqual(PRIMARY_USE_CASE_FIELD, ['proposedSolution', 'User story']);
  assert.equal(USE_CASE_FIELDS.some(([key]) => key === 'proposedSolution'), false);
});

test('getOpportunityDisplayText falls back to old title and description fields', () => {
  assert.equal(getOpportunityDisplayText({ text: 'New text', title: 'Old title' }), 'New text');
  assert.equal(getOpportunityDisplayText({ title: 'Old title', description: 'Old description' }), 'Old title — Old description');
});
