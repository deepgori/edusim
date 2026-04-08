/**
 * sceneManager.js — Three.js scene lifecycle manager
 * Handles scene creation, camera, renderer, controls, and animation loop
 */
const SceneManager = (() => {
  let scene, camera, renderer, controls, css2dRenderer;
  let animationId = null;
  let updateCallback = null;
  let isRunning = false;

  // Preview scenes for landing page cards
  const previews = {};

  function initMain(container, canvas) {
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0a0e1a, 0.015);

    camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 3, 8);

    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x0a0e1a, 1);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 25;
    controls.maxPolarAngle = Math.PI * 0.85;

    // Ambient light
    const ambient = new THREE.AmbientLight(0x404060, 0.4);
    scene.add(ambient);

    // Main directional light
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 10, 5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Fill light
    const fillLight = new THREE.DirectionalLight(0x3b82f6, 0.3);
    fillLight.position.set(-5, 3, -5);
    scene.add(fillLight);

    // CSS2D Renderer for floating labels
    if (typeof THREE.CSS2DRenderer !== 'undefined') {
      css2dRenderer = new THREE.CSS2DRenderer();
      css2dRenderer.setSize(container.clientWidth, container.clientHeight);
      css2dRenderer.domElement.style.position = 'absolute';
      css2dRenderer.domElement.style.top = '0';
      css2dRenderer.domElement.style.left = '0';
      css2dRenderer.domElement.style.pointerEvents = 'none';
      css2dRenderer.domElement.id = 'css2d-overlay';
      container.appendChild(css2dRenderer.domElement);
    }

    window.addEventListener('resize', onResize);
    return { scene, camera, renderer, controls };
  }

  function onResize() {
    const container = document.getElementById('sim-canvas-container');
    if (!container || !camera || !renderer) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
    if (css2dRenderer) css2dRenderer.setSize(container.clientWidth, container.clientHeight);
  }

  function startLoop(callback) {
    updateCallback = callback;
    isRunning = true;
    animate();
  }

  function animate() {
    if (!isRunning) return;
    animationId = requestAnimationFrame(animate);
    if (controls) controls.update();
    if (updateCallback) updateCallback(scene, camera);
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
      if (css2dRenderer) css2dRenderer.render(scene, camera);
    }
  }

  function stopLoop() {
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    updateCallback = null;
  }

  function clearScene() {
    if (!scene) return;
    // Remove all objects except lights
    const toRemove = [];
    scene.traverse(child => {
      if (child !== scene && !(child instanceof THREE.Light)) {
        toRemove.push(child);
      }
    });
    toRemove.forEach(obj => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => m.dispose());
        } else {
          obj.material.dispose();
        }
      }
      scene.remove(obj);
    });
  }

  function destroy() {
    stopLoop();
    clearScene();
    if (renderer) renderer.dispose();
    if (controls) controls.dispose();
    if (css2dRenderer && css2dRenderer.domElement) {
      css2dRenderer.domElement.remove();
    }
    window.removeEventListener('resize', onResize);
    scene = camera = renderer = controls = css2dRenderer = null;
  }

  function getScene() { return scene; }
  function getCamera() { return camera; }
  function getRenderer() { return renderer; }
  function getControls() { return controls; }
  function getCSS2DRenderer() { return css2dRenderer; }

  // ---- Preview Scenes (mini 3D in landing page cards) ----
  function initPreview(canvasId, type) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;

    const pScene = new THREE.Scene();
    const pCamera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    const pRenderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    pRenderer.setSize(w, h);
    pRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    pRenderer.setClearColor(0x0a0e1a, 0);

    const pAmbient = new THREE.AmbientLight(0x404060, 0.6);
    pScene.add(pAmbient);
    const pDir = new THREE.DirectionalLight(0xffffff, 0.7);
    pDir.position.set(3, 5, 3);
    pScene.add(pDir);

    let objects = [];

    if (type === 'chemistry') {
      pCamera.position.set(0, 2, 5);
      objects = createChemPreview(pScene);
    } else if (type === 'physics') {
      pCamera.position.set(0, 2, 6);
      objects = createPhysPreview(pScene);
    } else if (type === 'anatomy') {
      pCamera.position.set(0, 1, 5);
      objects = createAnatPreview(pScene);
    }

    pCamera.lookAt(0, 1, 0);

    previews[type] = { scene: pScene, camera: pCamera, renderer: pRenderer, objects };
  }

  function createChemPreview(scene) {
    const objects = [];
    // Beaker
    const beakerGeo = new THREE.CylinderGeometry(0.6, 0.5, 1.8, 16, 1, true);
    const beakerMat = new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transparent: true, opacity: 0.25, roughness: 0.1, metalness: 0 });
    const beaker = new THREE.Mesh(beakerGeo, beakerMat);
    beaker.position.set(-1.2, 0.9, 0);
    scene.add(beaker);
    objects.push(beaker);

    // Liquid in beaker
    const liquidGeo = new THREE.CylinderGeometry(0.55, 0.45, 1.0, 16);
    const liquidMat = new THREE.MeshPhysicalMaterial({ color: 0x10b981, transparent: true, opacity: 0.6, roughness: 0.3 });
    const liquid = new THREE.Mesh(liquidGeo, liquidMat);
    liquid.position.set(-1.2, 0.5, 0);
    scene.add(liquid);
    objects.push(liquid);

    // Flask
    const flaskGeo = new THREE.SphereGeometry(0.6, 16, 16);
    const flaskMat = new THREE.MeshPhysicalMaterial({ color: 0xaaddff, transparent: true, opacity: 0.2, roughness: 0.1 });
    const flask = new THREE.Mesh(flaskGeo, flaskMat);
    flask.position.set(1.0, 0.8, 0);
    scene.add(flask);
    objects.push(flask);

    // Flask liquid
    const flLiqGeo = new THREE.SphereGeometry(0.45, 16, 12);
    const flLiqMat = new THREE.MeshPhysicalMaterial({ color: 0xa855f7, transparent: true, opacity: 0.5 });
    const flLiq = new THREE.Mesh(flLiqGeo, flLiqMat);
    flLiq.position.set(1.0, 0.6, 0);
    scene.add(flLiq);
    objects.push(flLiq);

    // Bubbles
    for (let i = 0; i < 8; i++) {
      const bubGeo = new THREE.SphereGeometry(0.06 + Math.random() * 0.06, 8, 8);
      const bubMat = new THREE.MeshPhysicalMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.4 });
      const bub = new THREE.Mesh(bubGeo, bubMat);
      bub.position.set(-1.2 + (Math.random() - 0.5) * 0.6, 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4);
      bub.userData.speed = 0.003 + Math.random() * 0.005;
      bub.userData.baseY = bub.position.y;
      scene.add(bub);
      objects.push(bub);
    }

    return objects;
  }

  function createPhysPreview(scene) {
    const objects = [];
    // Ground
    const groundGeo = new THREE.PlaneGeometry(10, 6);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a2035, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    scene.add(ground);

    // Grid lines
    const gridHelper = new THREE.GridHelper(10, 20, 0x1e3a5f, 0x1e3a5f);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Cannon
    const cannonGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.2, 8);
    const cannonMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.3 });
    const cannon = new THREE.Mesh(cannonGeo, cannonMat);
    cannon.position.set(-3, 0.5, 0);
    cannon.rotation.z = Math.PI / 4;
    scene.add(cannon);
    objects.push(cannon);

    // Projectile ball
    const ballGeo = new THREE.SphereGeometry(0.2, 12, 12);
    const ballMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1e40af, emissiveIntensity: 0.3 });
    const ball = new THREE.Mesh(ballGeo, ballMat);
    ball.position.set(-2.5, 1.2, 0);
    scene.add(ball);
    objects.push(ball);

    // Trail
    const trailPoints = [];
    for (let t = 0; t < 50; t++) {
      const x = -2.5 + t * 0.14;
      const y = 1.2 + t * 0.12 * Math.sin(Math.PI / 4) - 0.5 * 0.02 * t * t;
      if (y < 0) break;
      trailPoints.push(new THREE.Vector3(x, y, 0));
    }
    if (trailPoints.length > 1) {
      const curve = new THREE.CatmullRomCurve3(trailPoints);
      const tubeGeo = new THREE.TubeGeometry(curve, 30, 0.03, 6, false);
      const tubeMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4 });
      const tube = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tube);
      objects.push(tube);
    }

    // Target
    const targetGeo = new THREE.RingGeometry(0.3, 0.5, 16);
    const targetMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
    const target = new THREE.Mesh(targetGeo, targetMat);
    target.position.set(3, 0.5, 0);
    target.rotation.y = Math.PI / 2;
    scene.add(target);
    objects.push(target);

    return objects;
  }

  function createAnatPreview(scene) {
    const objects = [];
    // Simplified human body using geometric primitives
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0xf4a460, transparent: true, opacity: 0.85, roughness: 0.6 });

    // Head
    const headGeo = new THREE.SphereGeometry(0.35, 16, 16);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 2.8, 0);
    scene.add(head); objects.push(head);

    // Torso
    const torsoGeo = new THREE.CylinderGeometry(0.4, 0.35, 1.2, 8);
    const torso = new THREE.Mesh(torsoGeo, bodyMat);
    torso.position.set(0, 1.8, 0);
    scene.add(torso); objects.push(torso);

    // Hips
    const hipsGeo = new THREE.CylinderGeometry(0.35, 0.3, 0.4, 8);
    const hips = new THREE.Mesh(hipsGeo, bodyMat);
    hips.position.set(0, 1.0, 0);
    scene.add(hips); objects.push(hips);

    // Heart glow
    const heartGeo = new THREE.SphereGeometry(0.15, 12, 12);
    const heartMat = new THREE.MeshPhysicalMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.5, transparent: true, opacity: 0.7 });
    const heart = new THREE.Mesh(heartGeo, heartMat);
    heart.position.set(0.1, 2.1, 0.2);
    scene.add(heart); objects.push(heart);

    // Arms
    const armGeo = new THREE.CylinderGeometry(0.1, 0.08, 1.0, 6);
    const leftArm = new THREE.Mesh(armGeo, bodyMat);
    leftArm.position.set(-0.55, 1.8, 0);
    leftArm.rotation.z = 0.2;
    scene.add(leftArm); objects.push(leftArm);

    const rightArm = new THREE.Mesh(armGeo, bodyMat.clone());
    rightArm.position.set(0.55, 1.8, 0);
    rightArm.rotation.z = -0.2;
    scene.add(rightArm); objects.push(rightArm);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.12, 0.1, 1.0, 6);
    const leftLeg = new THREE.Mesh(legGeo, bodyMat);
    leftLeg.position.set(-0.2, 0.35, 0);
    scene.add(leftLeg); objects.push(leftLeg);

    const rightLeg = new THREE.Mesh(legGeo, bodyMat.clone());
    rightLeg.position.set(0.2, 0.35, 0);
    scene.add(rightLeg); objects.push(rightLeg);

    return objects;
  }

  function animatePreviews() {
    requestAnimationFrame(animatePreviews);
    const t = Date.now() * 0.001;

    Object.entries(previews).forEach(([type, p]) => {
      if (type === 'chemistry') {
        p.objects.forEach(obj => {
          if (obj.userData.speed) {
            obj.position.y = obj.userData.baseY + Math.sin(t * 3 + obj.position.x * 5) * 0.15;
          }
        });
        // Rotate beaker slightly
        if (p.objects[0]) {
          p.objects[0].rotation.y = Math.sin(t * 0.5) * 0.1;
        }
      } else if (type === 'physics') {
        // Animate ball along arc
        if (p.objects[1]) {
          const at = (t * 0.5) % 2;
          if (at < 1.5) {
            p.objects[1].position.x = -2.5 + at * 3.5;
            p.objects[1].position.y = 1.2 + at * 2 * Math.sin(Math.PI / 4) - 0.5 * 3 * at * at;
            if (p.objects[1].position.y < 0.2) p.objects[1].position.y = 0.2;
          }
        }
      } else if (type === 'anatomy') {
        // Heartbeat
        if (p.objects[3]) {
          const beat = Math.sin(t * 4) * 0.3 + 1;
          p.objects[3].scale.setScalar(beat > 1 ? beat : 1);
        }
        // Gentle rotation
        p.objects.forEach(obj => {
          obj.rotation.y = Math.sin(t * 0.3) * 0.3;
        });
      }

      p.renderer.render(p.scene, p.camera);
    });
  }

  function startPreviews() {
    initPreview('preview-anatomy', 'anatomy');
    animatePreviews();
  }

  return {
    initMain, startLoop, stopLoop, clearScene, destroy,
    getScene, getCamera, getRenderer, getControls, getCSS2DRenderer,
    startPreviews, previews
  };
})();
