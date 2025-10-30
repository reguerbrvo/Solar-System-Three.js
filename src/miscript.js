// miscript.js
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import GUI from "lil-gui";

let scene, renderer;
let camOverview, camShip, controls; // dos cámaras y sus controles
let activeCamera; // la cámara usada para render
let sun,
  sunLight,
  sky = null;
const planets = []; // { name, pivot, mesh, selfRotSpeed, orbitSpeed, orbitLine }
const moons = [];

const gui = new GUI();
const params = {
  paused: false,
  timeScale: 1.0,
  showOrbits: true,
  showStars: true,
  sunIntensity: 2.0,
  view: "Overview", // "Overview" | "Ship"
};

// ===== Nave (objeto invisible con cámara montada) =====
let ship; // THREE.Object3D (sin mallas visibles)
const shipState = {
  vel: new THREE.Vector3(0, 0, 0),
  accel: 12,
  maxSpeed: 50,
  damping: 0.96,
  turnSpeed: THREE.MathUtils.degToRad(90),
  boostMult: 2.0,
};
const keys = new Set();

init();
animate();

function init() {
  scene = new THREE.Scene();

  // === CÁMARAS ===
  camOverview = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    4000
  );
  camOverview.position.set(0, 25, 55);
  camShip = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    4000
  );

  activeCamera = camOverview;

  // === RENDERER ===
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.appendChild(renderer.domElement);

  // === CONTROLES (solo para la vista Overview) ===
  controls = new OrbitControls(camOverview, renderer.domElement);

  // === TEXTURAS ===
  const loader = new THREE.TextureLoader().setPath("src/");
  const loadTex = (filename, opts) => {
    const options = opts || {};
    const isColor = options.isColor === undefined ? true : options.isColor;
    if (!filename) return null;
    const tex = loader.load(filename, undefined, undefined, function () {});
    if (isColor && tex) tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  // Fondo estelar
  const starsTex = loadTex("2k_stars_milky_way.jpg");
  if (starsTex) {
    sky = new THREE.Mesh(
      new THREE.SphereGeometry(1000, 64, 64),
      new THREE.MeshBasicMaterial({ map: starsTex, side: THREE.BackSide })
    );
    scene.add(sky);
  } else {
    scene.background = new THREE.Color(0x000000);
  }

  // === SOL con textura + luz ===
  const sunTex = loadTex("2k_sun.jpg");
  const sunGeo = new THREE.SphereGeometry(5, 32, 32);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  if (sunTex) sunMat.map = sunTex;
  sun = new THREE.Mesh(sunGeo, sunMat);
  scene.add(sun);

  sunLight = new THREE.PointLight(0xffffff, params.sunIntensity, 2000);
  sunLight.position.set(0, 0, 0);
  sunLight.castShadow = true;
  scene.add(sunLight);

  // === Útil para órbitas ===
  function drawOrbit(r) {
    const curve = new THREE.EllipseCurve(0, 0, r, r, 0, Math.PI * 2);
    const pts = curve.getPoints(128).map((p) => new THREE.Vector3(p.x, 0, p.y));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x333333 });
    const line = new THREE.LineLoop(geo, mat);
    scene.add(line);
    return line;
  }

  // === Creadores de planeta y luna ===
  function createPlanet(cfg) {
    const {
      name,
      radius,
      distance,
      color,
      textureFile,
      texture,
      specularFile,
      selfRotSpeed,
      orbitSpeed,
    } = Object.assign(
      {
        name: "planet",
        color: 0xffffff,
        textureFile: null,
        texture: null,
        specularFile: null,
        selfRotSpeed: 0.02,
        orbitSpeed: 0.01,
      },
      cfg || {}
    );

    const pivot = new THREE.Object3D();
    scene.add(pivot);

    const mapTex = texture || (textureFile ? loadTex(textureFile) : null);
    const specTex = specularFile
      ? loadTex(specularFile, { isColor: false })
      : null;
    const matOpts = mapTex ? { map: mapTex } : { color: color };
    const mat = new THREE.MeshPhongMaterial(matOpts);
    if (specTex) {
      mat.specularMap = specTex;
      mat.shininess = 10;
    }

    const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 32), mat);
    mesh.position.set(distance, 0, 0);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.name = name;

    pivot.add(mesh);
    const orbitLine = drawOrbit(distance);

    const rec = { name, pivot, mesh, selfRotSpeed, orbitSpeed, orbitLine };
    planets.push(rec);
    return rec;
  }

  function createMoon(planetRecord, cfg) {
    const {
      name,
      radius,
      distance,
      color,
      textureFile,
      texture,
      selfRotSpeed,
      orbitSpeed,
    } = Object.assign(
      {
        name: "moon",
        color: 0xffffff,
        textureFile: null,
        texture: null,
        selfRotSpeed: 0.02,
        orbitSpeed: 0.04,
      },
      cfg || {}
    );

    const moonPivot = new THREE.Object3D();
    planetRecord.mesh.add(moonPivot);

    const mapTex = texture || (textureFile ? loadTex(textureFile) : null);
    const mat = new THREE.MeshPhongMaterial(
      mapTex ? { map: mapTex } : { color: color }
    );

    const moon = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 24), mat);
    moon.position.set(distance, 0, 0);
    moon.castShadow = true;
    moon.receiveShadow = true;
    moon.userData.name = name;

    moonPivot.add(moon);
    moons.push({ pivot: moonPivot, mesh: moon, selfRotSpeed, orbitSpeed });

    return { pivot: moonPivot, mesh: moon };
  }

  // === Planetas y lunas ===
  createPlanet({
    name: "Mercury",
    radius: 0.8,
    distance: 9,
    textureFile: "2k_mercury.jpg",
    selfRotSpeed: 0.015,
    orbitSpeed: 0.024,
  });
  createPlanet({
    name: "Venus",
    radius: 1.2,
    distance: 12,
    textureFile: "2k_venus.jpg",
    selfRotSpeed: 0.01,
    orbitSpeed: 0.017,
  });

  const earth = createPlanet({
    name: "Earth",
    radius: 2,
    distance: 15,
    textureFile: "2k_earth.jpg",
    specularFile: "2k_earth_specular_map.jpg",
    selfRotSpeed: 0.02,
    orbitSpeed: 0.012,
  });
  createMoon(earth, {
    name: "Moon",
    radius: 0.5,
    distance: 3.2,
    textureFile: "2k_moon.jpg",
    selfRotSpeed: 0.02,
    orbitSpeed: 0.06,
  });

  createPlanet({
    name: "Mars",
    radius: 1.1,
    distance: 19,
    textureFile: "2k_mars.jpg",
    selfRotSpeed: 0.018,
    orbitSpeed: 0.01,
  });

  const jupiter = createPlanet({
    name: "Jupiter",
    radius: 3.5,
    distance: 26,
    textureFile: "2k_jupiter.jpg",
    selfRotSpeed: 0.03,
    orbitSpeed: 0.006,
  });
  createMoon(jupiter, {
    name: "Io",
    radius: 0.6,
    distance: 5,
    textureFile: "2k_moon.jpg",
    selfRotSpeed: 0.03,
    orbitSpeed: 0.08,
  });

  createPlanet({
    name: "Saturn",
    radius: 3.2,
    distance: 34,
    textureFile: "2k_saturn.jpg",
    selfRotSpeed: 0.028,
    orbitSpeed: 0.004,
  });

  // === NAVE INVISIBLE ===
  ship = new THREE.Object3D(); // sin geometrías ni materiales -> invisible
  scene.add(ship);
  // posición inicial de la nave (cerca de la órbita de la Tierra)
  ship.position.set(0, 0, 18);
  ship.rotation.order = "YXZ";

  // Cámara de la nave montada en el objeto invisible
  ship.add(camShip);
  camShip.position.set(0, 0.4, 0.2);
  camShip.lookAt(new THREE.Vector3(5, 0.4, 0));

  // === GUI ===
  const fSim = gui.addFolder("Simulation");
  fSim.add(params, "paused").name("Paused");
  fSim.add(params, "timeScale", 0, 3, 0.01).name("Time Scale");

  const fView = gui.addFolder("View");
  fView
    .add(params, "view", ["Overview", "Ship"])
    .name("Camera")
    .onChange(handleViewChange);
  fView
    .add(params, "showOrbits")
    .name("Show Orbits")
    .onChange(function (v) {
      planets.forEach(function (p) {
        if (p.orbitLine) p.orbitLine.visible = v;
      });
    });
  fView
    .add(params, "showStars")
    .name("Show Stars")
    .onChange(function (v) {
      if (sky) sky.visible = v;
      if (!sky && !v) scene.background = new THREE.Color(0x000000);
    });

  const fLight = gui.addFolder("Sun Light");
  fLight
    .add(params, "sunIntensity", 0, 5, 0.1)
    .name("Intensity")
    .onChange(function (v) {
      sunLight.intensity = v;
    });

  fSim.open();
  fView.open();
  fLight.open();

  // === Eventos ===
  window.addEventListener("resize", onResize, false);
  window.addEventListener("keydown", onKeyDown, false);
  window.addEventListener("keyup", onKeyUp, false);
}

