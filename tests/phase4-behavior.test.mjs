import test from 'node:test';
import assert from 'node:assert/strict';
import { categorizeScore, matrixRows, scoreCardRows, updateScoreValue } from '../js/phases/phase4.js';

test('categorizeScore classifies BCG-style portfolio categories', () => {
  assert.equal(categorizeScore({ businessValue: 5, feasibility: 5 }).key, 'quickWins');
  assert.equal(categorizeScore({ businessValue: 4, feasibility: 2 }).key, 'strategicBets');
  assert.equal(categorizeScore({ businessValue: 3, feasibility: 3 }).key, 'medium');
  assert.equal(categorizeScore({ businessValue: 2, feasibility: 5 }).key, 'lowPriority');
});

test('scoreCardRows keeps original use case order while matrixRows sorts by score', () => {
  const workspace = {
    phase3: { useCases: [{ id: 'uc_1', name: 'A' }, { id: 'uc_2', name: 'B' }] },
    phase4: { scores: { uc_1: { businessValue: 3, feasibility: 5 }, uc_2: { businessValue: 5, feasibility: 3 } } }
  };
  assert.deepEqual(scoreCardRows(workspace).map((row) => row.useCase.id), ['uc_1', 'uc_2']);
  assert.deepEqual(matrixRows(workspace).map((row) => row.useCase.id), ['uc_2', 'uc_1']);
});

test('updateScoreValue clamps slider values between 1 and 5', () => {
  const draft = { phase4: { scores: {} } };
  updateScoreValue(draft, 'uc_1', 'businessValue', 8);
  updateScoreValue(draft, 'uc_1', 'feasibility', 0);
  assert.deepEqual(draft.phase4.scores.uc_1, { businessValue: 5, feasibility: 1 });
});
