import { createId, nowIso } from '../schema.js';
import { el, selectInput } from '../dom.js';

const OPPORTUNITY_CATEGORIES = ['possible', 'recommended', 'decided', 'strategic option'];

export function renderPhase2({ root, workspace, setWorkspace }) {
  root.append(el('div', { className: 'phase-header' }, [
    el('div', {}, [
      el('h2', { text: 'Phase 2: Discover opportunities' }),
      el('p', { className: 'notice', text: 'Work from Pri 1 and Pri 2 issues. Add one or more opportunities for each prioritized issue.' })
    ])
  ]));

  const prioritizedIssues = getPrioritizedIssues(workspace);
  const list = el('section', { className: 'phase2-issue-list' });
  prioritizedIssues.forEach((issue) => list.append(renderIssueOpportunityGroup(issue, workspace, setWorkspace)));
  if (!prioritizedIssues.length) {
    list.append(el('p', { className: 'notice', text: 'No Pri 1 or Pri 2 issues yet. Go back to Phase 1 and prioritize issue cards to discover opportunities.' }));
  }
  root.append(list);
}

function renderIssueOpportunityGroup(issue, workspace, setWorkspace) {
  const opportunities = workspace.phase2.opportunities.filter((opportunity) => opportunity.linkedIssueIds?.includes(issue.id));
  return el('article', { className: 'phase2-issue panel' }, [
    el('div', { className: 'phase2-issue-header' }, [
      el('div', {}, [
        el('div', { className: `priority-pill ${priorityClass(issue.priority)}`, text: issue.priority }),
        el('h3', { text: issue.text || 'Blank issue card' }),
        el('p', { text: issue.lane })
      ]),
      el('button', {
        type: 'button',
        className: 'primary add-card-button',
        text: '+ Add opportunity',
        onclick: () => {
          setWorkspace((draft) => {
            createOpportunityForIssue(draft, issue.id);
            return draft;
          });
        }
      })
    ]),
    el('div', { className: 'opportunity-list' }, opportunities.map((opportunity) => renderOpportunityCard(opportunity, setWorkspace)))
  ]);
}

function renderOpportunityCard(opportunity, setWorkspace) {
  const textInput = el('textarea', { placeholder: 'Write opportunity...' });
  textInput.value = getOpportunityText(opportunity);
  textInput.addEventListener('change', () => {
    setWorkspace((draft) => {
      updateOpportunity(draft, opportunity.id, { text: textInput.value });
      return draft;
    });
  });

  return el('article', { className: 'opportunity-card compact-card' }, [
    el('div', { className: 'opportunity-category' }, [
      selectInput(opportunity.category || 'possible', OPPORTUNITY_CATEGORIES, (category) => {
        setWorkspace((draft) => {
          updateOpportunity(draft, opportunity.id, { category });
          return draft;
        });
      })
    ]),
    el('button', {
      type: 'button',
      className: 'delete-x',
      text: '×',
      title: 'Delete opportunity',
      'aria-label': 'Delete opportunity',
      onclick: () => {
        if (!confirm('Delete this opportunity?')) return;
        setWorkspace((draft) => {
          deleteOpportunityById(draft, opportunity.id);
          return draft;
        });
      }
    }),
    textInput
  ]);
}

export function getPrioritizedIssues(workspace) {
  const order = { 'Pri 1': 1, 'Pri 2': 2 };
  return workspace.phase1.cards
    .map((card, index) => ({ ...card, originalIndex: index }))
    .filter((card) => card.priority === 'Pri 1' || card.priority === 'Pri 2')
    .sort((a, b) => order[a.priority] - order[b.priority] || a.originalIndex - b.originalIndex);
}

export function createOpportunityForIssue(draft, issueId) {
  const timestamp = nowIso();
  draft.phase2.opportunities.push({
    id: createId('opp'),
    text: '',
    category: 'possible',
    linkedIssueIds: [issueId],
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

export function updateOpportunity(draft, id, patch) {
  const opportunity = draft.phase2.opportunities.find((item) => item.id === id);
  if (!opportunity) return;
  Object.assign(opportunity, patch, { updatedAt: nowIso() });
}

export function getOpportunityText(opportunity) {
  if (opportunity.text !== undefined) return opportunity.text;
  const title = opportunity.title || '';
  const description = opportunity.description || '';
  return [title, description].filter(Boolean).join(' — ');
}

export function deleteOpportunityById(draft, id) {
  draft.phase2.opportunities = draft.phase2.opportunities.filter((item) => item.id !== id);
  draft.phase3.useCases.forEach((useCase) => {
    if (useCase.opportunityId === id) useCase.opportunityId = '';
  });
}

function priorityClass(priority) {
  return priority === 'Pri 1' ? 'priority-one' : 'priority-two';
}
