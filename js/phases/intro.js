import { el } from '../dom.js';

const STEPS = [
  {
    number: '01',
    title: 'Align on AI ambition',
    description: 'Capture strengths, weaknesses, process issues, data and tool issues, risks, and strategic options.',
    output: 'A shared view of the current state and strategic possibilities.'
  },
  {
    number: '02',
    title: 'Discover opportunities',
    description: 'Create an opportunity backlog and optionally link opportunities to captured issue cards.',
    output: 'A traceable backlog of AI opportunity areas.'
  },
  {
    number: '03',
    title: 'Shape use cases',
    description: 'Turn selected opportunities into enterprise-ready AI use case definitions.',
    output: 'Use cases with governance, data, integration, compliance, KPI, and effort details.'
  },
  {
    number: '04',
    title: 'Score and prioritize',
    description: 'Score use cases by business value and feasibility to focus the portfolio.',
    output: 'A ranked list and value-feasibility matrix.'
  },
  {
    number: '05',
    title: 'Build portfolio roadmap',
    description: 'Place prioritized use cases into a portfolio roadmap with ownership and delivery context.',
    output: 'A practical roadmap with status, owners, dependencies, and investment themes.'
  }
];

const OUTPUTS = [
  'Captured issues, strengths, risks, and strategic options',
  'Opportunity backlog linked to workshop insights',
  'Enterprise-ready AI use case definitions',
  'Prioritized use case list and value-feasibility matrix',
  'Portfolio roadmap with owners, status, dependencies, and themes',
  'Exportable and importable JSON workspace'
];

const AGENDA = [
  ['09:00–09:30', 'Kickoff and ambition framing'],
  ['09:30–10:45', 'Phase 1: Issue capture'],
  ['10:45–11:00', 'Break'],
  ['11:00–12:15', 'Phase 2: Opportunity discovery'],
  ['12:15–13:00', 'Lunch'],
  ['13:00–14:30', 'Phase 3: Use case shaping'],
  ['14:30–14:45', 'Break'],
  ['14:45–15:45', 'Phase 4: Scoring and prioritization'],
  ['15:45–16:45', 'Phase 5: Portfolio roadmap'],
  ['16:45–17:00', 'Wrap-up, export, and next steps']
];

export function renderIntro({ root, setActivePhase }) {
  root.append(el('section', { className: 'intro-page' }, [
    renderHero(setActivePhase),
    renderProcessMap(),
    renderOutputsAndAgenda(),
    renderEngagementBlock(setActivePhase)
  ]));
}

function renderHero(setActivePhase) {
  return el('div', { className: 'intro-hero' }, [
    el('div', { className: 'hero-copy' }, [
      el('p', { className: 'eyebrow', text: 'AI Value Realization Framework' }),
      el('h2', { text: 'Turn AI ideas into a governed, prioritized portfolio' }),
      el('p', { text: 'Use this one-day facilitator workspace to move from business issues and strategic possibilities to shaped, scored, and roadmapped enterprise AI use cases.' }),
      el('div', { className: 'hero-actions' }, [
        el('button', { type: 'button', className: 'primary', text: 'Start with Phase 1', onclick: () => setActivePhase('phase1') }),
        el('span', { text: 'Local-first · Browser saved · JSON exportable' })
      ])
    ]),
    el('div', { className: 'hero-stat-grid' }, [
      renderStat('5', 'guided phases'),
      renderStat('1 day', 'from insight to roadmap'),
      renderStat('JSON', 'portable workshop output')
    ])
  ]);
}

function renderStat(value, label) {
  return el('div', { className: 'hero-stat' }, [
    el('strong', { text: value }),
    el('span', { text: label })
  ]);
}

function renderProcessMap() {
  return el('section', { className: 'panel' }, [
    el('div', { className: 'phase-header' }, [
      el('div', {}, [
        el('p', { className: 'eyebrow', text: 'The process' }),
        el('h2', { text: 'Five steps from ambition to roadmap' })
      ])
    ]),
    el('div', { className: 'process-map' }, STEPS.map((step) => el('article', { className: 'process-card' }, [
      el('div', { className: 'step-number', text: step.number }),
      el('h3', { text: step.title }),
      el('p', { text: step.description }),
      el('strong', { text: `Output: ${step.output}` })
    ])))
  ]);
}

function renderOutputsAndAgenda() {
  return el('div', { className: 'intro-two-column' }, [
    el('section', { className: 'panel' }, [
      el('p', { className: 'eyebrow', text: 'Expected output' }),
      el('h2', { text: 'What you will have by the end' }),
      el('div', { className: 'output-grid' }, OUTPUTS.map((output) => el('div', { className: 'output-card' }, [
        el('span', { text: '✓' }),
        el('p', { text: output })
      ])))
    ]),
    el('section', { className: 'panel' }, [
      el('p', { className: 'eyebrow', text: 'One-day agenda' }),
      el('h2', { text: 'A focused full-day workshop' }),
      el('div', { className: 'agenda' }, AGENDA.map(([time, title]) => el('div', { className: 'agenda-item' }, [
        el('div', { className: 'agenda-time', text: time }),
        el('div', { text: title })
      ])))
    ])
  ]);
}

function renderEngagementBlock(setActivePhase) {
  return el('section', { className: 'engagement-block' }, [
    el('div', {}, [
      el('p', { className: 'eyebrow', text: 'Ready to begin' }),
      el('h2', { text: 'By the end of today, you will have a shared AI portfolio you can export, share, and continue refining.' })
    ]),
    el('button', { type: 'button', className: 'primary', text: 'Begin the workshop', onclick: () => setActivePhase('phase1') })
  ]);
}
