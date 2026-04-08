/**
 * physics.js — Projectile Motion Physics Sandbox
 * Features: adjustable launch params, trajectory viz, comparison mode, energy display
 */
const PhysicsSim = (() => {
  let objects = {};
  let trajectories = [];
  let currentTrajectory = null;
  let params = { angle: 45, velocity: 20, gravity: 9.8 };
  let animState = { active: false, t: 0, ball: null, trail: [], maxH: 0, range: 0 };
  let scene;
  let compareMode = false;
  const trailColors = [0x3b82f6, 0x10b981, 0xf59e0b, 0xa855f7, 0xec4899, 0x22d3ee];

  function init(sceneRef) {
    scene = sceneRef;
    buildEnvironment();
    registerHUD();
    Notifications.success('Physics Sandbox', 'Set launch parameters and fire!');
  }

  function buildEnvironment() {
    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(40, 20);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x141825, roughness: 0.9 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Grid
    const grid = new THREE.GridHelper(40, 80, 0x1e3a5f, 0x111520);
    grid.position.y = 0.01;
    scene.add(grid);

    // Axis markers (distance markers on ground)
    for (let d = 5; d <= 35; d += 5) {
      const markerGeo = new THREE.BoxGeometry(0.05, 0.15, 0.3);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.5 });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.position.set(d - 15, 0.075, 0);
      scene.add(marker);
    }

    // Launch platform
    const platGeo = new THREE.BoxGeometry(1.5, 0.3, 1.5);
    const platMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3e, metalness: 0.4, roughness: 0.5 });
    const platform = new THREE.Mesh(platGeo, platMat);
    platform.position.set(-8, 0.15, 0);
    platform.castShadow = true;
    scene.add(platform);
    objects.platform = platform;

    // Cannon barrel
    const barrelGeo = new THREE.CylinderGeometry(0.12, 0.18, 1.5, 8);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.2 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.set(-8, 0.6, 0);
    barrel.rotation.z = EduUtils.degToRad(90 - params.angle);
    scene.add(barrel);
    objects.barrel = barrel;

    // Cannon base
    const baseGeo = new THREE.CylinderGeometry(0.3, 0.35, 0.2, 12);
    const base = new THREE.Mesh(baseGeo, barrelMat.clone());
    base.position.set(-8, 0.35, 0);
    scene.add(base);

    // Projectile ball
    const ballGeo = new THREE.SphereGeometry(0.2, 16, 16);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1e40af, emissiveIntensity: 0.4 });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.set(-8, 0.6, 0);
    ball.castShadow = true;
    scene.add(ball);
    objects.ball = ball;

    // Ball glow
    const glowGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.1 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    ball.add(glow);
    objects.glow = glow;

    // Target zone
    const targetGeo = new THREE.RingGeometry(0.4, 0.6, 24);
    const targetMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide, transparent: true, opacity: 0.6 });
    const target = new THREE.Mesh(targetGeo, targetMat);
    target.rotation.x = -Math.PI / 2;
    target.position.set(10, 0.02, 0);
    scene.add(target);
    objects.target = target;

    // Inner target
    const innerTarget = new THREE.Mesh(
      new THREE.RingGeometry(0.1, 0.25, 24),
      new THREE.MeshBasicMaterial({ color: 0xfbbf24, side: THREE.DoubleSide, transparent: true, opacity: 0.8 })
    );
    innerTarget.rotation.x = -Math.PI / 2;
    innerTarget.position.set(10, 0.03, 0);
    scene.add(innerTarget);

    // Height reference lines
    for (let h = 2; h <= 10; h += 2) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-10, h, -0.5),
        new THREE.Vector3(15, h, -0.5)
      ]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x1e3a5f, transparent: true, opacity: 0.2 });
      scene.add(new THREE.Line(lineGeo, lineMat));
    }

    // Set camera
    const camera = SceneManager.getCamera();
    camera.position.set(0, 6, 14);
    camera.lookAt(0, 2, 0);
  }

  function registerHUD() {
    HUD.onCallback('physicsParam', (param, value) => {
      params[param] = value;
      if (param === 'angle' && objects.barrel) {
        objects.barrel.rotation.z = EduUtils.degToRad(90 - value);
        Objectives.complete('adjust_angle');
      }
      // Update predicted range
      updatePrediction();
    });

    HUD.onCallback('physicsLaunch', () => {
      launchProjectile();
    });

    HUD.onCallback('trajectoryMode', (mode) => {
      compareMode = mode === 'compare';
      if (!compareMode) {
        // Clear old trajectories
        clearTrajectories();
      }
    });

    updatePrediction();
  }

  function updatePrediction() {
    const { angle, velocity, gravity } = params;
    const angleRad = EduUtils.degToRad(angle);
    const predictedRange = (velocity * velocity * Math.sin(2 * angleRad)) / gravity;
    const predictedMaxH = (velocity * velocity * Math.sin(angleRad) * Math.sin(angleRad)) / (2 * gravity);

    // Move target to predicted landing
    if (objects.target) {
      objects.target.position.x = -8 + predictedRange;
    }
  }

  function launchProjectile() {
    if (animState.active) return;

    if (!compareMode) clearTrajectories();

    const { angle, velocity, gravity } = params;
    const angleRad = EduUtils.degToRad(angle);
    const vx = velocity * Math.cos(angleRad);
    const vy = velocity * Math.sin(angleRad);

    animState = {
      active: true,
      t: 0,
      startX: -8,
      startY: 0.6,
      vx, vy, gravity,
      maxH: 0,
      range: 0,
      trail: []
    };

    // Color for this trajectory
    const colorIdx = trajectories.length % trailColors.length;
    animState.color = trailColors[colorIdx];

    objects.ball.material.color.setHex(animState.color);
    objects.ball.material.emissive.setHex(animState.color);

    Notifications.info('Launched!', `Angle: ${angle}°, Velocity: ${velocity} m/s`);
    Analytics.trackEvent('physics', 'launch', { angle, velocity, gravity });
    Objectives.complete('launch');
  }

  function clearTrajectories() {
    trajectories.forEach(traj => {
      if (traj.line) {
        scene.remove(traj.line);
        traj.line.geometry.dispose();
        traj.line.material.dispose();
      }
    });
    trajectories = [];
    const countEl = document.getElementById('hud-traj-count');
    if (countEl) countEl.textContent = '0';
  }

  function update(sceneRef, camera) {
    const t = Date.now() * 0.001;

    // Target pulse
    if (objects.target) {
      objects.target.material.opacity = 0.4 + Math.sin(t * 2) * 0.2;
    }

    // Glow pulse
    if (objects.glow) {
      objects.glow.material.opacity = 0.05 + Math.sin(t * 3) * 0.05;
    }

    // Projectile animation
    if (animState.active) {
      animState.t += 0.016 * 2; // Time step (scaled for visibility)
      const dt = animState.t;

      const x = animState.startX + animState.vx * dt;
      const y = animState.startY + animState.vy * dt - 0.5 * animState.gravity * dt * dt;

      if (y <= 0 && dt > 0.1) {
        // Hit ground
        objects.ball.position.set(x, 0.2, 0);
        animState.active = false;
        animState.range = x - animState.startX;

        // Save trajectory
        saveFinalTrajectory();

        const rangeEl = document.getElementById('hud-range');
        if (rangeEl) rangeEl.textContent = `${animState.range.toFixed(1)} m`;

        Notifications.success('Impact!', `Range: ${animState.range.toFixed(1)}m, Max Height: ${animState.maxH.toFixed(1)}m`);

        // Check objectives
        if (animState.maxH >= 5) Objectives.complete('observe_height');
        // Check if close to target center
        if (objects.target) {
          const targetDist = Math.abs(objects.ball.position.x - objects.target.position.x);
          if (targetDist < 1.5) Objectives.complete('hit_target');
        }
      } else {
        objects.ball.position.set(x, Math.max(y, 0.2), 0);

        if (y > animState.maxH) animState.maxH = y;

        // Add trail point
        animState.trail.push(new THREE.Vector3(x, Math.max(y, 0.2), 0));

        // Update live trail
        updateLiveTrail();

        // Update HUD
        const posEl = document.getElementById('hud-pos');
        const speedEl = document.getElementById('hud-speed');
        const maxHEl = document.getElementById('hud-max-h');
        const rangeEl = document.getElementById('hud-range');

        const currentVy = animState.vy - animState.gravity * dt;
        const speed = Math.sqrt(animState.vx * animState.vx + currentVy * currentVy);

        if (posEl) posEl.textContent = `${(x + 8).toFixed(1)}, ${y.toFixed(1)}`;
        if (speedEl) speedEl.textContent = `${speed.toFixed(1)} m/s`;
        if (maxHEl) maxHEl.textContent = `${animState.maxH.toFixed(1)} m`;
        if (rangeEl) rangeEl.textContent = `${(x - animState.startX).toFixed(1)} m`;
      }
    }
  }

  function updateLiveTrail() {
    // Remove old live trail
    if (currentTrajectory) {
      scene.remove(currentTrajectory);
      currentTrajectory.geometry.dispose();
      currentTrajectory.material.dispose();
    }

    if (animState.trail.length < 2) return;

    const geometry = new THREE.BufferGeometry().setFromPoints(animState.trail);
    const material = new THREE.LineBasicMaterial({ color: animState.color, transparent: true, opacity: 0.7, linewidth: 2 });
    currentTrajectory = new THREE.Line(geometry, material);
    scene.add(currentTrajectory);
  }

  function saveFinalTrajectory() {
    if (currentTrajectory) {
      scene.remove(currentTrajectory);
      currentTrajectory.geometry.dispose();
      currentTrajectory.material.dispose();
      currentTrajectory = null;
    }

    if (animState.trail.length < 2) return;

    // Create tube for nicer trail
    const curve = new THREE.CatmullRomCurve3(animState.trail);
    const tubeGeo = new THREE.TubeGeometry(curve, Math.min(animState.trail.length, 100), 0.04, 6, false);
    const tubeMat = new THREE.MeshBasicMaterial({ color: animState.color, transparent: true, opacity: 0.5 });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(tube);

    trajectories.push({ line: tube, params: { ...params }, maxH: animState.maxH, range: animState.range });

    if (trajectories.length >= 2) Objectives.complete('compare');

    const countEl = document.getElementById('hud-traj-count');
    if (countEl) countEl.textContent = trajectories.length.toString();
  }

  function reset() {
    animState = { active: false, t: 0, trail: [], maxH: 0, range: 0 };
    if (objects.ball) objects.ball.position.set(-8, 0.6, 0);
    clearTrajectories();
    if (currentTrajectory) {
      scene.remove(currentTrajectory);
      currentTrajectory.geometry.dispose();
      currentTrajectory.material.dispose();
      currentTrajectory = null;
    }
    ['hud-pos', 'hud-speed', 'hud-max-h', 'hud-range'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = id === 'hud-pos' ? '0, 0' : '0';
    });
    Notifications.info('Reset', 'Physics sandbox reset');
  }

  function cleanup() {
    clearTrajectories();
    if (currentTrajectory) {
      scene.remove(currentTrajectory);
      currentTrajectory.geometry.dispose();
      currentTrajectory.material.dispose();
      currentTrajectory = null;
    }
    objects = {};
  }

  return { init, update, reset, cleanup };
})();