function handleViewChange() {
  if (params.view === "Overview") {
    activeCamera = camOverview;
    controls.enabled = true;
  } else {
    activeCamera = camShip;
    controls.enabled = false;
  }
}

function onResize() {
  camOverview.aspect = window.innerWidth / window.innerHeight;
  camOverview.updateProjectionMatrix();
  camShip.aspect = camOverview.aspect;
  camShip.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onKeyDown(e) {
  if (e.code === "KeyV") {
    params.view = params.view === "Overview" ? "Ship" : "Overview";
    handleViewChange();
    return;
  }
  keys.add(e.code);
}
function onKeyUp(e) {
  keys.delete(e.code);
}

function updateShip(dt) {
  // Controles: W/S aceleran, A/D giran (yaw). Shift = turbo.
  const boost =
    keys.has("ShiftLeft") || keys.has("ShiftRight") ? shipState.boostMult : 1.0;

  // Rotación (yaw sobre Y)
  let yawInput = 0;
  if (keys.has("KeyA")) yawInput += 1;
  if (keys.has("KeyD")) yawInput -= 1;
  ship.rotation.y += yawInput * shipState.turnSpeed * dt;

  // Dirección "frente" de la nave en mundial
  const forward = new THREE.Vector3(0, 0, -1).applyEuler(ship.rotation);

  // Aceleración
  let thrust = 0;
  if (keys.has("KeyW")) thrust += shipState.accel * boost;
  if (keys.has("KeyS")) thrust -= shipState.accel * 0.6;

  // Actualizar velocidad
  if (thrust !== 0) shipState.vel.addScaledVector(forward, thrust * dt);

  // Limitar velocidad
  const speed = shipState.vel.length();
  const max = shipState.maxSpeed * boost;
  if (speed > max) shipState.vel.multiplyScalar(max / speed);

  // Rozamiento
  shipState.vel.multiplyScalar(
    Math.pow(shipState.damping, Math.max(1, 60 * dt))
  );

  // Mover nave
  ship.position.addScaledVector(shipState.vel, dt);

  // Limitar radio para no “perderse”
  const maxRadius = 1000;
  if (ship.position.length() > maxRadius) {
    ship.position.setLength(maxRadius);
    shipState.vel.set(0, 0, 0);
  }
}

function animate() {
  requestAnimationFrame(animate);

  const tscale = params.paused ? 0 : params.timeScale;
  const dt = tscale > 0 ? tscale * (1 / 60) : 0; // paso ~60 FPS virtual

  // Rotación del Sol (visual)
  sun.rotation.y += 0.002 * tscale;

  // Planetas
  for (let i = 0; i < planets.length; i++) {
    const p = planets[i];
    p.mesh.rotation.y += p.selfRotSpeed * tscale;
    p.pivot.rotation.y += p.orbitSpeed * tscale;
  }

  // Lunas
  for (let i = 0; i < moons.length; i++) {
    const m = moons[i];
    m.mesh.rotation.y += m.selfRotSpeed * tscale;
    m.pivot.rotation.y += m.orbitSpeed * tscale;
  }

  // Nave (objeto invisible) y cámara subjetiva
  updateShip(dt);

  // Render con la cámara activa
  renderer.render(scene, activeCamera);
}
