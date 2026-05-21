import { createId, nowIso } from '../schema.js';
import { el, field, textArea } from '../dom.js';

export const USER_STORY_TEMPLATE = `Role (Who): The specific persona or user type. (e.g., "As a registered customer...")
Goal (What): The action or feature the user wants to accomplish. (e.g., "...I want to save my payment methods...")
Benefit (Why): The value or core problem being solved for the user. (e.g., "...so that I can check out faster on future purchases.")`;

export const PRIMARY_USE_CASE_FIELD = ['proposedSolution', 'User story'];

export const USE_CASE_FIELDS = [
  ['targetUsers', 'Target users'],
  ['expectedValue', 'Expected value'],
  ['processImpact', 'Process impact'],
  ['dataNeeds', 'Data needs'],
  ['risks', 'Risks'],
  ['dependencies', 'Dependencies'],
  ['owner', 'Owner'],
  ['governance', 'Governance considerations'],
  ['modelType', 'Model type'],
  ['integrationNeeds', 'Integration needs'],
  ['compliance', 'Compliance considerations'],
  ['kpis', 'KPIs'],
  ['effortEstimate', 'Effort estimate']
];

export function renderPhase3({ root, workspace, setWorkspace }) {
  root.append(el('div', { className: 'phase-header' }, [
    el('div', {}, [
      el('h2', { text: 'Phase 3: Shape use cases' }),
      el('p', { className: 'notice', text: 'Shape one enterprise-ready use case for each decided opportunity.' })
    ])
  ]));

  const decidedOpportunities = getDecidedOpportunities(workspace);
  const list = el('section', { className: 'phase3-opportunity-list' });
  decidedOpportunities.forEach((opportunity) => list.append(renderOpportunityUseCaseGroup(opportunity, workspace, setWorkspace)));
  if (!decidedOpportunities.length) {
    list.append(el('p', { className: 'notice', text: 'No decided opportunities yet. Go to Phase 2 and set an opportunity category to decided.' }));
  }
  root.append(list);
}

function renderOpportunityUseCaseGroup(opportunity, workspace, setWorkspace) {
  const linkedIssue = workspace.phase1.cards.find((card) => opportunity.linkedIssueIds?.includes(card.id));
  const useCase = workspace.phase3.useCases.find((item) => item.opportunityId === opportunity.id);
  return el('article', { className: 'phase3-opportunity panel' }, [
    el('div', { className: 'phase3-opportunity-header' }, [
      el('div', {}, [
        el('div', { className: 'priority-pill priority-two', text: 'decided' }),
        el('h3', { text: getOpportunityDisplayText(opportunity) || 'Blank opportunity' }),
        el('p', { text: linkedIssue ? `${linkedIssue.priority || 'No priority'} · ${linkedIssue.lane}: ${linkedIssue.text || 'Blank issue card'}` : 'No linked issue shown' })
      ]),
      useCase ? el('span', { className: 'use-case-created', text: 'Use case created' }) : el('button', {
        type: 'button',
        className: 'primary add-card-button',
        text: '+ Add use case',
        onclick: () => {
          setWorkspace((draft) => {
            createUseCaseForOpportunity(draft, opportunity);
            return draft;
          });
        }
      })
    ]),
    useCase ? renderUseCase(useCase, setWorkspace) : el('p', { className: 'muted-empty', text: 'No use case created for this opportunity yet.' })
  ]);
}

function renderUseCase(useCase, setWorkspace) {
  const [primaryKey, primaryLabel] = PRIMARY_USE_CASE_FIELD;
  return el('article', { className: 'item-card use-case-form-card' }, [
    field(primaryLabel, textArea(useCase[primaryKey], (value) => updateUseCase(setWorkspace, useCase.id, { [primaryKey]: value }))),
    el('div', { className: 'form-grid' }, USE_CASE_FIELDS.map(([key, label]) => field(label, textArea(useCase[key], (value) => updateUseCase(setWorkspace, useCase.id, { [key]: value }))))),
    el('div', { className: 'item-actions' }, [el('button', { type: 'button', className: 'danger', text: 'Delete use case', onclick: () => deleteUseCase(setWorkspace, useCase.id) })])
  ]);
}

export function getDecidedOpportunities(workspace) {
  return workspace.phase2.opportunities.filter((opportunity) => opportunity.category === 'decided');
}

export function createUseCaseForOpportunity(draft, opportunity) {
  if (draft.phase3.useCases.some((useCase) => useCase.opportunityId === opportunity.id)) return;
  const timestamp = nowIso();
  draft.phase3.useCases.push({
    id: createId('uc'),
    name: getOpportunityDisplayText(opportunity) || 'New AI use case',
    opportunityId: opportunity.id,
    problemOpportunity: '',
    proposedSolution: USER_STORY_TEMPLATE,
    targetUsers: '',
    expectedValue: '',
    processImpact: '',
    dataNeeds: '',
    risks: '',
    dependencies: '',
    owner: '',
    governance: '',
    modelType: '',
    integrationNeeds: '',
    compliance: '',
    kpis: '',
    effortEstimate: '',
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

export function getOpportunityDisplayText(opportunity) {
  if (opportunity.text !== undefined) return opportunity.text;
  const title = opportunity.title || '';
  const description = opportunity.description || '';
  return [title, description].filter(Boolean).join(' — ');
}

function updateUseCase(setWorkspace, id, patch) {
  setWorkspace((draft) => {
    const useCase = draft.phase3.useCases.find((item) => item.id === id);
    Object.assign(useCase, patch, { updatedAt: nowIso() });
    return draft;
  });
}

function deleteUseCase(setWorkspace, id) {
  if (!confirm('Delete this use case? Scores and roadmap items for it will also be removed.')) return;
  setWorkspace((draft) => {
    draft.phase3.useCases = draft.phase3.useCases.filter((item) => item.id !== id);
    delete draft.phase4.scores[id];
    draft.phase5.roadmapItems = draft.phase5.roadmapItems.filter((item) => item.useCaseId !== id);
    return draft;
  });
}
