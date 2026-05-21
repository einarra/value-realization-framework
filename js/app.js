import { PHASES } from './schema.js';
import { loadWorkspace, saveWorkspace, replaceWorkspace, resetWorkspace } from './storage.js';
import { buildExportPayload, downloadJson, parseWorkspaceJson } from './export.js';
import { clear, el } from './dom.js';
import { renderIntro } from './phases/intro.js?v=20260519-phase4-neutral-cards';
import { renderPhase1 } from './phases/phase1.js?v=20260519-phase4-neutral-cards';
import { renderPhase2 } from './phases/phase2.js?v=20260519-phase4-neutral-cards';
import { renderPhase3 } from './phases/phase3.js?v=20260519-phase4-neutral-cards';
import { renderPhase4 } from './phases/phase4.js?v=20260519-phase4-neutral-cards';
import { renderPhase5 } from './phases/phase5.js?v=20260519-phase4-neutral-cards';

const phaseRenderers = { intro: renderIntro, phase1: renderPhase1, phase2: renderPhase2, phase3: renderPhase3, phase4: renderPhase4, phase5: renderPhase5 };
const state = { workspace: loadWorkspace(), activePhase: 'intro' };

const phaseNav = document.querySelector('#phaseNav');
const phaseRoot = document.querySelector('#phaseRoot');
const saveStatus = document.querySelector('#saveStatus');
const exportPhaseBtn = document.querySelector('#exportPhaseBtn');
const exportWorkspaceBtn = document.querySelector('#exportWorkspaceBtn');
const importFile = document.querySelector('#importFile');
const resetBtn = document.querySelector('#resetBtn');

function setStatus(message) {
  saveStatus.textContent = message;
}

function persist() {
  state.workspace = saveWorkspace(state.workspace);
  setStatus(`Saved locally ${new Date().toLocaleTimeString()}`);
  render();
}

function setWorkspace(updater) {
  state.workspace = updater(structuredClone(state.workspace));
  persist();
}

function setActivePhase(phaseId) {
  state.activePhase = phaseId;
  render();
  phaseRoot.focus();
}

function renderNav() {
  clear(phaseNav);
  let dataPhaseIndex = 0;
  PHASES.forEach((phase) => {
    if (phase.exportable) dataPhaseIndex += 1;
    phaseNav.append(el('button', {
      type: 'button',
      className: `phase-tab ${phase.id === state.activePhase ? 'active' : ''}`,
      text: phase.exportable ? `${dataPhaseIndex}. ${phase.title}` : phase.title,
      onclick: () => setActivePhase(phase.id)
    }));
  });
}

function render() {
  renderNav();
  clear(phaseRoot);
  const activePhaseMeta = PHASES.find((phase) => phase.id === state.activePhase);
  exportPhaseBtn.disabled = !activePhaseMeta?.exportable;
  exportPhaseBtn.title = activePhaseMeta?.exportable ? '' : 'Intro has no phase data to export';
  const renderer = phaseRenderers[state.activePhase];
  renderer({ root: phaseRoot, workspace: state.workspace, setWorkspace, setActivePhase });
}

exportPhaseBtn.addEventListener('click', () => {
  const activePhaseMeta = PHASES.find((phase) => phase.id === state.activePhase);
  if (!activePhaseMeta?.exportable) return;
  const payload = buildExportPayload(state.workspace, state.activePhase);
  downloadJson(payload, `ai-value-${state.activePhase}.json`);
});

exportWorkspaceBtn.addEventListener('click', () => {
  const payload = buildExportPayload(state.workspace, 'workspace');
  downloadJson(payload, 'ai-value-workspace.json');
});

importFile.addEventListener('change', async () => {
  const file = importFile.files?.[0];
  importFile.value = '';
  if (!file) return;
  try {
    const text = await file.text();
    const imported = parseWorkspaceJson(text);
    if (!confirm('Importing replaces the current browser workspace. Continue?')) return;
    state.workspace = replaceWorkspace(imported);
    setStatus('Imported workspace and saved locally');
    render();
  } catch (error) {
    alert(error.message);
  }
});

resetBtn.addEventListener('click', () => {
  if (!confirm('Reset this workspace? This clears local browser data for this app.')) return;
  state.workspace = resetWorkspace();
  setStatus('Workspace reset');
  render();
});

setStatus('Loaded from browser storage');
render();
