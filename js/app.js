/**
 * app.js — Main Application Controller for EduSim
 * Handles page routing, simulation lifecycle, background animation
 */
const App = (() => {
  let currentSim = null;
  const simModules = {
    anatomy: { module: AnatomySim, title: '🫀 Anatomy Explorer', color: '#ef4444' }
  };

  // Tutorial steps per simulation
  const tutorials = {
    anatomy: [
      { title: 'Welcome to the Anatomy Explorer', text: 'Explore the human body in 3D. Click and drag to rotate, scroll to zoom.' },
      { title: 'Toggle Body Layers', text: 'Use the left panel to show/hide muscles, bones, and organs.' },
      { title: 'Inspect Structures', text: 'Click any visible body part to see detailed anatomical information in the right panel.' }
    ]
  };
  let tutorialStep = 0;
  let tutorialType = null;

  function init() {
    // Initialize analytics
    Analytics.init();

    // Set up animated background
    initBackground();

    // Initialize preview cards
    setTimeout(() => {
      SceneManager.startPreviews();
    }, 100);

    // Initialize dashboard
    setTimeout(() => {
      Dashboard.init();
    }, 300);

    // Bind events
    bindEvents();

    // Hide loading screen
    setTimeout(() => {
      const loader = document.getElementById('loading-screen');
      if (loader) loader.classList.add('hidden');
      setTimeout(() => loader?.remove(), 500);
    }, 800);

    // Welcome notification
    setTimeout(() => {
      Notifications.info('Welcome to EduSim', 'Select a simulation to begin learning in 3D');
    }, 1200);
  }

  function bindEvents() {
    // Simulation card clicks
    document.getElementById('card-anatomy')?.addEventListener('click', () => launchSim('anatomy'));

    // Keyboard nav for cards
    document.querySelectorAll('.sim-card').forEach(card => {
      card.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          card.click();
        }
      });
    });

    // Back button
    document.getElementById('sim-back')?.addEventListener('click', exitSim);

    // Reset button
    document.getElementById('sim-reset')?.addEventListener('click', () => {
      if (currentSim && simModules[currentSim]) {
        simModules[currentSim].module.reset();
      }
    });



    // Hero buttons
    document.getElementById('btn-explore')?.addEventListener('click', () => {
      launchSim('anatomy');
    });
    document.getElementById('btn-dashboard')?.addEventListener('click', () => {
      document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' });
    });

    // Nav links
    document.getElementById('nav-home')?.addEventListener('click', () => {
      if (currentSim) exitSim();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Tutorial next
    document.getElementById('tutorial-next')?.addEventListener('click', nextTutorialStep);

    // Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && currentSim) exitSim();
    });
  }

  function launchSim(type) {
    if (!simModules[type]) return;
    currentSim = type;

    const simView = document.getElementById('simulation-view');
    const landing = document.getElementById('landing-page');
    const nav = document.getElementById('main-nav');

    // Update toolbar title
    document.getElementById('sim-title').textContent = simModules[type].title;

    // Show simulation view
    simView.classList.add('active');
    landing.style.display = 'none';
    nav.style.display = 'none';

    // Initialize Three.js scene
    const container = document.getElementById('sim-canvas-container');
    const canvas = document.getElementById('sim-canvas');
    const { scene } = SceneManager.initMain(container, canvas);

    // Render HUD
    HUD.render(type);

    // Initialize learning objectives
    Objectives.init(type);

    // Initialize simulation module
    simModules[type].module.init(scene);

    // Start render loop
    SceneManager.startLoop((s, c) => simModules[type].module.update(s, c));

    // Show tutorial
    showTutorial(type);

    // Track
    Analytics.trackEvent(type, 'launch');
  }

  function exitSim() {
    if (!currentSim) return;

    // Cleanup simulation
    if (simModules[currentSim]) {
      simModules[currentSim].module.cleanup();
    }

    // Stop render loop and destroy scene
    SceneManager.destroy();
    HUD.clear();
    Objectives.clear();

    // Hide simulation view
    const simView = document.getElementById('simulation-view');
    const landing = document.getElementById('landing-page');
    const nav = document.getElementById('main-nav');

    simView.classList.remove('active');
    landing.style.display = '';
    nav.style.display = '';

    // Hide tutorial
    const tutOverlay = document.getElementById('tutorial-overlay');
    if (tutOverlay) tutOverlay.classList.add('hidden');

    Analytics.trackEvent(currentSim, 'exit');
    currentSim = null;

    // Restart previews
    setTimeout(() => SceneManager.startPreviews(), 200);
  }

  function showTutorial(type) {
    tutorialType = type;
    tutorialStep = 0;

    const steps = tutorials[type];
    if (!steps || steps.length === 0) return;

    const overlay = document.getElementById('tutorial-overlay');
    overlay.classList.remove('hidden');

    updateTutorialUI();
  }

  function updateTutorialUI() {
    const steps = tutorials[tutorialType];
    if (!steps) return;

    const step = steps[tutorialStep];
    document.getElementById('tutorial-step').textContent = `Step ${tutorialStep + 1} of ${steps.length}`;
    document.getElementById('tutorial-title').textContent = step.title;
    document.getElementById('tutorial-text').textContent = step.text;

    const btn = document.getElementById('tutorial-next');
    btn.textContent = tutorialStep < steps.length - 1 ? 'Next →' : 'Start Exploring →';
  }

  function nextTutorialStep() {
    const steps = tutorials[tutorialType];
    if (!steps) return;

    tutorialStep++;
    if (tutorialStep >= steps.length) {
      // Close tutorial
      document.getElementById('tutorial-overlay').classList.add('hidden');
      tutorialStep = 0;
      tutorialType = null;
    } else {
      updateTutorialUI();
    }
  }



  // ---- Animated Background (particle field) ----
  function initBackground() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    let w, h;

    function resize() {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    }

    function createParticles() {
      particles = [];
      const count = Math.min(Math.floor((w * h) / 15000), 80);
      for (let i = 0; i < count; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: 1 + Math.random() * 1.5,
          alpha: 0.1 + Math.random() * 0.3,
          hue: 210 + Math.random() * 60
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);

      // Draw connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < 150) {
            ctx.strokeStyle = `hsla(220, 60%, 60%, ${0.08 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      // Draw particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;

        ctx.fillStyle = `hsla(${p.hue}, 70%, 65%, ${p.alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });

      requestAnimationFrame(draw);
    }

    resize();
    createParticles();
    draw();

    window.addEventListener('resize', EduUtils.debounce(() => {
      resize();
      createParticles();
    }, 200));
  }

  // Boot
  document.addEventListener('DOMContentLoaded', init);

  return { launchSim, exitSim };
})();
