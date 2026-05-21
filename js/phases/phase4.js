import { el } from '../dom.js';

const CATEGORIES = [
  { key: 'quickWins', title: '✅ Quick Wins', description: 'High value + high feasibility' },
  { key: 'strategicBets', title: '🚀 Strategic Bets', description: 'High value + low feasibility' },
  { key: 'medium', title: '⚙️ Medium', description: 'Mid-range items' },
  { key: 'lowPriority', title: '⛔ Low Priority', description: 'Low value' }
];

export function renderPhase4({ root, workspace, setWorkspace }) {
  root.append(el('div', { className: 'phase-header' }, [
    el('div', {}, [
      el('h2', { text: 'Phase 4: Score and prioritize' }),
      el('p', { className: 'notice', text: 'Use sliders to score each use case by business value and feasibility, then review the portfolio category.' })
    ])
  ]));

  const stableRows = scoreCardRows(workspace);
  root.append(renderScoreCards(stableRows, workspace, setWorkspace));
  root.append(renderPortfolioMatrix(matrixRows(workspace)));
}

export function scoreCardRows(workspace) {
  return workspace.phase3.useCases.map((useCase) => buildRow(useCase, workspace));
}

export function matrixRows(workspace) {
  return scoreCardRows(workspace).sort((a, b) => b.total - a.total || b.score.businessValue - a.score.businessValue);
}

function buildRow(useCase, workspace) {
  const score = normalizeScore(workspace.phase4.scores[useCase.id]);
  return { useCase, score, total: Number(score.businessValue) + Number(score.feasibility), category: categorizeScore(score) };
}

function renderScoreCards(rows, workspace, setWorkspace) {
  if (!rows.length) {
    return el('section', { className: 'panel' }, [el('p', { text: 'No use cases to score yet. Shape use cases in Phase 3 first.' })]);
  }
  return el('section', { className: 'score-card-grid' }, rows.map((row) => renderScoreCard(row, workspace, setWorkspace)));
}

function renderScoreCard(row, workspace, setWorkspace) {
  const opportunity = workspace.phase2.opportunities.find((item) => item.id === row.useCase.opportunityId);
  return el('article', { className: 'score-card' }, [
    el('div', { className: 'score-card-header' }, [
      el('div', {}, [
        el('h3', { text: row.useCase.name || 'Unnamed use case' }),
        el('p', { text: opportunity ? opportunity.text || opportunity.title || 'Linked opportunity' : 'No linked opportunity shown' })
      ])
    ]),
    sliderField('Business value', row.score.businessValue, (value) => updateScore(setWorkspace, row.useCase.id, 'businessValue', value)),
    sliderField('Feasibility', row.score.feasibility, (value) => updateScore(setWorkspace, row.useCase.id, 'feasibility', value))
  ]);
}

function sliderField(label, value, onChange) {
  const valueLabel = el('strong', { text: String(value) });
  const input = el('input', { type: 'range', min: '1', max: '5', value: String(value) });
  input.addEventListener('input', () => { valueLabel.textContent = input.value; });
  input.addEventListener('change', () => onChange(Number(input.value)));
  return el('label', { className: 'slider-field' }, [
    el('span', {}, [document.createTextNode(label), valueLabel]),
    input,
    el('div', { className: 'slider-scale' }, [el('span', { text: '1' }), el('span', { text: '5' })])
  ]);
}

function updateScore(setWorkspace, useCaseId, key, value) {
  setWorkspace((draft) => {
    updateScoreValue(draft, useCaseId, key, value);
    return draft;
  });
}

export function updateScoreValue(draft, useCaseId, key, value) {
  const clamped = Math.max(1, Math.min(5, Number(value) || 1));
  draft.phase4.scores[useCaseId] = { businessValue: 1, feasibility: 1, ...(draft.phase4.scores[useCaseId] || {}), [key]: clamped };
}

export function categorizeScore(score) {
  const businessValue = Number(score.businessValue) || 1;
  const feasibility = Number(score.feasibility) || 1;
  if (businessValue <= 2) return CATEGORIES.find((category) => category.key === 'lowPriority');
  if (businessValue >= 4 && feasibility >= 4) return CATEGORIES.find((category) => category.key === 'quickWins');
  if (businessValue >= 4 && feasibility <= 3) return CATEGORIES.find((category) => category.key === 'strategicBets');
  return CATEGORIES.find((category) => category.key === 'medium');
}

function renderPortfolioMatrix(rows) {
  const grouped = Object.fromEntries(CATEGORIES.map((category) => [category.key, []]));
  rows.forEach((row) => grouped[row.category.key].push(row));
  return el('section', { className: 'panel grid' }, [
    el('div', {}, [
      el('p', { className: 'eyebrow', text: 'Portfolio matrix' }),
      el('h2', { text: 'Value × feasibility categories' })
    ]),
    el('div', { className: 'bcg-matrix' }, CATEGORIES.map((category) => el('div', { className: `bcg-cell ${category.key}` }, [
      el('h3', { text: category.title }),
      el('p', { text: category.description }),
      el('div', { className: 'bcg-items' }, grouped[category.key].length
        ? grouped[category.key].map((row) => el('div', { className: 'bcg-item', text: row.useCase.name || 'Unnamed use case' }))
        : [el('span', { className: 'muted-empty', text: 'No use cases' })])
    ])))
  ]);
}

function normalizeScore(score) {
  return {
    businessValue: Number(score?.businessValue) || 1,
    feasibility: Number(score?.feasibility) || 1
  };
}
