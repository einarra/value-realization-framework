import { PHASE1_LANES, createId, nowIso } from '../schema.js';
import { el, selectInput } from '../dom.js';

export function renderPhase1({ root, workspace, setWorkspace }) {
  root.append(el('div', { className: 'phase-header' }, [
    el('div', {}, [
      el('h2', { text: 'Phase 1: Align on AI ambition' }),
      el('p', { className: 'notice', text: 'Capture current-state issues, strengths, risks, and strategic possibilities as simple cards.' })
    ])
  ]));

  const board = el('section', { className: 'kanban' });
  PHASE1_LANES.forEach((lane) => board.append(renderLane(lane, workspace, setWorkspace)));
  root.append(board);
}

function renderLane(lane, workspace, setWorkspace) {
  const laneCards = workspace.phase1.cards.filter((card) => card.lane === lane);
  const addButton = el('button', {
    type: 'button',
    className: 'primary add-card-button',
    text: '+ Add card',
    onclick: () => {
      setWorkspace((draft) => {
        createBlankPhase1Card(draft, lane);
        return draft;
      });
    }
  });

  return el('div', { className: 'lane' }, [
    el('div', { className: 'lane-header' }, [
      el('h2', { text: lane }),
      addButton
    ]),
    el('div', { className: 'card-list' }, laneCards.map((card) => renderCard(card, setWorkspace)))
  ]);
}

function renderCard(card, setWorkspace) {
  const textInput = el('textarea', { placeholder: 'Write issue card...' });
  textInput.value = card.text;
  textInput.addEventListener('change', () => {
    setWorkspace((draft) => {
      updatePhase1CardText(draft, card.id, textInput.value);
      return draft;
    });
  });

  return el('article', { className: 'kanban-card compact-card' }, [
    el('div', { className: 'card-priority' }, [
      selectInput(card.priority || '', ['', 'Pri 1', 'Pri 2', 'Pri 3'], (priority) => {
        setWorkspace((draft) => {
          updatePhase1CardPriority(draft, card.id, priority);
          return draft;
        });
      })
    ]),
    el('button', {
      type: 'button',
      className: 'delete-x',
      text: '×',
      title: 'Delete card',
      'aria-label': 'Delete card',
      onclick: () => {
        if (!confirm('Delete this card?')) return;
        setWorkspace((draft) => {
          deletePhase1Card(draft, card.id);
          return draft;
        });
      }
    }),
    textInput
  ]);
}

export function createBlankPhase1Card(draft, lane) {
  const timestamp = nowIso();
  draft.phase1.cards.push({ id: createId('card'), lane, text: '', priority: '', createdAt: timestamp, updatedAt: timestamp });
}

export function updatePhase1CardText(draft, cardId, text) {
  const existing = draft.phase1.cards.find((item) => item.id === cardId);
  if (!existing) return;
  existing.text = text;
  existing.updatedAt = nowIso();
}

export function updatePhase1CardPriority(draft, cardId, priority) {
  const existing = draft.phase1.cards.find((item) => item.id === cardId);
  if (!existing) return;
  existing.priority = priority;
  existing.updatedAt = nowIso();
}

export function deletePhase1Card(draft, cardId) {
  draft.phase1.cards = draft.phase1.cards.filter((item) => item.id !== cardId);
}
