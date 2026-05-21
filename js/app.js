import { PHASES, createDefaultWorkspace } from './schema.js';
import { loadWorkspace, saveWorkspace, replaceWorkspace, resetWorkspace, saveWorkspaceRemote, loadWorkspaceRemote } from './storage.js';
import { buildExportPayload, downloadJson, parseWorkspaceJson } from './export.js';
import { clear, el } from './dom.js';
import { getSession, signOut } from './auth.js';
import { renderIntro } from './phases/intro.js?v=20260519-phase4-neutral-cards';
import { renderPhase1 } from './phases/phase1.js?v=20260519-phase4-neutral-cards';
import { renderPhase2 } from './phases/phase2.js?v=20260519-phase4-neutral-cards';
import { renderPhase3 } from './phases/phase3.js?v=20260519-phase4-neutral-cards';
import { renderPhase4 } from './phases/phase4.js?v=20260519-phase4-neutral-cards';
import { renderPhase5 } from './phases/phase5.js?v=20260519-phase4-neutral-cards';

const phaseRenderers = { intro: renderIntro, phase1: renderPhase1, phase2: renderPhase2, phase3: renderPhase3, phase4: renderPhase4, phase5: renderPhase5 };
const state = {
  workspace: loadWorkspace(),
  activePhase: 'intro',
  projectId: null,   // set from ?project=<id> query param when a project is opened
  token: null,       // Supabase JWT, set after successful auth check
};

const phaseNav = document.querySelector('#phaseNav');
const phaseRoot = document.querySelector('#phaseRoot');
const saveStatus = document.querySelector('#saveStatus');
const exportPhaseBtn = document.querySelector('#exportPhaseBtn');
const exportWorkspaceBtn = document.querySelector('#exportWorkspaceBtn');
const importFile = document.querySelector('#importFile');
const resetBtn = document.querySelector('#resetBtn');
const projectsBtn = document.querySelector('#projectsBtn');
const settingsBtn = document.querySelector('#settingsBtn');
const signOutBtn = document.querySelector('#signOutBtn');

function setStatus(message) {
  saveStatus.textContent = message;
}

// Debounce handle for the remote save — avoids hitting the API on every keystroke.
let _saveTimer = null;

async function _persistRemote() {
  if (!state.projectId || !state.token) return;
  try {
    await saveWorkspaceRemote(state.projectId, state.workspace, state.token);
    setStatus(`Saved ${new Date().toLocaleTimeString()}`);
  } catch (err) {
    setStatus('Remote save failed — changes kept locally');
    console.error('Remote save error:', err);
  }
}

function persist() {
  // Always write to localStorage immediately so no work is ever lost.
  state.workspace = saveWorkspace(state.workspace);

  if (state.projectId && state.token) {
    // Debounce the API call so rapid edits produce one save, not dozens.
    setStatus('Saving…');
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_persistRemote, 2000);
  } else {
    setStatus(`Saved locally ${new Date().toLocaleTimeString()}`);
  }

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
    if (!confirm('Importing replaces the current workspace. Continue?')) return;
    state.workspace = replaceWorkspace(imported);

    // If we have a project context, also push to the API immediately.
    if (state.projectId && state.token) {
      setStatus('Importing…');
      try {
        await saveWorkspaceRemote(state.projectId, state.workspace, state.token);
        setStatus('Imported and saved');
      } catch {
        setStatus('Imported locally — remote save failed');
      }
    } else {
      setStatus('Imported workspace and saved locally');
    }
    render();
  } catch (error) {
    alert(error.message);
  }
});

resetBtn.addEventListener('click', () => {
  if (!confirm('Reset this workspace? Clears local browser data. Server data is untouched.')) return;
  state.workspace = resetWorkspace();
  setStatus('Workspace reset locally');
  render();
});

// ---------------------------------------------------------------------------
// Startup: auth check + remote load
// ---------------------------------------------------------------------------
async function init() {
  const session = await getSession();
  const projectId = new URLSearchParams(window.location.search).get('project');

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  state.token = session.access_token;

  if (projectsBtn) projectsBtn.addEventListener('click', () => { window.location.href = 'projects.html'; });
  if (settingsBtn) settingsBtn.addEventListener('click', () => {
    if (state.projectId) window.location.href = `settings.html?project=${state.projectId}`;
    else alert('Open a project first to access its settings.');
  });
  if (signOutBtn) signOutBtn.addEventListener('click', async () => { await signOut(); window.location.href = 'login.html'; });

  if (session && projectId) {
    state.projectId = projectId;
    setStatus('Loading…');
    try {
      const remote = await loadWorkspaceRemote(projectId, session.access_token);
      if (remote) {
        state.workspace = remote;
        setStatus('Loaded from server');
      } else {
        // No snapshot on the server yet — start clean, ignoring any leftover localStorage data.
        state.workspace = createDefaultWorkspace();
        setStatus('New project');
      }
    } catch (err) {
      console.error('Remote load error:', err);
      setStatus('Could not load from server — showing local data');
    }
  } else {
    // Logged in but no project in URL — localStorage mode until a project is opened.
    setStatus('Loaded from browser storage');
  }

  render();
}

init();
