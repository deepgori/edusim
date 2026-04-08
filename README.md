# 🧬 EduSim — Interactive 3D Educational Simulations

A web-based platform for immersive, interactive 3D educational simulations. Built with **Three.js**, **Chart.js**, and vanilla **JavaScript/HTML/CSS** — no build tools or frameworks required.

> **Live Demo:** Clone the repo and run `python3 -m http.server 8080` — open [localhost:8080](http://localhost:8080)

---

## ✨ Features

### 🧪 Chemistry Lab
- Interactive 3D lab environment with beakers, flasks, and Bunsen burner
- **Drag-and-drop** chemical mixing — drag beakers to the reaction flask
- Real-time temperature, pH, and safety monitoring via HUD panels
- Exothermic/endothermic reaction classification with particle effects
- Chemical selector (HCl, NaOH, H₂O, Na, Indicator, Catalyst)

### ⚡ Physics Sandbox
- Adjustable launch parameters (angle, velocity, gravity) via interactive sliders
- Real-time projectile motion with parabolic trajectory visualization
- Live data overlay: position, speed, max height, range
- **Compare mode** — overlay multiple trajectories with different parameters
- Trajectory counter and color-coded trail rendering

### 🫀 Anatomy Explorer
- Procedural 3D human body model with 5 toggleable systems:
  - Skin → Muscles → Skeleton → Organs → Circulatory
- Click any body part for detailed anatomical information (13 structures)
- Transparency slider and multi-angle view controls (Front / 3D / Back)
- Animated heartbeat and pulsing glow ring

### 📊 Student Analytics Dashboard
- 4 interactive Chart.js visualizations:
  - **Learning Progress** (Line chart — 8-week score trends)
  - **Module Completion** (Doughnut chart)
  - **Time Distribution** (Stacked bar chart by day)
  - **Score Breakdown** (Radar chart — 5 dimensions per simulation)
- Real-time session tracking with localStorage persistence
- Key metrics: Total Sessions, Time Invested, Avg Score, Completion Rate

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| 3D Engine | [Three.js](https://threejs.org) r128 | WebGL rendering, scene management |
| Charts | [Chart.js](https://chartjs.org) 4.x | Data visualization dashboard |
| Styling | Vanilla CSS | Glassmorphism, dark mode, animations |
| Logic | ES6+ JavaScript | OOP modules, event system |
| Structure | HTML5 | Semantic markup, accessibility |
| Typography | [Inter](https://fonts.google.com/specimen/Inter) | Modern font system |

**Zero build tools** — runs from any static HTTP server.

---

## 📁 Project Structure

```
edusim/
├── index.html                 # Single-page application
├── favicon.png                # App icon
├── css/
│   └── styles.css             # Design system (700+ lines)
├── js/
│   ├── app.js                 # Main controller & routing
│   ├── sceneManager.js        # Three.js lifecycle & preview renderer
│   ├── simulations/
│   │   ├── chemistry.js       # Chemistry lab (drag-and-drop, reactions)
│   │   ├── physics.js         # Projectile motion (trajectories)
│   │   └── anatomy.js         # Body explorer (layered systems)
│   ├── ui/
│   │   ├── dashboard.js       # Chart.js dashboard (4 charts)
│   │   ├── hud.js             # Contextual HUD panels
│   │   └── notifications.js   # Toast notification system
│   └── utils/
│       ├── analytics.js       # Session tracking & persistence
│       └── helpers.js         # Math, color, utility functions
└── README.md
```

---

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/deepgori/edusim.git
cd edusim

# Serve locally (any of these work)
python3 -m http.server 8080
# or
npx serve .
# or use VS Code Live Server

# Open in browser
open http://localhost:8080
```

---

## 🎯 Design Decisions

- **No frameworks** — Deliberately built with vanilla JS/HTML/CSS to demonstrate core web fundamentals
- **Three.js via CDN** — No npm/webpack complexity; keeps the project instantly runnable
- **Modular IIFE pattern** — Each simulation is a self-contained module with `init()`, `update()`, `reset()`, `cleanup()` lifecycle
- **Glassmorphism + Dark Mode** — Modern, visually striking aesthetic suitable for a science/education platform
- **Progressive disclosure** — Tutorial overlays guide first-time users; HUD panels reveal data contextually

---

## 📄 License

MIT License — Deep Gori © 2025
