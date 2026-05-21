import test from 'node:test';
import assert from 'node:assert/strict';
import { createBlankPhase1Card, updatePhase1CardText, updatePhase1CardPriority, deletePhase1Card } from '../js/phases/phase1.js';

test('createBlankPhase1Card adds an empty card to the selected lane', () => {
  const draft = { phase1: { cards: [] } };
  createBlankPhase1Card(draft, 'Weaknesses');
  assert.equal(draft.phase1.cards.length, 1);
  assert.equal(draft.phase1.cards[0].lane, 'Weaknesses');
  assert.equal(draft.phase1.cards[0].text, '');
  assert.equal(draft.phase1.cards[0].priority, '');
  assert.match(draft.phase1.cards[0].id, /^card_/);
});

test('updatePhase1CardText allows blank text while editing a card', () => {
  const draft = { phase1: { cards: [{ id: 'card_1', lane: 'Risks', text: 'Initial', createdAt: 'x', updatedAt: 'x' }] } };
  updatePhase1CardText(draft, 'card_1', '');
  assert.equal(draft.phase1.cards[0].text, '');
});

test('updatePhase1CardPriority stores blank or Pri 1-3 values', () => {
  const draft = { phase1: { cards: [{ id: 'card_1', lane: 'Risks', text: 'Initial', priority: '', createdAt: 'x', updatedAt: 'x' }] } };
  updatePhase1CardPriority(draft, 'card_1', 'Pri 2');
  assert.equal(draft.phase1.cards[0].priority, 'Pri 2');
  updatePhase1CardPriority(draft, 'card_1', '');
  assert.equal(draft.phase1.cards[0].priority, '');
});

test('deletePhase1Card removes the selected card', () => {
  const draft = { phase1: { cards: [{ id: 'card_1' }, { id: 'card_2' }] } };
  deletePhase1Card(draft, 'card_1');
  assert.deepEqual(draft.phase1.cards.map((card) => card.id), ['card_2']);
});
