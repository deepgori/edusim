/**
 * hud.js — In-simulation HUD overlay panels
 * Renders contextual information and controls for each simulation type
 */
const HUD = (() => {
  let currentSim = null;
  let updateCallbacks = {};

  function render(simType, config = {}) {
    const overlay = document.getElementById('hud-overlay');
    overlay.innerHTML = '';
    currentSim = simType;

    switch (simType) {
      case 'chemistry':
        renderChemistryHUD(overlay, config);
        break;
      case 'physics':
        renderPhysicsHUD(overlay, config);
        break;
      case 'anatomy':
        renderAnatomyHUD(overlay, config);
        break;
    }
  }

  function renderChemistryHUD(overlay, config) {
    // Info panel - top left
    const infoPanel = createPanel('hud-top-left', 'Lab Status');
    infoPanel.innerHTML += `
      <div class="info-item">
        <div class="info-icon green">🌡</div>
        <div class="info-text"><strong id="hud-temp">25°C</strong> Temperature</div>
      </div>
      <div class="info-item">
        <div class="info-icon blue">⚗</div>
        <div class="info-text"><strong id="hud-ph">7.0</strong> pH Level</div>
      </div>
      <div class="info-item">
        <div class="info-icon orange">⚡</div>
        <div class="info-text"><strong id="hud-reaction">Idle</strong> State</div>
      </div>
    `;
    overlay.appendChild(infoPanel);

    // Controls - top right
    const controlPanel = createPanel('hud-top-right', 'Chemical Selector');
    controlPanel.innerHTML += `
      <div class="control-group">
        <div class="control-label">Select Chemical A</div>
        <div class="control-btn-group">
          <button class="control-btn active" data-chem="a" data-value="acid" onclick="HUD.onChemSelect(this)">HCl</button>
          <button class="control-btn" data-chem="a" data-value="base" onclick="HUD.onChemSelect(this)">NaOH</button>
          <button class="control-btn" data-chem="a" data-value="water" onclick="HUD.onChemSelect(this)">H₂O</button>
        </div>
      </div>
      <div class="control-group">
        <div class="control-label">Select Chemical B</div>
        <div class="control-btn-group">
          <button class="control-btn" data-chem="b" data-value="sodium" onclick="HUD.onChemSelect(this)">Na</button>
          <button class="control-btn active" data-chem="b" data-value="indicator" onclick="HUD.onChemSelect(this)">Indicator</button>
          <button class="control-btn" data-chem="b" data-value="catalyst" onclick="HUD.onChemSelect(this)">Catalyst</button>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" style="width:100%; margin-top: 8px;" id="hud-mix-btn" onclick="HUD.triggerMix()">
        🧪 Mix Chemicals
      </button>
    `;
    overlay.appendChild(controlPanel);

    // Safety panel - bottom left
    const safetyPanel = createPanel('hud-bottom-left', 'Safety Alerts');
    safetyPanel.id = 'hud-safety';
    safetyPanel.innerHTML += `
      <div class="info-item">
        <div class="info-icon green">✓</div>
        <div class="info-text">Goggles: <strong>On</strong></div>
      </div>
      <div class="info-item">
        <div class="info-icon green">✓</div>
        <div class="info-text">Ventilation: <strong>Active</strong></div>
      </div>
      <div class="info-item" id="hud-hazard-item">
        <div class="info-icon green">✓</div>
        <div class="info-text">Hazard Level: <strong id="hud-hazard">Low</strong></div>
      </div>
    `;
    overlay.appendChild(safetyPanel);
  }

  function renderPhysicsHUD(overlay, config) {
    // Parameters - top left
    const paramPanel = createPanel('hud-top-left', 'Launch Parameters');
    paramPanel.innerHTML += `
      <div class="control-group">
        <div class="control-label">
          <span>Angle</span>
          <span class="control-value" id="hud-angle-val">45°</span>
        </div>
        <input type="range" class="control-slider" id="hud-angle" min="5" max="85" value="45"
          oninput="HUD.onPhysicsParam('angle', this.value)">
      </div>
      <div class="control-group">
        <div class="control-label">
          <span>Velocity</span>
          <span class="control-value" id="hud-velocity-val">20 m/s</span>
        </div>
        <input type="range" class="control-slider" id="hud-velocity" min="5" max="50" value="20"
          oninput="HUD.onPhysicsParam('velocity', this.value)">
      </div>
      <div class="control-group">
        <div class="control-label">
          <span>Gravity</span>
          <span class="control-value" id="hud-gravity-val">9.8 m/s²</span>
        </div>
        <input type="range" class="control-slider" id="hud-gravity" min="1" max="25" value="9.8" step="0.1"
          oninput="HUD.onPhysicsParam('gravity', this.value)">
      </div>
      <button class="btn btn-primary btn-sm" style="width:100%; margin-top: 8px;" onclick="HUD.triggerLaunch()">
        🚀 Launch Projectile
      </button>
    `;
    overlay.appendChild(paramPanel);

    // Real-time data - top right
    const dataPanel = createPanel('hud-top-right', 'Real-Time Data');
    dataPanel.innerHTML += `
      <div class="info-item">
        <div class="info-icon blue">📍</div>
        <div class="info-text">Position: <strong id="hud-pos">0, 0</strong></div>
      </div>
      <div class="info-item">
        <div class="info-icon purple">🏃</div>
        <div class="info-text">Speed: <strong id="hud-speed">0 m/s</strong></div>
      </div>
      <div class="info-item">
        <div class="info-icon green">📏</div>
        <div class="info-text">Max Height: <strong id="hud-max-h">0 m</strong></div>
      </div>
      <div class="info-item">
        <div class="info-icon orange">📐</div>
        <div class="info-text">Range: <strong id="hud-range">0 m</strong></div>
      </div>
    `;
    overlay.appendChild(dataPanel);

    // Trajectory comparison - bottom right
    const trajPanel = createPanel('hud-bottom-right', 'Trajectories');
    trajPanel.innerHTML += `
      <div class="control-btn-group">
        <button class="control-btn active" onclick="HUD.onTrajectoryMode('single')">Single</button>
        <button class="control-btn" onclick="HUD.onTrajectoryMode('compare')">Compare</button>
      </div>
      <div style="margin-top: 8px;">
        <div class="info-item">
          <div class="info-icon blue">●</div>
          <div class="info-text"><strong id="hud-traj-count">0</strong> trajectories</div>
        </div>
      </div>
    `;
    overlay.appendChild(trajPanel);
  }

  function renderAnatomyHUD(overlay, config) {
    // Search bar - top center
    const searchPanel = document.createElement('div');
    searchPanel.className = 'hud-panel hud-top-center';
    searchPanel.innerHTML = `
      <div class="anatomy-search-container">
        <input type="text" class="anatomy-search-input" id="anatomy-search" 
          placeholder="🔍 Search anatomy (e.g. femur, biceps...)"
          onkeyup="if(event.key==='Enter') HUD.onAnatomySearch(this.value)">
        <button class="anatomy-search-btn" onclick="HUD.onAnatomySearch(document.getElementById('anatomy-search').value)">Search</button>
      </div>
    `;
    overlay.appendChild(searchPanel);

    // Layer controls - top left
    const layerPanel = createPanel('hud-top-left', 'Body Systems');
    layerPanel.innerHTML += `
      <div class="control-group">
        <div class="control-btn-group" style="flex-direction: column; gap: 6px;">
          <button class="control-btn active" data-layer="muscles" onclick="HUD.onLayerToggle(this)">💪 Muscles</button>
          <button class="control-btn active" data-layer="bones" onclick="HUD.onLayerToggle(this)">🦴 Bones</button>
          <button class="control-btn" data-layer="organs" onclick="HUD.onLayerToggle(this)">🫀 Organs</button>
        </div>
        <div style="margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 10px; display: flex; flex-direction: column; gap: 6px;">
          <button class="control-btn" id="see-inside-btn" onclick="HUD.onSeeInsideToggle(this)" style="width:100%;">👁️ See Inside</button>
          <button class="control-btn" id="xray-btn" onclick="HUD.onXRayToggle(this)" style="width:100%;">🔬 X-Ray Mode</button>
        </div>
        <div style="margin-top: 8px; font-size: 0.65rem; color: var(--text-muted); line-height: 1.4;">
          💡 "See Inside" reveals organs and bones through muscles
        </div>
      </div>
    `;
    overlay.appendChild(layerPanel);

    // Info panel - top right
    const infoPanel = createPanel('hud-top-right', 'Selected Structure');
    infoPanel.id = 'hud-anatomy-info';
    infoPanel.innerHTML += `
      <div style="text-align: center; padding: 12px 0; color: var(--text-muted); font-size: 0.8rem;">
        Click on a body part to see details
      </div>
    `;
    overlay.appendChild(infoPanel);

    // View controls - bottom right
    const viewPanel = createPanel('hud-bottom-right', 'View Controls');
    viewPanel.innerHTML += `
      <div class="control-group">
        <div class="control-label">
          <span>Muscle Opacity</span>
          <span class="control-value" id="hud-opacity-val">100%</span>
        </div>
        <input type="range" class="control-slider" id="hud-opacity" min="10" max="100" value="100"
          oninput="HUD.onAnatomyParam('opacity', this.value)">
      </div>
      <div class="control-btn-group" style="margin-top: 8px;">
        <button class="control-btn" onclick="HUD.onAnatomyView('front')">Front</button>
        <button class="control-btn active" onclick="HUD.onAnatomyView('3d')">3D</button>
        <button class="control-btn" onclick="HUD.onAnatomyView('back')">Back</button>
      </div>
    `;
    overlay.appendChild(viewPanel);
  }

  function createPanel(posClass, title) {
    const panel = document.createElement('div');
    panel.className = `hud-panel ${posClass}`;
    panel.innerHTML = `<div class="hud-panel-title">${title}</div>`;
    return panel;
  }

  // ---- Event Handlers (registered by simulations) ----
  function onCallback(name, fn) {
    updateCallbacks[name] = fn;
  }

  function emit(name, ...args) {
    if (updateCallbacks[name]) {
      updateCallbacks[name](...args);
    }
  }

  function onChemSelect(btn) {
    const group = btn.dataset.chem;
    btn.parentElement.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    emit('chemSelect', group, btn.dataset.value);
  }

  function triggerMix() {
    emit('chemMix');
  }

  function onPhysicsParam(param, value) {
    const labels = {
      angle: { el: 'hud-angle-val', suffix: '°' },
      velocity: { el: 'hud-velocity-val', suffix: ' m/s' },
      gravity: { el: 'hud-gravity-val', suffix: ' m/s²' }
    };
    if (labels[param]) {
      document.getElementById(labels[param].el).textContent = value + labels[param].suffix;
    }
    emit('physicsParam', param, parseFloat(value));
  }

  function triggerLaunch() {
    emit('physicsLaunch');
  }

  function onTrajectoryMode(mode) {
    emit('trajectoryMode', mode);
  }

  function onLayerToggle(btn) {
    btn.classList.toggle('active');
    emit('layerToggle', btn.dataset.layer, btn.classList.contains('active'));
  }

  function onAnatomyParam(param, value) {
    if (param === 'opacity') {
      document.getElementById('hud-opacity-val').textContent = value + '%';
    }
    emit('anatomyParam', param, parseFloat(value));
  }

  function onAnatomyView(view) {
    emit('anatomyView', view);
  }

  function onXRayToggle(btn) {
    btn.classList.toggle('active');
    // If enabling X-ray, disable See Inside
    const seeBtn = document.getElementById('see-inside-btn');
    if (btn.classList.contains('active') && seeBtn && seeBtn.classList.contains('active')) {
      seeBtn.classList.remove('active');
      emit('seeInsideToggle', false);
    }
    emit('xrayToggle', btn.classList.contains('active'));
  }

  function onSeeInsideToggle(btn) {
    btn.classList.toggle('active');
    // If enabling See Inside, disable X-ray
    const xrayBtn = document.getElementById('xray-btn');
    if (btn.classList.contains('active') && xrayBtn && xrayBtn.classList.contains('active')) {
      xrayBtn.classList.remove('active');
      emit('xrayToggle', false);
    }
    emit('seeInsideToggle', btn.classList.contains('active'));
  }

  function onAnatomySearch(query) {
    emit('anatomySearch', query);
  }

  function updateAnatomyInfo(info) {
    const panel = document.getElementById('hud-anatomy-info');
    if (!panel) return;
    // Keep the title
    const title = panel.querySelector('.hud-panel-title');
    panel.innerHTML = '';
    panel.appendChild(title);
    panel.innerHTML += `
      <div style="margin-top: 4px;">
        <div style="font-weight: 700; font-size: 1rem; margin-bottom: 4px;">${info.name}</div>
        <div style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.5;">${info.description}</div>
        <div style="margin-top: 8px; display: flex; gap: 4px; flex-wrap: wrap;">
          ${info.tags.map(t => `<span class="sim-tag">${t}</span>`).join('')}
        </div>
      </div>
    `;
  }

  function clear() {
    const overlay = document.getElementById('hud-overlay');
    if (overlay) overlay.innerHTML = '';
    currentSim = null;
    updateCallbacks = {};
  }

  return {
    render, clear,
    onCallback, emit,
    onChemSelect, triggerMix,
    onPhysicsParam, triggerLaunch,
    onTrajectoryMode,
    onLayerToggle, onAnatomyParam, onAnatomyView,
    onXRayToggle, onSeeInsideToggle, onAnatomySearch,
    updateAnatomyInfo
  };
})();
