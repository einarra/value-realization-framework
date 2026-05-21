import { ROADMAP_PLACEMENTS, ROADMAP_STATUSES } from '../schema.js';
import { el, selectInput, textInput } from '../dom.js';

export function renderPhase5({ root, workspace, setWorkspace }) {
  root.append(el('div', { className: 'phase-header' }, [
    el('div', {}, [el('h2', { text: 'Phase 5: Build portfolio roadmap' }), el('p', { className: 'notice', text: 'Place use cases on the roadmap and manage status, owners, dependencies, and investment themes.' })]),
    el('button', { type: 'button', className: 'primary', text: 'Add selected use cases', onclick: () => addMissingRoadmapItems(workspace, setWorkspace) })
  ]));
  root.append(renderRoadmapTable(workspace, setWorkspace));
}

function addMissingRoadmapItems(workspace, setWorkspace) {
  setWorkspace((draft) => {
    const existingIds = new Set(draft.phase5.roadmapItems.map((item) => item.useCaseId));
    draft.phase3.useCases.forEach((useCase) => {
      if (!existingIds.has(useCase.id)) {
        draft.phase5.roadmapItems.push({ useCaseId: useCase.id, placement: 'Next', status: 'Candidate', owner: useCase.owner || '', dependencies: useCase.dependencies || '', investmentTheme: '' });
      }
    });
    return draft;
  });
}

function renderRoadmapTable(workspace, setWorkspace) {
  const useCaseById = Object.fromEntries(workspace.phase3.useCases.map((useCase) => [useCase.id, useCase]));
  const table = el('table', { className: 'table' }, [
    el('thead', {}, [el('tr', {}, ['Use case', 'Placement', 'Status', 'Owner', 'Dependencies', 'Investment theme', 'Actions'].map((heading) => el('th', { text: heading })))]),
    el('tbody')
  ]);
  const tbody = table.querySelector('tbody');
  workspace.phase5.roadmapItems.forEach((item) => {
    const useCase = useCaseById[item.useCaseId];
    tbody.append(el('tr', {}, [
      el('td', { text: useCase ? useCase.name : 'Deleted use case' }),
      el('td', {}, [selectInput(item.placement, ROADMAP_PLACEMENTS, (value) => updateItem(setWorkspace, item.useCaseId, { placement: value }))]),
      el('td', {}, [selectInput(item.status, ROADMAP_STATUSES, (value) => updateItem(setWorkspace, item.useCaseId, { status: value }))]),
      el('td', {}, [textInput(item.owner, (value) => updateItem(setWorkspace, item.useCaseId, { owner: value }))]),
      el('td', {}, [textInput(item.dependencies, (value) => updateItem(setWorkspace, item.useCaseId, { dependencies: value }))]),
      el('td', {}, [textInput(item.investmentTheme, (value) => updateItem(setWorkspace, item.useCaseId, { investmentTheme: value }))]),
      el('td', {}, [el('button', { type: 'button', className: 'danger', text: 'Remove', onclick: () => removeItem(setWorkspace, item.useCaseId) })])
    ]));
  });
  if (!workspace.phase5.roadmapItems.length) tbody.append(el('tr', {}, [el('td', { colspan: '7', text: 'No roadmap items yet. Add selected use cases to build the portfolio roadmap.' })]));
  return el('section', { className: 'panel grid' }, [el('h3', { text: 'Portfolio roadmap' }), table]);
}

function updateItem(setWorkspace, useCaseId, patch) {
  setWorkspace((draft) => {
    const item = draft.phase5.roadmapItems.find((candidate) => candidate.useCaseId === useCaseId);
    Object.assign(item, patch);
    return draft;
  });
}

function removeItem(setWorkspace, useCaseId) {
  if (!confirm('Remove this use case from the roadmap?')) return;
  setWorkspace((draft) => {
    draft.phase5.roadmapItems = draft.phase5.roadmapItems.filter((item) => item.useCaseId !== useCaseId);
    return draft;
  });
}
