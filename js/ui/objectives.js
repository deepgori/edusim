/**
 * objectives.js — Learning Objectives tracking system
 * Provides per-simulation goal tracking with visual progress feedback
 */
const Objectives = (() => {
  let currentObjectives = [];
  let panelEl = null;

  const objectivesDef = {
    chemistry: [
      { id: 'select_chem', label: 'Select chemicals', completed: false },
      { id: 'drag_beaker', label: 'Drag a beaker', completed: false },
      { id: 'mix_reaction', label: 'Complete a reaction', completed: false },
      { id: 'observe_temp', label: 'Observe temperature change', completed: false },
      { id: 'try_exo', label: 'Trigger exothermic reaction', completed: false }
    ],
    physics: [
      { id: 'adjust_angle', label: 'Adjust launch angle', completed: false },
      { id: 'launch', label: 'Launch a projectile', completed: false },
      { id: 'observe_height', label: 'Reach 5m+ height', completed: false },
      { id: 'hit_target', label: 'Hit the target zone', completed: false },
      { id: 'compare', label: 'Compare 2+ trajectories', completed: false }
    ],
    anatomy: [
      { id: 'inspect_part', label: 'Click a body part', completed: false },
      { id: 'toggle_layer', label: 'Toggle a layer', completed: false },
      { id: 'view_skeleton', label: 'View skeleton', completed: false },
      { id: 'view_organs', label: 'View organs', completed: false },
      { id: 'explore_3', label: 'Explore 3+ organs', completed: false }
    ]
  };

  function init(simType) {
    currentObjectives = (objectivesDef[simType] || []).map(o => ({ ...o, completed: false }));
    render();
  }

  function render() {
    const container = document.getElementById('sim-canvas-container');
    if (!container) return;

    // Remove existing panel
    if (panelEl) { panelEl.remove(); panelEl = null; }

    const completed = currentObjectives.filter(o => o.completed).length;
    const total = currentObjectives.length;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    panelEl = document.createElement('div');
    panelEl.className = 'objectives-panel';
    panelEl.innerHTML = `
      <div class="obj-header">
        <div class="obj-title">🎯 Learning Objectives</div>
        <div class="obj-progress">${completed}/${total}</div>
      </div>
      <div class="obj-bar"><div class="obj-bar-fill" style="width: ${pct}%"></div></div>
      <ul class="obj-list">
        ${currentObjectives.map(o => `
          <li class="obj-item ${o.completed ? 'completed' : ''}" data-id="${o.id}">
            <span class="obj-check">${o.completed ? '✓' : ''}</span>
            <span>${o.label}</span>
          </li>
        `).join('')}
      </ul>
    `;
    container.appendChild(panelEl);
  }

  function complete(objectiveId) {
    const obj = currentObjectives.find(o => o.id === objectiveId);
    if (!obj || obj.completed) return;

    obj.completed = true;
    render();

    // Flash the just-completed item
    if (panelEl) {
      const item = panelEl.querySelector(`[data-id="${objectiveId}"]`);
      if (item) {
        item.classList.add('just-completed');
        setTimeout(() => item.classList.remove('just-completed'), 500);
      }
    }

    // Check if all complete
    const allDone = currentObjectives.every(o => o.completed);
    if (allDone) {
      setTimeout(() => {
        Notifications.success('🏆 All Objectives Complete!', 'Outstanding work — you\'ve mastered this simulation.');
      }, 600);
    }

    Analytics.trackEvent('objectives', 'complete', { id: objectiveId });
  }

  function isCompleted(objectiveId) {
    const obj = currentObjectives.find(o => o.id === objectiveId);
    return obj ? obj.completed : false;
  }

  function clear() {
    if (panelEl) { panelEl.remove(); panelEl = null; }
    currentObjectives = [];
  }

  return { init, complete, isCompleted, clear };
})();
