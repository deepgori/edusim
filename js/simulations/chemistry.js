/**
 * chemistry.js — Interactive Chemistry Lab Simulation (High-Fidelity)
 * Features: realistic lab bench, drag-and-drop beakers, pour animation, particle reactions
 */
const ChemistrySim = (() => {
  let objects = {};
  let particles = [];
  let state = { chemA: 'acid', chemB: 'indicator', reacting: false, temp: 25, pH: 7 };
  let scene, raycaster, mouse;
  const clickables = [];

  // Chemical equation data
  const equations = {
    'acid+sodium':     { reactants: 'HCl<span class="plus">+</span>Na', products: 'NaCl<span class="plus">+</span>H<sub>2</sub>', type: 'exo', name: 'Single Displacement' },
    'acid+indicator':  { reactants: 'HCl<span class="plus">+</span>Ind', products: 'H-Ind<span class="plus">+</span>Cl<sup>−</sup>', type: 'exo', name: 'Acid-Indicator' },
    'acid+catalyst':   { reactants: '2HCl<span class="plus">+</span>Cat', products: '2HCl<sub>(fast)</sub>', type: 'exo', name: 'Catalyzed Decomp.' },
    'base+sodium':     { reactants: 'NaOH<span class="plus">+</span>Na', products: 'Na<sub>2</sub>O<span class="plus">+</span>H<sub>2</sub>', type: 'endo', name: 'Reduction' },
    'base+indicator':  { reactants: 'NaOH<span class="plus">+</span>Ind', products: 'Na-Ind<span class="plus">+</span>OH<sup>−</sup>', type: 'endo', name: 'Base-Indicator' },
    'base+catalyst':   { reactants: '2NaOH<span class="plus">+</span>Cat', products: 'Na<sub>2</sub>O<span class="plus">+</span>H<sub>2</sub>O', type: 'endo', name: 'Catalyzed Decomp.' },
    'water+sodium':    { reactants: '2H<sub>2</sub>O<span class="plus">+</span>2Na', products: '2NaOH<span class="plus">+</span>H<sub>2</sub>↑', type: 'exo', name: 'Metal + Water' },
    'water+indicator': { reactants: 'H<sub>2</sub>O<span class="plus">+</span>Ind', products: 'No Reaction', type: 'endo', name: 'Neutral' },
    'water+catalyst':  { reactants: 'H<sub>2</sub>O<span class="plus">+</span>Cat', products: 'H<sub>2</sub>O<sub>(unchanged)</sub>', type: 'endo', name: 'No Effect' }
  };

  // Drag-and-drop state
  let dragState = {
    active: false,
    object: null,
    originalPos: null,
    plane: null,
    offset: new THREE.Vector3(),
    intersection: new THREE.Vector3()
  };

  function init(sceneRef) {
    scene = sceneRef;
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    dragState.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.15);

    buildLab();
    registerHUD();

    const canvas = document.getElementById('sim-canvas');
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);

    Notifications.success('Chemistry Lab', 'Drag beakers to the reaction flask to mix chemicals!');
  }

  function buildLab() {
    // ---- Dramatic Lighting ----
    const spotMain = new THREE.SpotLight(0xfff8f0, 0.7, 18, Math.PI / 5, 0.3);
    spotMain.position.set(0, 9, 3);
    spotMain.target.position.set(0, 1, 0);
    spotMain.castShadow = true;
    spotMain.shadow.mapSize.set(1024, 1024);
    scene.add(spotMain);
    scene.add(spotMain.target);

    // Cool accent lights
    const accentBlue = new THREE.PointLight(0x22d3ee, 0.35, 12);
    accentBlue.position.set(-4, 3, 2);
    scene.add(accentBlue);

    const accentPurple = new THREE.PointLight(0xa855f7, 0.25, 10);
    accentPurple.position.set(4, 2.5, -1);
    scene.add(accentPurple);

    // Warm under-shelf glow
    const warmGlow = new THREE.PointLight(0xf59e0b, 0.15, 5);
    warmGlow.position.set(0, 2.6, -2.2);
    scene.add(warmGlow);

    // ---- Lab Floor ----
    const floorGeo = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x0d1117, roughness: 0.9 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(20, 40, 0x1a2744, 0x0f1520);
    grid.position.y = 0.01;
    scene.add(grid);

    // ---- Lab Bench (realistic dark composite) ----
    // Bench top — dark stone/composite look
    const benchTopGeo = new THREE.BoxGeometry(7.5, 0.10, 3.2);
    const benchTopMat = new THREE.MeshStandardMaterial({
      color: 0x1e2433, roughness: 0.35, metalness: 0.08
    });
    const benchTop = new THREE.Mesh(benchTopGeo, benchTopMat);
    benchTop.position.set(0, 1.05, 0);
    benchTop.castShadow = true;
    benchTop.receiveShadow = true;
    scene.add(benchTop);

    // Bench front panel (cabinet look)
    const panelGeo = new THREE.BoxGeometry(7.5, 1.0, 0.05);
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x171d2b, roughness: 0.5 });
    const frontPanel = new THREE.Mesh(panelGeo, panelMat);
    frontPanel.position.set(0, 0.55, 1.6);
    scene.add(frontPanel);

    // Cabinet drawers (visual detail)
    for (let i = 0; i < 3; i++) {
      const drawerGeo = new THREE.BoxGeometry(2.2, 0.38, 0.02);
      const drawerMat = new THREE.MeshStandardMaterial({ color: 0x1f2738, roughness: 0.4, metalness: 0.05 });
      const drawer = new THREE.Mesh(drawerGeo, drawerMat);
      drawer.position.set(-2.5 + i * 2.5, 0.55, 1.62);
      scene.add(drawer);

      // Drawer handle
      const handleGeo = new THREE.BoxGeometry(0.4, 0.02, 0.04);
      const handleMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, metalness: 0.8, roughness: 0.2 });
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.position.set(-2.5 + i * 2.5, 0.55, 1.66);
      scene.add(handle);
    }

    // Back panel
    const backPanel = new THREE.Mesh(panelGeo.clone(), panelMat.clone());
    backPanel.position.set(0, 0.55, -1.6);
    scene.add(backPanel);

    // Bench edge trim — glowing accent
    const trimGeo = new THREE.BoxGeometry(7.55, 0.015, 3.25);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6, emissive: 0x1e40af, emissiveIntensity: 0.25,
      metalness: 0.8, roughness: 0.1
    });
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(0, 1.11, 0);
    scene.add(trim);
    objects.trim = trim;

    // Bench legs (metallic)
    const legGeo = new THREE.BoxGeometry(0.06, 1.0, 0.06);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.7, roughness: 0.2 });
    [[-3.5, 0.52, -1.45], [3.5, 0.52, -1.45], [-3.5, 0.52, 1.45], [3.5, 0.52, 1.45]].forEach(pos => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(...pos);
      scene.add(leg);
    });

    // Bottom shelf between legs
    const shelfBottomGeo = new THREE.BoxGeometry(7.0, 0.04, 2.5);
    const shelfBottomMat = new THREE.MeshStandardMaterial({ color: 0x151b28, roughness: 0.5 });
    const shelfBottom = new THREE.Mesh(shelfBottomGeo, shelfBottomMat);
    shelfBottom.position.set(0, 0.1, 0);
    scene.add(shelfBottom);

    // ---- Wall Shelf with Reagent Bottles ----
    const shelfGeo = new THREE.BoxGeometry(5, 0.06, 0.55);
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x1e2433, roughness: 0.35 });
    const shelf = new THREE.Mesh(shelfGeo, shelfMat);
    shelf.position.set(0, 3.2, -3.2);
    scene.add(shelf);

    // Shelf bracket L-shape supports
    for (let x of [-2.0, 0, 2.0]) {
      const bracketV = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.3, 0.03),
        new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.6 })
      );
      bracketV.position.set(x, 3.05, -3.0);
      scene.add(bracketV);
    }

    // Reagent bottles (varied shapes)
    const bottleColors = [0xef4444, 0x10b981, 0x3b82f6, 0xf59e0b, 0xa855f7, 0xec4899, 0x22d3ee];
    for (let i = 0; i < 7; i++) {
      const isWide = i % 3 === 0;
      const bottleProfile = isWide ?
        [[0, 0], [0.07, 0.01], [0.07, 0.22], [0.04, 0.26], [0.03, 0.34], [0, 0.35]] :
        [[0, 0], [0.05, 0.01], [0.05, 0.28], [0.025, 0.32], [0.02, 0.42], [0, 0.43]];
      const bottleMat = new THREE.MeshPhysicalMaterial({
        color: bottleColors[i], transparent: true, opacity: 0.5 + Math.random() * 0.2,
        roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0
      });
      const bottle = createLatheShape(bottleProfile, 12, bottleMat, [
        -1.8 + i * 0.6, 3.24, -3.2
      ]);
      scene.add(bottle);
    }

    // ---- Draggable Beakers ----
    createBeaker(-2.2, 'beakerA', 0x10b981, 'HCl (Acid)');
    createBeaker(-0.6, 'beakerB', 0xa855f7, 'Indicator');

    // ---- Reaction Flask ----
    createFlask(2.0, 'flask');

    // ---- Drop zone glow ring ----
    const dropRingGeo = new THREE.RingGeometry(0.45, 0.58, 32);
    const dropRingMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.0, side: THREE.DoubleSide });
    const dropRing = new THREE.Mesh(dropRingGeo, dropRingMat);
    dropRing.rotation.x = -Math.PI / 2;
    dropRing.position.set(2.0, 1.12, 0.3);
    scene.add(dropRing);
    objects.dropRing = dropRing;

    // ---- Bunsen Burner ----
    createBurner(0.8);

    // ---- Ring Stand ----
    const standMat = new THREE.MeshStandardMaterial({ color: 0x555, metalness: 0.8, roughness: 0.15 });
    // Vertical rod
    const rodGeo = new THREE.CylinderGeometry(0.012, 0.012, 1.6, 6);
    const rod = new THREE.Mesh(rodGeo, standMat);
    rod.position.set(3.0, 1.12 + 0.8, 0);
    scene.add(rod);

    // Base plate
    const basePlateGeo = new THREE.CylinderGeometry(0.18, 0.2, 0.025, 12);
    const basePlate = new THREE.Mesh(basePlateGeo, standMat.clone());
    basePlate.position.set(3.0, 1.12, 0);
    scene.add(basePlate);

    // Ring
    const sRingGeo = new THREE.TorusGeometry(0.22, 0.012, 6, 16);
    const sRing = new THREE.Mesh(sRingGeo, standMat.clone());
    sRing.position.set(3.0, 1.12 + 0.55, 0);
    sRing.rotation.x = Math.PI / 2;
    scene.add(sRing);

    // Clamp arm
    const clampGeo = new THREE.BoxGeometry(0.3, 0.015, 0.015);
    const clamp = new THREE.Mesh(clampGeo, standMat.clone());
    clamp.position.set(3.0 - 0.15, 1.12 + 0.55, 0);
    scene.add(clamp);

    // ---- Erlenmeyer Flask (decoration) ----
    const erlProfile = [
      [0, 0], [0.22, 0.01], [0.22, 0.05], [0.12, 0.28],
      [0.05, 0.38], [0.04, 0.48], [0, 0.49]
    ];
    const erlMat = new THREE.MeshPhysicalMaterial({
      color: 0xaaddff, transparent: true, opacity: 0.12,
      roughness: 0.02, clearcoat: 1, side: THREE.DoubleSide
    });
    const erl = createLatheShape(erlProfile, 16, erlMat, [-3.2, 1.12, 0.5]);
    scene.add(erl);

    // Liquid inside erlenmeyer
    const erlLiqProfile = [
      [0, 0], [0.19, 0.01], [0.19, 0.04], [0.10, 0.18], [0, 0.19]
    ];
    const erlLiqMat = new THREE.MeshPhysicalMaterial({
      color: 0xf59e0b, transparent: true, opacity: 0.45, roughness: 0.2
    });
    const erlLiq = createLatheShape(erlLiqProfile, 14, erlLiqMat, [-3.2, 1.12, 0.5]);
    scene.add(erlLiq);

    // ---- Floating ambient particles ----
    for (let i = 0; i < 50; i++) {
      const pGeo = new THREE.SphereGeometry(0.012 + Math.random() * 0.018, 5, 5);
      const pMat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.5 ? 0x22d3ee : 0xa855f7,
        transparent: true, opacity: 0.2
      });
      const p = new THREE.Mesh(pGeo, pMat);
      p.position.set(
        (Math.random() - 0.5) * 12,
        1.5 + Math.random() * 5,
        (Math.random() - 0.5) * 8
      );
      p.userData.type = 'ambient';
      p.userData.speed = { x: (Math.random() - 0.5) * 0.002, y: 0.002 + Math.random() * 0.004 };
      p.userData.baseY = p.position.y;
      scene.add(p);
      particles.push(p);
    }

    // Camera
    const camera = SceneManager.getCamera();
    camera.position.set(0, 3.5, 6.5);
    camera.lookAt(0, 1.5, 0);
    const controls = SceneManager.getControls();
    if (controls) {
      controls.target.set(0, 1.5, 0);
      controls.update();
    }
  }

  function createLatheShape(profile, segments, material, position) {
    const points = profile.map(p => new THREE.Vector2(p[0], p[1]));
    const geo = new THREE.LatheGeometry(points, segments || 16);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(...position);
    return mesh;
  }

  function createBeaker(x, name, liquidColor, label) {
    const group = new THREE.Group();
    group.position.set(x, 1.12, -0.4);

    // Glass body — lathe profile for realistic beaker shape
    const glassProfile = [
      [0.24, 0], [0.24, 0.01], [0.26, 0.06],
      [0.29, 0.30], [0.30, 0.55], [0.31, 0.75],
      [0.32, 0.82], [0.33, 0.85]
    ];
    const glassPts = glassProfile.map(p => new THREE.Vector2(p[0], p[1]));
    const glassGeo = new THREE.LatheGeometry(glassPts, 24);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xb0d4f1, transparent: true, opacity: 0.10,
      roughness: 0.02, metalness: 0, side: THREE.DoubleSide,
      clearcoat: 1, clearcoatRoughness: 0
    });
    group.add(new THREE.Mesh(glassGeo, glassMat));

    // Glass bottom
    const bottomGeo = new THREE.CircleGeometry(0.24, 24);
    const bottomMat = new THREE.MeshPhysicalMaterial({
      color: 0xb0d4f1, transparent: true, opacity: 0.08, side: THREE.DoubleSide
    });
    const bottom = new THREE.Mesh(bottomGeo, bottomMat);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.y = 0.005;
    group.add(bottom);

    // Pouring lip (slight spout)
    const lipGeo = new THREE.TorusGeometry(0.33, 0.008, 6, 24, Math.PI * 2);
    const lipMat = new THREE.MeshPhysicalMaterial({
      color: 0xd0e8ff, transparent: true, opacity: 0.15
    });
    const lip = new THREE.Mesh(lipGeo, lipMat);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.85;
    group.add(lip);

    // Liquid
    const liqProfile = [
      [0, 0], [0.22, 0.01], [0.25, 0.08],
      [0.27, 0.30], [0.28, 0.50], [0, 0.52]
    ];
    const liqPts = liqProfile.map(p => new THREE.Vector2(p[0], p[1]));
    const liqGeo = new THREE.LatheGeometry(liqPts, 20);
    const liqMat = new THREE.MeshPhysicalMaterial({
      color: liquidColor, transparent: true, opacity: 0.50,
      roughness: 0.2, clearcoat: 0.4
    });
    group.add(new THREE.Mesh(liqGeo, liqMat));

    // Liquid surface (meniscus)
    const surfGeo = new THREE.CircleGeometry(0.28, 20);
    const surfMat = new THREE.MeshBasicMaterial({
      color: liquidColor, transparent: true, opacity: 0.12, side: THREE.DoubleSide
    });
    const surface = new THREE.Mesh(surfGeo, surfMat);
    surface.rotation.x = -Math.PI / 2;
    surface.position.y = 0.52;
    group.add(surface);

    // Graduation marks
    for (let i = 0; i < 4; i++) {
      const markGeo = new THREE.BoxGeometry(0.12, 0.003, 0.003);
      const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 });
      const mark = new THREE.Mesh(markGeo, markMat);
      mark.position.set(0.30, 0.12 + i * 0.15, 0);
      group.add(mark);
    }

    group.userData = { type: 'beaker', name, label, clickable: true, draggable: true, originalPos: group.position.clone() };
    scene.add(group);
    objects[name] = group;
    clickables.push(group);
  }

  function createFlask(x, name) {
    const group = new THREE.Group();
    group.position.set(x, 1.12, 0.3);

    // Round-bottom flask — lathe profile
    const flaskProfile = [
      [0, 0], [0.15, 0.03], [0.28, 0.10], [0.36, 0.22],
      [0.38, 0.35], [0.36, 0.48], [0.28, 0.58],
      [0.15, 0.65], [0.08, 0.72], [0.06, 0.85],
      [0.07, 0.92], [0.065, 0.95]
    ];
    const flaskPts = flaskProfile.map(p => new THREE.Vector2(p[0], p[1]));
    const flaskGeo = new THREE.LatheGeometry(flaskPts, 28);
    const flaskMat = new THREE.MeshPhysicalMaterial({
      color: 0xb0d4f1, transparent: true, opacity: 0.10,
      roughness: 0.02, side: THREE.DoubleSide,
      clearcoat: 1, clearcoatRoughness: 0
    });
    group.add(new THREE.Mesh(flaskGeo, flaskMat));

    // Flask rim
    const rimGeo = new THREE.TorusGeometry(0.07, 0.01, 6, 16);
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd0e8ff, roughness: 0.1, transparent: true, opacity: 0.3 });
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.95;
    group.add(rim);

    // Flask liquid (hidden until reaction)
    const liqProfile = [
      [0, 0], [0.12, 0.02], [0.24, 0.08], [0.32, 0.18],
      [0.34, 0.28], [0.30, 0.36], [0, 0.38]
    ];
    const liqPts = liqProfile.map(p => new THREE.Vector2(p[0], p[1]));
    const liqGeo = new THREE.LatheGeometry(liqPts, 20);
    const liqMat = new THREE.MeshPhysicalMaterial({
      color: 0x3b82f6, transparent: true, opacity: 0.0,
      roughness: 0.2, clearcoat: 0.5
    });
    const liquid = new THREE.Mesh(liqGeo, liqMat);
    group.add(liquid);

    // Glow sphere (appears on hover/drop proximity)
    const glowGeo = new THREE.SphereGeometry(0.45, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.0 });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = 0.35;
    group.add(glow);
    objects.flaskGlow = glow;

    group.userData = { type: 'flask', name, clickable: true };
    scene.add(group);
    objects[name] = group;
    clickables.push(group);
  }

  function createBurner(x) {
    const group = new THREE.Group();
    group.position.set(x, 1.12, 0.7);

    // Base — lathe profile
    const baseProfile = [
      [0, 0], [0.17, 0.01], [0.17, 0.04], [0.14, 0.06],
      [0.12, 0.12], [0.05, 0.30], [0.04, 0.42],
      [0.035, 0.52], [0.035, 0.60]
    ];
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.75, roughness: 0.18 });
    const base = createLatheShape(baseProfile, 14, baseMat, [0, 0, 0]);
    group.add(base);

    // Burner top ring
    const topRingGeo = new THREE.TorusGeometry(0.05, 0.008, 6, 12);
    const topRing = new THREE.Mesh(topRingGeo, baseMat.clone());
    topRing.rotation.x = Math.PI / 2;
    topRing.position.y = 0.60;
    group.add(topRing);

    // Outer flame
    const flameGeo = new THREE.ConeGeometry(0.06, 0.28, 12);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.55 });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.y = 0.76;
    group.add(flame);
    objects.flame = flame;

    // Inner flame (blue)
    const innerGeo = new THREE.ConeGeometry(0.028, 0.16, 10);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.7 });
    const inner = new THREE.Mesh(innerGeo, innerMat);
    inner.position.y = 0.70;
    group.add(inner);
    objects.innerFlame = inner;

    // Heat shimmer rings
    for (let i = 0; i < 3; i++) {
      const heatGeo = new THREE.TorusGeometry(0.05 + i * 0.03, 0.004, 4, 12);
      const heatMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.06 });
      const heat = new THREE.Mesh(heatGeo, heatMat);
      heat.rotation.x = Math.PI / 2;
      heat.position.y = 0.90 + i * 0.08;
      group.add(heat);
      if (i === 0) objects.heatRing = heat;
    }

    scene.add(group);
    objects.burner = group;
  }

  // ---- Drag and Drop ----
  function getMouseIntersection(event) {
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function onMouseDown(event) {
    getMouseIntersection(event);
    raycaster.setFromCamera(mouse, SceneManager.getCamera());

    const allMeshes = [];
    clickables.forEach(g => {
      if (g.userData.draggable) g.traverse(m => { if (m.isMesh) allMeshes.push(m); });
    });

    const hits = raycaster.intersectObjects(allMeshes, false);
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj.parent && !obj.userData.type) obj = obj.parent;

      if (obj.userData.draggable) {
        const controls = SceneManager.getControls();
        if (controls) controls.enabled = false;

        dragState.active = true;
        dragState.object = obj;
        dragState.originalPos = obj.userData.originalPos.clone();

        event.target.style.cursor = 'grabbing';
        Notifications.info('Dragging', `${obj.userData.label} — drop on the flask to mix`);
        Objectives.complete('drag_beaker');
      }
    }
  }

  function onMouseMove(event) {
    getMouseIntersection(event);
    raycaster.setFromCamera(mouse, SceneManager.getCamera());

    if (dragState.active && dragState.object) {
      const target = new THREE.Vector3();
      raycaster.ray.intersectPlane(dragState.plane, target);
      if (target) {
        dragState.object.position.x = target.x;
        dragState.object.position.z = target.z;
        dragState.object.position.y = 1.25;
      }

      const flask = objects.flask;
      if (flask) {
        const dist = dragState.object.position.distanceTo(flask.position);
        const isNear = dist < 1.2;
        if (objects.dropRing) {
          objects.dropRing.material.opacity = isNear ? 0.35 + Math.sin(Date.now() * 0.005) * 0.12 : 0;
        }
        if (objects.flaskGlow) {
          objects.flaskGlow.material.opacity = isNear ? 0.05 : 0;
        }
      }

      event.target.style.cursor = 'grabbing';
      return;
    }

    // Hover detection
    const allMeshes = [];
    clickables.forEach(g => g.traverse(m => { if (m.isMesh) allMeshes.push(m); }));
    const hits = raycaster.intersectObjects(allMeshes, false);

    let foundDraggable = false;
    if (hits.length > 0) {
      let obj = hits[0].object;
      while (obj.parent && !obj.userData.type) obj = obj.parent;
      if (obj.userData.draggable) foundDraggable = true;
    }
    event.target.style.cursor = foundDraggable ? 'grab' : 'default';
  }

  function onMouseUp(event) {
    if (!dragState.active || !dragState.object) return;

    const controls = SceneManager.getControls();
    if (controls) controls.enabled = true;

    const flask = objects.flask;
    if (flask) {
      const dist = dragState.object.position.distanceTo(flask.position);
      if (dist < 1.2) {
        animatePour(dragState.object, flask);
      } else {
        animateReturn(dragState.object, dragState.originalPos);
      }
    } else {
      animateReturn(dragState.object, dragState.originalPos);
    }

    if (objects.dropRing) objects.dropRing.material.opacity = 0;
    if (objects.flaskGlow) objects.flaskGlow.material.opacity = 0;

    dragState.active = false;
    dragState.object = null;
    event.target.style.cursor = 'default';
  }

  function animatePour(beaker, flask) {
    const targetPos = new THREE.Vector3(flask.position.x, flask.position.y + 1.0, flask.position.z);
    const startPos = beaker.position.clone();
    let t = 0;

    function step() {
      t += 0.02;
      if (t <= 0.5) {
        const p = t / 0.5;
        beaker.position.lerpVectors(startPos, targetPos, EduUtils.easeOutCubic(p));
      } else if (t <= 0.8) {
        const p = (t - 0.5) / 0.3;
        beaker.rotation.z = EduUtils.lerp(0, Math.PI / 3, EduUtils.easeOutCubic(p));
        if (Math.random() > 0.35) spawnPourParticle(beaker);
      } else if (t <= 1.0) {
        const p = (t - 0.8) / 0.2;
        beaker.rotation.z = EduUtils.lerp(Math.PI / 3, 0, EduUtils.easeOutCubic(p));
      } else {
        animateReturn(beaker, beaker.userData.originalPos);
        triggerReaction();
        return;
      }
      requestAnimationFrame(step);
    }
    step();
  }

  function spawnPourParticle(beaker) {
    const color = beaker.userData.name === 'beakerA' ?
      (state.chemA === 'acid' ? 0x10b981 : state.chemA === 'base' ? 0x3b82f6 : 0x88ccff) :
      (state.chemB === 'sodium' ? 0xf59e0b : state.chemB === 'indicator' ? 0xa855f7 : 0xec4899);

    const pGeo = new THREE.SphereGeometry(0.02, 5, 5);
    const pMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.65 });
    const p = new THREE.Mesh(pGeo, pMat);
    p.position.copy(beaker.position);
    p.position.x += (Math.random() - 0.5) * 0.12;
    p.position.z += (Math.random() - 0.5) * 0.12;
    p.userData.type = 'pour';
    p.userData.velocity = { x: 0, y: -0.04, z: 0 };
    p.userData.life = 1.0;
    p.userData.decay = 0.035;
    scene.add(p);
    particles.push(p);
  }

  function animateReturn(obj, targetPos) {
    const startPos = obj.position.clone();
    let t = 0;
    function step() {
      t += 0.04;
      if (t >= 1) { obj.position.copy(targetPos); return; }
      obj.position.lerpVectors(startPos, targetPos, EduUtils.easeOutCubic(t));
      requestAnimationFrame(step);
    }
    step();
  }

  function registerHUD() {
    HUD.onCallback('chemSelect', (group, value) => {
      if (group === 'a') state.chemA = value;
      else state.chemB = value;

      Objectives.complete('select_chem');

      const colors = { acid: 0x10b981, base: 0x3b82f6, water: 0x88ccff, sodium: 0xf59e0b, indicator: 0xa855f7, catalyst: 0xec4899 };
      if (group === 'a' && objects.beakerA) {
        // Update liquid inside beaker (index 2 is the lathe liquid)
        objects.beakerA.children[2].material.color.setHex(colors[value] || 0x10b981);
        objects.beakerA.children[3].material.color.setHex(colors[value] || 0x10b981);
      }
      if (group === 'b' && objects.beakerB) {
        objects.beakerB.children[2].material.color.setHex(colors[value] || 0xa855f7);
        objects.beakerB.children[3].material.color.setHex(colors[value] || 0xa855f7);
      }
    });

    HUD.onCallback('chemMix', () => triggerReaction());
  }

  function triggerReaction() {
    if (state.reacting) return;
    state.reacting = true;
    state.temp = 25;

    const isExo = (state.chemA === 'acid' && state.chemB !== 'water') || state.chemB === 'catalyst';
    const color = isExo ? 0xef4444 : 0x3b82f6;
    const targetTemp = isExo ? 85 : 5;
    const targetPH = state.chemA === 'acid' ? 2.5 : state.chemA === 'base' ? 12 : 7;

    // --- Show Chemical Equation Bar ---
    showEquationBar(isExo);

    Objectives.complete('mix_reaction');
    if (isExo) Objectives.complete('try_exo');

    // Flask liquid visible
    if (objects.flask) {
      const liq = objects.flask.children[2]; // LatheGeometry liquid
      liq.material.opacity = 0.45;
      liq.material.color.setHex(color);
    }

    spawnReactionParticles(color, isExo);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      state.temp = EduUtils.lerp(25, targetTemp, Math.min(step / 40, 1));
      state.pH = EduUtils.lerp(7, targetPH, Math.min(step / 40, 1));

      const tempEl = document.getElementById('hud-temp');
      const phEl = document.getElementById('hud-ph');
      const stateEl = document.getElementById('hud-reaction');
      if (tempEl) tempEl.textContent = `${state.temp.toFixed(1)}°C`;
      if (phEl) phEl.textContent = state.pH.toFixed(1);
      if (stateEl) stateEl.textContent = step < 40 ? 'Reacting ⚡' : 'Complete ✓';

      const hazardEl = document.getElementById('hud-hazard');
      const hazardIcon = document.getElementById('hud-hazard-item');
      if (hazardEl && hazardIcon) {
        if (isExo && step < 40) {
          hazardEl.textContent = 'HIGH';
          hazardIcon.querySelector('.info-icon').className = 'info-icon red';
        } else {
          hazardEl.textContent = 'Low';
          hazardIcon.querySelector('.info-icon').className = 'info-icon green';
        }
      }

      // Bench trim reaction glow
      if (objects.trim && step < 40) {
        const glow = Math.sin(step * 0.3) * 0.35 + 0.35;
        objects.trim.material.emissiveIntensity = isExo ? glow : glow * 0.5;
        objects.trim.material.emissive.setHex(isExo ? 0xef4444 : 0x3b82f6);
      } else if (objects.trim) {
        objects.trim.material.emissiveIntensity = 0.25;
        objects.trim.material.emissive.setHex(0x1e40af);
      }

      if (step >= 60) {
        clearInterval(interval);
        state.reacting = false;
        // Remove reacting glow from equation bar
        const eqBar = document.querySelector('.equation-bar');
        if (eqBar) eqBar.classList.remove('reacting');
        Notifications.success('Reaction Complete', `${isExo ? 'Exothermic' : 'Endothermic'} reaction at ${state.temp.toFixed(1)}°C`);
        Objectives.complete('observe_temp');
      }
    }, 50);

    Notifications.info('Reaction Started', `${state.chemA} + ${state.chemB} — ${isExo ? 'Exothermic ↑' : 'Endothermic ↓'}`);
    Analytics.trackEvent('chemistry', 'reaction', { chemA: state.chemA, chemB: state.chemB });
  }

  function spawnReactionParticles(color, isExo) {
    for (let i = 0; i < 60; i++) {
      const pGeo = new THREE.SphereGeometry(0.015 + Math.random() * 0.035, 6, 6);
      const pColor = isExo ?
        (Math.random() > 0.5 ? 0xef4444 : 0xf59e0b) :
        (Math.random() > 0.5 ? 0x3b82f6 : 0x22d3ee);
      const pMat = new THREE.MeshBasicMaterial({ color: pColor, transparent: true, opacity: 0.65 });
      const p = new THREE.Mesh(pGeo, pMat);
      p.position.set(
        2.0 + (Math.random() - 0.5) * 0.5,
        1.5 + Math.random() * 0.3,
        0.3 + (Math.random() - 0.5) * 0.4
      );
      p.userData.type = 'reaction';
      p.userData.velocity = {
        x: (Math.random() - 0.5) * 0.022,
        y: 0.012 + Math.random() * 0.030,
        z: (Math.random() - 0.5) * 0.022
      };
      p.userData.life = 1.0;
      p.userData.decay = 0.004 + Math.random() * 0.008;
      scene.add(p);
      particles.push(p);
    }
  }

  function showEquationBar(isExo) {
    // Remove existing
    const existing = document.querySelector('.equation-bar');
    if (existing) existing.remove();

    const key = `${state.chemA}+${state.chemB}`;
    const eq = equations[key] || { reactants: state.chemA, products: '?', type: isExo ? 'exo' : 'endo', name: 'Unknown' };

    const bar = document.createElement('div');
    bar.className = 'equation-bar reacting';
    bar.innerHTML = `
      <span class="eq-label">Equation</span>
      <span class="eq-text">
        <span class="reactant">${eq.reactants}</span>
        <span class="arrow">→</span>
        <span class="product">${eq.products}</span>
      </span>
      <span class="eq-type ${eq.type}">${eq.type === 'exo' ? '↑ Exothermic' : '↓ Endothermic'}</span>
    `;

    const container = document.getElementById('sim-canvas-container');
    if (container) container.appendChild(bar);
  }

  function update(scene, camera) {
    const t = Date.now() * 0.001;

    // Flame animation
    if (objects.flame) {
      objects.flame.scale.y = 0.9 + Math.sin(t * 10) * 0.15;
      objects.flame.scale.x = 0.9 + Math.sin(t * 7) * 0.08;
    }
    if (objects.innerFlame) {
      objects.innerFlame.scale.y = 0.9 + Math.sin(t * 12 + 1) * 0.12;
    }
    if (objects.heatRing) {
      objects.heatRing.position.y += 0.001;
      objects.heatRing.material.opacity = 0.04 + Math.sin(t * 3) * 0.02;
      if (objects.heatRing.position.y > 1.3) objects.heatRing.position.y = 0.90;
    }

    // Particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.userData.type === 'ambient') {
        p.position.y = p.userData.baseY + Math.sin(t * p.userData.speed.y * 200 + i) * 0.5;
        p.position.x += p.userData.speed.x;
        if (Math.abs(p.position.x) > 7) p.userData.speed.x *= -1;
      } else if (p.userData.type === 'reaction' || p.userData.type === 'pour') {
        p.position.x += p.userData.velocity.x;
        p.position.y += p.userData.velocity.y;
        p.position.z += p.userData.velocity.z;
        if (p.userData.type === 'reaction') p.userData.velocity.y -= 0.0003;
        p.userData.life -= p.userData.decay;
        p.material.opacity = p.userData.life * 0.65;
        p.scale.setScalar(Math.max(p.userData.life, 0.1));

        if (p.userData.life <= 0) {
          scene.remove(p);
          p.geometry.dispose();
          p.material.dispose();
          particles.splice(i, 1);
        }
      }
    }

    // Idle beaker animation
    if (!dragState.active) {
      if (objects.beakerA) objects.beakerA.rotation.y = Math.sin(t * 0.3) * 0.015;
      if (objects.beakerB) objects.beakerB.rotation.y = Math.sin(t * 0.3 + 1) * 0.015;
    }

    // Trim pulse
    if (objects.trim && !state.reacting) {
      objects.trim.material.emissiveIntensity = 0.2 + Math.sin(t * 1.5) * 0.06;
    }
  }

  function reset() {
    state = { chemA: 'acid', chemB: 'indicator', reacting: false, temp: 25, pH: 7 };
    if (objects.flask) {
      objects.flask.children[2].material.opacity = 0;
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      if (particles[i].userData.type === 'reaction' || particles[i].userData.type === 'pour') {
        scene.remove(particles[i]);
        particles[i].geometry.dispose();
        particles[i].material.dispose();
        particles.splice(i, 1);
      }
    }
    if (objects.beakerA) { objects.beakerA.position.copy(objects.beakerA.userData.originalPos); objects.beakerA.rotation.z = 0; }
    if (objects.beakerB) { objects.beakerB.position.copy(objects.beakerB.userData.originalPos); objects.beakerB.rotation.z = 0; }
    const tempEl = document.getElementById('hud-temp');
    const phEl = document.getElementById('hud-ph');
    const stateEl = document.getElementById('hud-reaction');
    if (tempEl) tempEl.textContent = '25°C';
    if (phEl) phEl.textContent = '7.0';
    if (stateEl) stateEl.textContent = 'Idle';
    if (objects.trim) { objects.trim.material.emissiveIntensity = 0.25; objects.trim.material.emissive.setHex(0x1e40af); }
    // Remove equation bar
    const eqBar = document.querySelector('.equation-bar');
    if (eqBar) eqBar.remove();
    Notifications.info('Reset', 'Lab environment reset');
  }

  function cleanup() {
    const canvas = document.getElementById('sim-canvas');
    if (canvas) {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mouseup', onMouseUp);
    }
    particles = [];
    objects = {};
    clickables.length = 0;
    dragState = { active: false, object: null, originalPos: null, plane: null, offset: new THREE.Vector3(), intersection: new THREE.Vector3() };
  }

  return { init, update, reset, cleanup };
})();
