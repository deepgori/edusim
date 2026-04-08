/**
 * anatomy.js — 3D Human Anatomy Explorer (GLTF-Powered)
 * Loads a real Z-Anatomy based GLTF model with 200+ anatomical structures.
 * Features: layer toggling, click-to-inspect, floating labels, X-ray mode, search.
 */
const AnatomySim = (() => {
  let scene, raycaster, mouse;
  let bodyGroup = null;
  let modelLoaded = false;
  let highlightedMesh = null;
  let highlightTimeout = null;
  let clickTooltipEl = null;
  let clickTooltipTarget = null;
  let xrayMode = false;

  // Mesh collections by type
  const meshCollections = {
    muscles: [],
    bones: [],
    organs: [],
    all: []
  };

  // Track layer visibility
  const layerVisibility = { muscles: true, bones: true };

  // Original materials for restore
  const originalMaterials = new Map();

  // Floating labels
  const floatingLabels = [];
  let inspectedParts = new Set();

  function init(sceneRef) {
    scene = sceneRef;
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    buildEnvironment();
    loadModel();
    registerHUD();

    const canvas = document.getElementById('sim-canvas');
    canvas.addEventListener('click', onBodyClick);
    canvas.addEventListener('mousemove', onBodyHover);

    // Camera — positioned for full body view
    const camera = SceneManager.getCamera();
    camera.position.set(0, 1.0, 3.2);
    camera.lookAt(0, 0.85, 0);
    const controls = SceneManager.getControls();
    if (controls) {
      controls.target.set(0, 0.85, 0);
      controls.minDistance = 0.5;
      controls.maxDistance = 6;
      controls.update();
    }
  }

  function buildEnvironment() {
    // Dark medical floor
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x060a12, roughness: 0.95 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.05;
    scene.add(floor);

    // Subtle grid
    const grid = new THREE.GridHelper(30, 60, 0x0d1a2d, 0x080e18);
    grid.position.y = -0.04;
    scene.add(grid);

    // Display pedestal
    const platGeo = new THREE.CylinderGeometry(0.6, 0.7, 0.04, 64);
    const platMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.5, roughness: 0.2 });
    const platform = new THREE.Mesh(platGeo, platMat);
    platform.position.y = -0.02;
    scene.add(platform);

    // Glow ring
    const ringGeo = new THREE.TorusGeometry(0.65, 0.012, 8, 64);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.4 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);

    // Enhanced lighting for anatomical viewing
    const keyLight = new THREE.DirectionalLight(0xfff5ee, 1.0);
    keyLight.position.set(3, 6, 4);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xc8d8f0, 0.4);
    fillLight.position.set(-3, 4, -2);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0x3b82f6, 0.5, 10);
    rimLight.position.set(-2, 3, -3);
    scene.add(rimLight);

    const bottomLight = new THREE.PointLight(0x22d3ee, 0.2, 5);
    bottomLight.position.set(0, 0.1, 0);
    scene.add(bottomLight);

    // Hemisphere light for ambient fill
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x1a1a2e, 0.4);
    scene.add(hemiLight);
  }

  function loadModel() {
    // Show loading overlay
    const container = document.getElementById('sim-canvas-container');
    const loadingEl = document.createElement('div');
    loadingEl.className = 'model-loading-overlay';
    loadingEl.id = 'model-loading';
    loadingEl.innerHTML = `
      <div class="loading-text">Loading 3D Anatomy Model...</div>
      <div class="model-loading-bar"><div class="model-loading-bar-fill" id="model-progress"></div></div>
      <div class="loading-text" id="model-progress-text" style="font-size: 0.75rem; opacity: 0.6">0%</div>
    `;
    if (container) container.appendChild(loadingEl);

    // Setup DRACO decoder - use Google's CDN (recommended by Three.js)
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

    const loader = new THREE.GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      'models/body.glb',
      (gltf) => onModelLoaded(gltf),
      (progress) => {
        if (progress.total > 0) {
          const pct = Math.round((progress.loaded / progress.total) * 100);
          const bar = document.getElementById('model-progress');
          const text = document.getElementById('model-progress-text');
          if (bar) bar.style.width = pct + '%';
          if (text) text.textContent = pct + '%';
        }
      },
      (error) => {
        console.error('Failed to load anatomy model:', error);
        const loadEl = document.getElementById('model-loading');
        if (loadEl) {
          loadEl.querySelector('.loading-text').textContent = 'Failed to load model. Please refresh.';
        }
      }
    );
  }

  function onModelLoaded(gltf) {
    bodyGroup = gltf.scene;

    // Scale and position the model appropriately
    const box = new THREE.Box3().setFromObject(bodyGroup);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    // Scale to fit nicely (target ~2 units tall)
    const targetHeight = 2.0;
    const scale = targetHeight / size.y;
    bodyGroup.scale.setScalar(scale);

    // Center horizontally and place feet on platform
    bodyGroup.position.x = -center.x * scale;
    bodyGroup.position.z = -center.z * scale;
    bodyGroup.position.y = -(box.min.y * scale);

    scene.add(bodyGroup);

    // Classify meshes by type using embedded metadata
    bodyGroup.traverse((child) => {
      if (child.isMesh) {
        child.userData.clickable = true;
        meshCollections.all.push(child);

        // CRITICAL: Clone material per-mesh so each is independent.
        // GLTF models share material instances — without this, changing
        // opacity/emissive on one mesh affects ALL meshes using that material.
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 1.0;

        // Store the cloned original for restore
        originalMaterials.set(child, child.material.clone());

        // Classify by userData type (from Z-Anatomy metadata)
        const meshType = (child.userData.type || '').toLowerCase();
        const meshName = (child.name || '').toLowerCase();

        if (meshType === 'muscle' || meshName.includes('muscle') || meshName.includes('muscl')) {
          meshCollections.muscles.push(child);
          child.userData.anatomyType = 'muscle';
        } else if (meshType === 'bone' || meshName.includes('bone') || meshName.includes('skel') ||
                   meshName.includes('rib') || meshName.includes('vertebr') || meshName.includes('femur') ||
                   meshName.includes('tibia') || meshName.includes('fibula') || meshName.includes('humer') ||
                   meshName.includes('radius') || meshName.includes('ulna') || meshName.includes('pelvi') ||
                   meshName.includes('scapula') || meshName.includes('clav') || meshName.includes('skull') ||
                   meshName.includes('cranium') || meshName.includes('mandib') || meshName.includes('sternum') ||
                   meshName.includes('patella') || meshName.includes('carp') || meshName.includes('tars') ||
                   meshName.includes('metacarp') || meshName.includes('metatars') || meshName.includes('phalanx') ||
                   meshName.includes('sacr') || meshName.includes('coccyx') || meshName.includes('ilium') ||
                   meshName.includes('ischium') || meshName.includes('pubis')) {
          meshCollections.bones.push(child);
          child.userData.anatomyType = 'bone';
        } else {
          // Default to muscle if type metadata exists
          if (meshType) {
            meshCollections.muscles.push(child);
            child.userData.anatomyType = 'muscle';
          }
        }
      }
    });

    modelLoaded = true;

    // Remove loading overlay with fade
    const loadEl = document.getElementById('model-loading');
    if (loadEl) {
      loadEl.style.transition = 'opacity 0.5s ease';
      loadEl.style.opacity = '0';
      setTimeout(() => loadEl.remove(), 500);
    }

    // Create procedural organ meshes (the GLTF model only has muscles + bones)
    createOrganMeshes();

    // Click tooltip will be created on first click
    createClickTooltip();

    const totalMeshes = meshCollections.all.length;
    const muscleCount = meshCollections.muscles.length;
    const boneCount = meshCollections.bones.length;
    const organCount = meshCollections.organs.length;

    Notifications.success(
      'Model Loaded',
      `${totalMeshes} structures (${muscleCount} muscles, ${boneCount} bones, ${organCount} organs). Click any part to explore.`
    );

    Analytics.trackEvent('anatomy', 'model_loaded', { meshes: totalMeshes });
  }

  function createClickTooltip() {
    // Create a single reusable tooltip element that follows clicks
    if (clickTooltipEl) return;
    clickTooltipEl = document.createElement('div');
    clickTooltipEl.className = 'anatomy-click-tooltip';
    clickTooltipEl.style.display = 'none';
    document.body.appendChild(clickTooltipEl);
  }

  function showClickTooltip(mesh, hitPoint) {
    if (!clickTooltipEl) createClickTooltip();

    const rawName = mesh.userData.nameDetail || mesh.userData.name || mesh.name || 'Unknown';
    const displayName = formatAnatomyName(rawName);
    const type = mesh.userData.anatomyType || mesh.userData.type || 'structure';
    const typeEmoji = mesh.userData.organEmoji || (type === 'muscle' ? '💪' : type === 'bone' ? '🦴' : '🫀');

    clickTooltipEl.innerHTML = `<span class="tooltip-emoji">${typeEmoji}</span><span class="tooltip-name">${displayName}</span><span class="tooltip-type">${type}</span>`;
    clickTooltipEl.style.display = 'flex';
    clickTooltipEl.classList.add('visible');

    // Store the 3D target so we can update screen position each frame
    clickTooltipTarget = hitPoint.clone();
    updateTooltipScreenPosition();

    // Auto-hide after 4 seconds
    if (clickTooltipEl._hideTimer) clearTimeout(clickTooltipEl._hideTimer);
    clickTooltipEl._hideTimer = setTimeout(() => {
      hideClickTooltip();
    }, 4000);
  }

  function hideClickTooltip() {
    if (!clickTooltipEl) return;
    clickTooltipEl.classList.remove('visible');
    setTimeout(() => {
      if (clickTooltipEl) clickTooltipEl.style.display = 'none';
    }, 300);
    clickTooltipTarget = null;
  }

  function updateTooltipScreenPosition() {
    if (!clickTooltipTarget || !clickTooltipEl || clickTooltipEl.style.display === 'none') return;

    const camera = SceneManager.getCamera();
    const canvas = document.getElementById('sim-canvas');
    if (!camera || !canvas) return;

    // Project the 3D point to 2D screen coordinates
    const projected = clickTooltipTarget.clone().project(camera);
    const rect = canvas.getBoundingClientRect();

    const x = ((projected.x + 1) / 2) * rect.width + rect.left;
    const y = ((-projected.y + 1) / 2) * rect.height + rect.top;

    // Position tooltip above the click point with a small offset
    clickTooltipEl.style.left = `${x}px`;
    clickTooltipEl.style.top = `${y - 50}px`;
  }

  /**
   * Load real anatomical organ GLTF models from HuBMAP CCF 3D Reference Library.
   * Source: Visual Human Male (CC BY 4.0) — scientifically vetted organ meshes.
   * Each organ is loaded from its own .glb file and positioned inside the body.
   */
  function createOrganMeshes() {
    const organDefs = [
      {
        file: 'models/organs/brain.glb',
        name: 'Brain', emoji: '🧠',
        desc: 'Contains ~86 billion neurons. Controls all body functions, thoughts, memory, and emotions. Weighs ~1.4 kg.',
        wiki: 'https://en.wikipedia.org/wiki/Human_brain',
        color: 0xffaaaa
      },
      {
        file: 'models/organs/heart.glb',
        name: 'Heart', emoji: '❤️',
        desc: 'A muscular organ that pumps blood through the circulatory system. It beats ~100,000 times per day, pumping ~7,500 liters of blood.',
        wiki: 'https://en.wikipedia.org/wiki/Heart',
        color: 0xcc2233
      },
      {
        file: 'models/organs/lungs.glb',
        name: 'Lungs & Respiratory System', emoji: '🫁',
        desc: 'Two spongy organs responsible for gas exchange — supplying oxygen and removing CO₂. Includes the trachea and bronchial tree. They process ~11,000 liters of air daily.',
        wiki: 'https://en.wikipedia.org/wiki/Lung',
        color: 0xee8899
      },
      {
        file: 'models/organs/liver.glb',
        name: 'Liver', emoji: '🫘',
        desc: 'The largest internal organ (~1.5 kg). Detoxifies blood, produces bile for digestion, stores glycogen, and synthesizes proteins.',
        wiki: 'https://en.wikipedia.org/wiki/Liver',
        color: 0x8b3520
      },
      {
        file: 'models/organs/kidney_left.glb',
        name: 'Left Kidney', emoji: '🫘',
        desc: 'Filters ~180 liters of blood daily, producing ~1-2 liters of urine. Regulates electrolytes, blood pressure, and pH balance.',
        wiki: 'https://en.wikipedia.org/wiki/Kidney',
        color: 0x993333
      },
      {
        file: 'models/organs/kidney_right.glb',
        name: 'Right Kidney', emoji: '🫘',
        desc: 'Positioned slightly lower than the left due to the liver. Contains ~1 million nephrons (microscopic filtering units).',
        wiki: 'https://en.wikipedia.org/wiki/Kidney',
        color: 0x993333
      },
      {
        file: 'models/organs/spleen.glb',
        name: 'Spleen', emoji: '🩸',
        desc: 'Filters blood, recycles old red blood cells, and stores white blood cells and platelets for immune defense.',
        wiki: 'https://en.wikipedia.org/wiki/Spleen',
        color: 0x772244
      },
      {
        file: 'models/organs/bladder.glb',
        name: 'Bladder', emoji: '💧',
        desc: 'A hollow muscular organ that stores urine before excretion. Can hold 400-600 mL when full.',
        wiki: 'https://en.wikipedia.org/wiki/Urinary_bladder',
        color: 0xddcc55
      },
      {
        file: 'models/organs/small_intestine.glb',
        name: 'Small Intestine', emoji: '🔄',
        desc: 'About 6 meters long, absorbs ~90% of nutrients from food through its massive inner surface area (~250 m²).',
        wiki: 'https://en.wikipedia.org/wiki/Small_intestine',
        color: 0xffaa88
      },
      {
        file: 'models/organs/pancreas.glb',
        name: 'Pancreas', emoji: '🔬',
        desc: 'Produces insulin to regulate blood sugar and digestive enzymes. Both an endocrine and exocrine gland.',
        wiki: 'https://en.wikipedia.org/wiki/Pancreas',
        color: 0xddaa66
      }
    ];

    // Create a container group for all organs.
    // The HuBMAP VH_Male models are in meters with origin near the pelvis floor.
    // Our body model is Z-Anatomy, scaled to 2.0 units tall (feet at y=0).
    //
    // Key calibration points (organ model Y -> body world Y):
    //   Organ lung tops:  Y_organ = 0.70  -> should map to body Y ≈ 1.40 (chest top)
    //   Organ bladder:    Y_organ = 0.03  -> should map to body Y ≈ 0.80 (pelvis)
    //   Organ brain top:  Y_organ = 0.90  -> should map to body Y ≈ 1.85 (head)
    //
    // Scale = (1.40 - 0.80) / (0.70 - 0.03) = 0.60 / 0.67 ≈ 0.90 ... too small.
    // Better: just use scale = target_body_height_of_organ_region / organ_region_height
    // Organ span: brain_top(0.90) - bladder_bottom(0.01) = 0.89
    // Body span: head(1.85) - pelvis(0.75) = 1.10
    // Scale = 1.10 / 0.89 ≈ 1.24 ... but the body model is wider, so let's try ~1.25
    //
    // Y offset: body_pelvis_Y - (organ_bladder_Y * scale) = 0.75 - (0.01 * 1.25) = 0.74
    const organContainer = new THREE.Group();
    organContainer.name = 'organContainer';

    const organScale = 1.25;
    organContainer.scale.setScalar(organScale);
    organContainer.position.y = 0.88;
    organContainer.position.z = 0.0;

    organContainer.visible = false; // hidden by default
    scene.add(organContainer);

    // Store reference so toggleSeeInside can show/hide it
    meshCollections._organContainer = organContainer;

    const loader = new THREE.GLTFLoader();

    organDefs.forEach(def => {
      loader.load(def.file, (gltf) => {
        const organ = gltf.scene;
        organ.name = def.name;

        // Apply organ color tint and metadata to all child meshes
        organ.traverse(child => {
          if (child.isMesh) {
            // Use the GLTF node's original name for specific identification
            // (e.g. "VH_M_trachea" instead of just "Lungs")
            const meshSpecificName = child.name
              ? child.name.replace(/^VH_M_/i, '').replace(/_/g, ' ')
              : def.name;

            // Clone material for per-mesh independence
            child.material = child.material.clone();
            child.material.color = new THREE.Color(def.color);
            child.material.roughness = 0.6;
            child.material.metalness = 0.05;
            child.material.transparent = true;
            child.material.opacity = 1.0;
            child.material.side = THREE.DoubleSide;

            child.userData = {
              clickable: true,
              anatomyType: 'organ',
              name: meshSpecificName,
              nameDetail: meshSpecificName,
              organSystem: def.name,
              organDescription: def.desc,
              wikiLink: def.wiki,
              organEmoji: def.emoji
            };

            // Store original material for restore
            originalMaterials.set(child, child.material.clone());
            meshCollections.organs.push(child);
            meshCollections.all.push(child);
          }
        });

        organContainer.add(organ);
        console.log(`Loaded organ: ${def.name} (${meshCollections.organs.length} organ meshes total)`);
      },
      undefined,
      (err) => console.warn(`Could not load organ: ${def.file}`, err));
    });
  }

  function formatAnatomyName(raw) {
    // Convert mesh names like "pectoralis_major_muscle_left" to "Pectoralis Major"
    return raw
      .replace(/_/g, ' ')
      .replace(/\b(muscle|bone|left|right|l |r )\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ')
      .trim();
  }

  /**
   * Get the real-world center of a mesh by computing its bounding box.
   * GLTF meshes often have position=(0,0,0) with geometry offset in vertices.
   */
  function getMeshCenter(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return center;
  }

  function focusOnMesh(mesh, hitPoint) {
    if (!mesh) return;

    const camera = SceneManager.getCamera();
    const controls = SceneManager.getControls();

    // Use raycast hit point if available, otherwise compute bounding box center
    const targetPos = hitPoint ? hitPoint.clone() : getMeshCenter(mesh);

    // Compute a camera position that looks at the target from a good angle
    // Keep the camera roughly where it is but zoom toward the target
    const currentDir = camera.position.clone().sub(controls.target).normalize();
    const meshBox = new THREE.Box3().setFromObject(mesh);
    const meshSize = meshBox.getSize(new THREE.Vector3());
    const maxDim = Math.max(meshSize.x, meshSize.y, meshSize.z);
    // Distance = proportional to the size of the part, but with min/max bounds
    const viewDist = Math.max(0.4, Math.min(1.5, maxDim * 3));
    const newCamPos = targetPos.clone().add(currentDir.multiplyScalar(viewDist));

    // Simple lerp animation
    const startPos = camera.position.clone();
    const startTarget = controls.target.clone();
    let t = 0;
    const duration = 45; // frames (~0.75s at 60fps)

    function animateCamera() {
      t++;
      const progress = Math.min(t / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      camera.position.lerpVectors(startPos, newCamPos, eased);
      controls.target.lerpVectors(startTarget, targetPos, eased);
      controls.update();

      if (progress < 1) requestAnimationFrame(animateCamera);
    }
    requestAnimationFrame(animateCamera);

    // Show info about this mesh
    showMeshInfo(mesh);
    highlightMesh(mesh);

    // Show floating tooltip near the click point
    const tooltipPoint = hitPoint ? hitPoint.clone() : getMeshCenter(mesh);
    showClickTooltip(mesh, tooltipPoint);
  }

  function highlightMesh(mesh) {
    // Restore previous highlight first
    restoreAllMaterials();

    highlightedMesh = mesh;

    // 1. Gently dim other meshes (not too aggressive since materials are now per-mesh)
    meshCollections.all.forEach(m => {
      if (m !== mesh && m.visible && m.material) {
        m.material.opacity = 0.35;
      }
    });

    // 2. Make the selected mesh pop with bright emissive glow
    if (mesh.material) {
      mesh.material.opacity = 1.0;
      mesh.material.emissive = new THREE.Color(0x00ddff);
      mesh.material.emissiveIntensity = 0.8;
    }

    // Auto-restore after a few seconds
    if (highlightTimeout) clearTimeout(highlightTimeout);
    highlightTimeout = setTimeout(() => {
      if (highlightedMesh === mesh) {
        restoreAllMaterials();
        highlightedMesh = null;
      }
    }, 4000);
  }

  function restoreAllMaterials() {
    meshCollections.all.forEach(m => {
      if (!m.material) return; // skip organ Groups
      m.material.opacity = 1.0;
      if (m.material.emissive) {
        m.material.emissive = new THREE.Color(0x000000);
        m.material.emissiveIntensity = 0;
      }
    });
  }

  function showMeshInfo(mesh) {
    const rawName = mesh.userData.nameDetail || mesh.userData.name || mesh.name || 'Unknown';
    const displayName = formatAnatomyName(rawName);
    const type = mesh.userData.anatomyType || mesh.userData.type || 'structure';
    const wikiLink = mesh.userData.wikiLink || `https://en.wikipedia.org/wiki/${encodeURIComponent(rawName.replace(/_/g, ' '))}`;

    // Use organ-specific emoji and description if available
    const typeEmoji = mesh.userData.organEmoji || (type === 'muscle' ? '💪' : type === 'bone' ? '🦴' : '🫀');
    const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);

    // Build description — include organ system if this is a sub-part
    let description = mesh.userData.organDescription ||
      `${typeLabel} structure. Click "Learn More" for detailed anatomical information on Wikipedia.`;

    // If this mesh is part of a larger organ system, note it
    const organSystem = mesh.userData.organSystem;
    if (organSystem && organSystem !== displayName) {
      description = `Part of: ${organSystem}\n\n${description}`;
    }

    const info = {
      name: `${typeEmoji} ${displayName}`,
      description: description,
      tags: [typeLabel, type === 'organ' ? (organSystem || 'Organ System') : 'Z-Anatomy', `<a href="${wikiLink}" target="_blank" style="color: var(--primary); text-decoration: none;">📖 Learn More</a>`]
    };

    HUD.updateAnatomyInfo(info);

    // Track interaction
    inspectedParts.add(rawName);
    Objectives.complete('inspect_part');
    if (inspectedParts.size >= 3) Objectives.complete('explore_3');
    if (inspectedParts.size >= 5) Objectives.complete('explore_5');

    Analytics.trackEvent('anatomy', 'inspect', { part: displayName, type });
  }

  function registerHUD() {
    HUD.onCallback('layerToggle', (layer, active) => {
      toggleLayer(layer, active);
      Analytics.trackEvent('anatomy', 'toggle_layer', { layer, active });
      Objectives.complete('toggle_layer');
      if (layer === 'skeleton' || layer === 'bones') Objectives.complete('view_skeleton');
    });

    HUD.onCallback('anatomyParam', (param, value) => {
      if (param === 'opacity') {
        const opacity = value / 100;
        // Only apply transparency to muscles — bones stay fully visible
        meshCollections.muscles.forEach(mesh => {
          mesh.material.opacity = opacity;
        });
        // If muscles are significantly transparent, show organs and add bone glow
        if (opacity < 0.5) {
          meshCollections.bones.forEach(mesh => {
            mesh.material.opacity = 1.0;
            mesh.material.emissive = new THREE.Color(0x1a8aff);
            mesh.material.emissiveIntensity = 0.15;
          });
          // Show organs
          if (meshCollections._organContainer) {
            meshCollections._organContainer.visible = true;
          }
        } else {
          meshCollections.bones.forEach(mesh => {
            mesh.material.emissive = new THREE.Color(0x000000);
            mesh.material.emissiveIntensity = 0;
          });
          // Hide organs
          if (meshCollections._organContainer) {
            meshCollections._organContainer.visible = false;
          }
        }
      }
    });

    HUD.onCallback('anatomyView', (view) => {
      const camera = SceneManager.getCamera();
      const controls = SceneManager.getControls();
      if (view === 'front') {
        camera.position.set(0, 1.0, 3.2);
      } else if (view === 'back') {
        camera.position.set(0, 1.0, -3.2);
      } else {
        camera.position.set(1.8, 1.3, 2.5);
      }
      controls.target.set(0, 0.85, 0);
      controls.update();
    });

    // X-Ray mode
    HUD.onCallback('xrayToggle', (active) => {
      xrayMode = active;
      toggleXRay(active);
      Objectives.complete('xray_mode');
    });

    // See Inside mode — makes muscles semi-transparent to reveal bones
    HUD.onCallback('seeInsideToggle', (active) => {
      toggleSeeInside(active);
      Objectives.complete('view_organs');
    });

    // Search
    HUD.onCallback('anatomySearch', (query) => {
      searchAnatomy(query);
    });
  }

  function toggleLayer(layer, visible) {
    if (layer === 'organs') {
      // Show/hide the entire organ container group
      if (meshCollections._organContainer) {
        meshCollections._organContainer.visible = visible;
      }
      layerVisibility[layer] = visible;
      return;
    }

    const layerMap = {
      'muscles': meshCollections.muscles,
      'bones': meshCollections.bones,
      'skeleton': meshCollections.bones
    };

    const meshes = layerMap[layer];
    if (meshes) {
      meshes.forEach(mesh => {
        mesh.visible = visible;
      });
    }

    layerVisibility[layer] = visible;
  }

  function toggleXRay(active) {
    meshCollections.all.forEach(mesh => {
      if (!mesh.material) return;
      if (active) {
        mesh.material.wireframe = true;
        mesh.material.opacity = 0.5;
        mesh.visible = true;
      } else {
        mesh.material.wireframe = false;
        mesh.material.opacity = 1.0;
      }
    });
    // Show/hide organ container in x-ray
    if (meshCollections._organContainer) {
      meshCollections._organContainer.visible = active;
    }
  }

  function toggleSeeInside(active) {
    if (active) {
      // Make muscles semi-transparent so bones & organs show through
      meshCollections.muscles.forEach(mesh => {
        mesh.material.opacity = 0.15;
      });
      // Keep bones visible but semi-transparent so organs show through
      meshCollections.bones.forEach(mesh => {
        mesh.material.opacity = 0.4;
        mesh.material.emissive = new THREE.Color(0x1a8aff);
        mesh.material.emissiveIntensity = 0.15;
      });
      // Show organ container
      if (meshCollections._organContainer) {
        meshCollections._organContainer.visible = true;
      }
      Notifications.info('See Inside', 'Muscles are transparent. Click on organs and bones to inspect them.');
    } else {
      // Restore muscles
      meshCollections.muscles.forEach(mesh => {
        mesh.material.opacity = 1.0;
      });
      // Restore bones
      meshCollections.bones.forEach(mesh => {
        mesh.material.opacity = 1.0;
        mesh.material.emissive = new THREE.Color(0x000000);
        mesh.material.emissiveIntensity = 0;
      });
      // Hide organ container
      if (meshCollections._organContainer) {
        meshCollections._organContainer.visible = false;
      }
    }
  }

  function searchAnatomy(query) {
    if (!query || query.length < 2) return;

    const q = query.toLowerCase();
    let found = null;

    meshCollections.all.forEach(mesh => {
      const name = (mesh.userData.nameDetail || mesh.userData.name || mesh.name || '').toLowerCase();
      if (name.includes(q) && !found) {
        found = mesh;
      }
    });

    if (found) {
      focusOnMesh(found, getMeshCenter(found));
      Notifications.success('Found', `"${formatAnatomyName(found.userData.name || found.name)}"`);
      Objectives.complete('search_structure');
    } else {
      Notifications.info('Not Found', `No structure matching "${query}"`);
    }
  }

  function onBodyClick(event) {
    if (!modelLoaded) return;
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, SceneManager.getCamera());

    const visibleMeshes = meshCollections.all.filter(m => m.visible);
    const hits = raycaster.intersectObjects(visibleMeshes, false);

    if (hits.length > 0) {
      // Find the first hit that is NOT a transparent/ghostly mesh.
      const solidHit = hits.find(h => {
        const mat = h.object.material;
        return mat && mat.opacity > 0.5;
      });
      const hit = solidHit || hits[0];
      const mesh = hit.object;
      focusOnMesh(mesh, hit.point);
    }
  }

  let hoveredMesh = null;

  function onBodyHover(event) {
    if (!modelLoaded) return;
    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, SceneManager.getCamera());

    const visibleMeshes = meshCollections.all.filter(m => m.visible);
    const hits = raycaster.intersectObjects(visibleMeshes, false);

    // Cursor feedback
    canvas.style.cursor = hits.length > 0 ? 'pointer' : 'grab';

    // Don't mess with hover highlight while a click-highlight is active
    if (highlightedMesh) return;

    // Clear previous hover
    if (hoveredMesh) {
      if (hoveredMesh.material && hoveredMesh.material.emissive) {
        hoveredMesh.material.emissive = new THREE.Color(0x000000);
        hoveredMesh.material.emissiveIntensity = 0;
      }
      hoveredMesh = null;
    }

    // Apply subtle hover glow to the mesh under cursor
    if (hits.length > 0) {
      // Prefer solid mesh over transparent ones
      const solidHit = hits.find(h => {
        const mat = h.object.material;
        return mat && mat.opacity > 0.5;
      });
      const targetMesh = solidHit ? solidHit.object : hits[0].object;
      hoveredMesh = targetMesh;
      if (hoveredMesh.material && hoveredMesh.material.emissive) {
        hoveredMesh.material.emissive = new THREE.Color(0x3b82f6);
        hoveredMesh.material.emissiveIntensity = 0.25;
      }
    }
  }

  function update(sceneRef, camera) {
    // Update tooltip screen position each frame
    updateTooltipScreenPosition();
  }

  function reset() {
    // Show all meshes
    meshCollections.all.forEach(mesh => {
      mesh.visible = true;
      const origMat = originalMaterials.get(mesh);
      if (origMat) {
        mesh.material.wireframe = false;
        mesh.material.opacity = 1.0;
        mesh.material.emissive = new THREE.Color(0x000000);
        mesh.material.emissiveIntensity = 0;
      }
    });

    xrayMode = false;
    highlightedMesh = null;
    layerVisibility.muscles = true;
    layerVisibility.bones = true;

    const camera = SceneManager.getCamera();
    camera.position.set(0, 1.0, 3.2);
    const controls = SceneManager.getControls();
    controls.target.set(0, 0.85, 0);
    controls.update();
    Notifications.info('Reset', 'Anatomy explorer reset to default view.');
  }

  function cleanup() {
    const canvas = document.getElementById('sim-canvas');
    if (canvas) {
      canvas.removeEventListener('click', onBodyClick);
      canvas.removeEventListener('mousemove', onBodyHover);
    }

    // Remove floating labels
    floatingLabels.forEach(label => {
      if (label.element) label.element.remove();
      scene.remove(label);
    });
    floatingLabels.length = 0;

    // Remove click tooltip
    if (clickTooltipEl) {
      clickTooltipEl.remove();
      clickTooltipEl = null;
    }
    clickTooltipTarget = null;
    inspectedParts.clear();
    modelLoaded = false;
    highlightedMesh = null;
    meshCollections.muscles.length = 0;
    meshCollections.bones.length = 0;
    meshCollections.all.length = 0;
    originalMaterials.clear();

    // Remove loading overlay if still present
    const loadEl = document.getElementById('model-loading');
    if (loadEl) loadEl.remove();
  }

  return { init, update, reset, cleanup };
})();
