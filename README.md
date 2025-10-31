# Stellar Simulator — Three.js

Interactive planetary system built with **Three.js** featuring lighting, textures, and two camera modes: an orbiting **Overview** and a first-person **Ship** view mounted on an invisible craft. Includes an in-app GUI (lil‑gui) for real‑time controls.

> **Live Demo (CodeSandbox):** https://pdnqqd.csb.app/

> **Demo video:** [View video](media/DEMO-IG.mp4)
 

---

##  Features

- **Planets & Moons:** Six planets (Mercury, Venus, Earth, Mars, Jupiter, Saturn) and at least one moon (Earth’s Moon; optional Io for Jupiter).
- **Lighting:** PointLight at the Sun for realistic shading and soft shadows.
- **Textures:** 2K color maps; Earth includes an optional specular map.
- **Two Views:**  
  - **Overview:** OrbitControls to freely explore the scene.  
  - **Ship:** First‑person view from an invisible ship you can pilot.
- **GUI:** Pause, time scaling, toggles for stars/orbits, sun intensity, and more.
- **Clean architecture:** Pivot‑based orbits (Object3D) and per‑body self‑rotation.

---

##  Controls

### Overview (OrbitControls)
- **Mouse drag:** orbit
- **Mouse wheel / pinch:** zoom
- **Right‑drag / middle‑drag:** pan
- **GUI panels:** Simulation, View, Sun Light (see below)

### Ship (first‑person)
- **W / S:** accelerate / reverse  
- **A / D:** yaw (turn left/right)  
- **Shift:** turbo boost  
- **V:** toggle **Overview ↔ Ship**

---

##  GUI 

- **Simulation**
  - `Paused` — freeze/unfreeze simulation
  - `Time Scale` — speed up or slow down rotations & orbits
- **View**
  - `Camera` — Overview or Ship
  - `Show Orbits` — toggle orbit lines
  - `Show Stars` — toggle skydome
- **Sun Light**
  - `Intensity` — brightness of the PointLight at the Sun

---

##  Project Structure

```
.
├─ index.html
├─ miscript.js
├─ package.json
└─ src/
   ├─ 2k_stars_milky_way.jpg
   ├─ 2k_sun.jpg
   ├─ 2k_mercury.jpg
   ├─ 2k_venus.jpg
   ├─ 2k_earth.jpg
   ├─ 2k_earth_specular_map.jpg   # optional
   ├─ 2k_moon.jpg
   ├─ 2k_mars.jpg
   ├─ 2k_jupiter.jpg
   └─ 2k_saturn.jpg
```
---

##  Implementation Notes

- **Rendering:** `WebGLRenderer` with soft shadows; output color space set to sRGB.
- **Materials:** `MeshPhongMaterial` for planets (accepts maps/specular); `MeshBasicMaterial` for Sun and star dome.
- **Orbits:** Each planet has a `pivot (Object3D)` at the Sun; the mesh is offset by its orbital radius and the pivot rotates.
- **Performance tips:**
  - Keep texture sizes reasonable (2K is fine).  
  - Limit shadow casters if needed.  
  - Disable orbit lines/stars on low‑end devices.

---

## 🌐 Share a Render‑Only Link

- **CodeSandbox Live**: use the **`.csb.app`** link to show only the running app.

---

##  License 
ULPGC — © Raul Reguera Bravo
