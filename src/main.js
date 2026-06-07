import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import GUI from 'lil-gui';
import { buildResidueWeb, formatNodeCount } from './residueWeb.js';

const params = {
  iterationRate: 0.44,
  modulus: 19,
  residueWindow: 5,
  tension: 0.12,
  threadDensity: 1.0,
  veilWeight: 0.94,
  dewCurrent: 1.0,
  focusPlane: 3.4,
  aperture: 0.0009,
  strandCount: 453,
  phase: 247,
  useBokeh: false,
  animatePhase: false,
};

const statusEl = document.getElementById('status');

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

setStatus('Starting…');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'default',
    failIfMajorPerformanceCaveat: false,
  });
} catch (err) {
  setStatus(`WebGL unavailable: ${err.message}`, true);
  throw err;
}

if (!renderer.getContext()) {
  setStatus('WebGL context failed — enable hardware acceleration in Chrome', true);
  throw new Error('WebGL context failed');
}

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.fog = new THREE.FogExp2(0x000000, 0.028);

const camera = new THREE.PerspectiveCamera(
  42,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(0.45, -0.15, 5.4);

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 1);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.55;
controls.minDistance = 2.2;
controls.maxDistance = 14;
controls.target.set(0, 0, 0);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bokehPass = new BokehPass(scene, camera, {
  focus: params.focusPlane,
  aperture: params.aperture,
  maxblur: 0.012,
  width: window.innerWidth,
  height: window.innerHeight,
});
composer.addPass(bokehPass);
composer.addPass(new OutputPass());

const webGroup = new THREE.Group();
scene.add(webGroup);

let strandLines;
let veilLines;
let dewPoints;
let isRebuilding = false;
let bokehFailed = false;

function disposeObject(object) {
  if (!object) return;
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
    }
  });
  webGroup.remove(object);
}

function applyWebData(data) {
  disposeObject(strandLines);
  disposeObject(veilLines);
  disposeObject(dewPoints);

  if (data.linePositions.length > 0) {
    const strandGeometry = new THREE.BufferGeometry();
    strandGeometry.setAttribute('position', new THREE.BufferAttribute(data.linePositions.slice(), 3));
    strandLines = new THREE.LineSegments(
      strandGeometry,
      new THREE.LineBasicMaterial({
        color: 0xf0f2f6,
        transparent: true,
        opacity: 0.38,
        blending: THREE.AdditiveBlending,
        depthWrite: true,
        depthTest: true,
      }),
    );
    webGroup.add(strandLines);
  }

  if (data.veilPositions.length > 0) {
    const veilGeometry = new THREE.BufferGeometry();
    veilGeometry.setAttribute('position', new THREE.BufferAttribute(data.veilPositions.slice(), 3));
    veilLines = new THREE.LineSegments(
      veilGeometry,
      new THREE.LineBasicMaterial({
        color: 0x8a95a8,
        transparent: true,
        opacity: 0.14 * params.veilWeight,
        blending: THREE.AdditiveBlending,
        depthWrite: true,
        depthTest: true,
      }),
    );
    webGroup.add(veilLines);
  }

  if (data.dewPositions.length > 0) {
    const dewGeometry = new THREE.BufferGeometry();
    dewGeometry.setAttribute('position', new THREE.BufferAttribute(data.dewPositions.slice(), 3));
    dewPoints = new THREE.Points(
      dewGeometry,
      new THREE.PointsMaterial({
        color: 0xd8e0ee,
        size: 0.07,
        transparent: true,
        opacity: 0.92 * params.dewCurrent,
        depthWrite: true,
        sizeAttenuation: true,
      }),
    );
    webGroup.add(dewPoints);
  }

  setStatus(
    `${formatNodeCount(data.nodeCount)} | ${data.dewCount} dew | ` +
      `${data.lineSegmentCount.toLocaleString()} segs | mod ${params.modulus} phase ${Math.floor(params.phase)} | ok`,
  );
}

function rebuildWeb() {
  const data = buildResidueWeb(params);
  applyWebData(data);
}

function scheduleRebuild() {
  if (isRebuilding) return;
  isRebuilding = true;
  requestAnimationFrame(() => {
    try {
      rebuildWeb();
    } catch (err) {
      console.error(err);
      setStatus(`Build error: ${err.message}`, true);
    } finally {
      isRebuilding = false;
    }
  });
}

try {
  rebuildWeb();
} catch (err) {
  console.error(err);
  setStatus(`Build error: ${err.message}`, true);
}

const gui = new GUI({ title: 'Three.js Art Piece V1' });
gui.add(params, 'iterationRate', 0, 2, 0.01).name('Iteration Rate');
gui.add(params, 'animatePhase').name('Animate Phase').onChange(() => scheduleRebuild());
gui.add(params, 'modulus', 5, 31, 1).name('Modulus').onChange(scheduleRebuild);
gui.add(params, 'residueWindow', 1, 9, 1).name('Residue Window').onChange(scheduleRebuild);
gui.add(params, 'tension', 0, 0.5, 0.01).name('Tension').onChange(scheduleRebuild);
gui.add(params, 'threadDensity', 0.2, 2, 0.01).name('Thread Density').onChange(scheduleRebuild);
gui.add(params, 'veilWeight', 0, 1, 0.01).name('Veil Weight').onChange(scheduleRebuild);
gui.add(params, 'dewCurrent', 0, 1, 0.01).name('Dew Current').onChange(scheduleRebuild);
gui.add(params, 'useBokeh').name('Bokeh DOF').onChange((enabled) => {
  if (enabled && bokehFailed) {
    params.useBokeh = false;
    setStatus('Bokeh unavailable in this browser — using direct render', true);
  }
});
gui.add(params, 'focusPlane', 1, 12, 0.01).name('Focus Plane').onChange((v) => {
  bokehPass.uniforms.focus.value = v;
});
gui.add(params, 'aperture', 0.0001, 0.003, 0.0001).name('Aperture').onChange((v) => {
  bokehPass.uniforms.aperture.value = v;
});

const strandFolder = gui.addFolder('Structure');
strandFolder.add(params, 'strandCount', 50, 800, 1).name('Strands').onChange(scheduleRebuild);
strandFolder.add(params, 'phase', 0, 360, 1).name('Phase').onChange(scheduleRebuild);
strandFolder.open();

const clock = new THREE.Clock();
let lastAnimatedPhase = Math.floor(params.phase);

function renderFrame() {
  try {
    if (params.useBokeh && !bokehFailed) {
      composer.render();
    } else {
      renderer.render(scene, camera);
    }
  } catch (err) {
    console.error(err);
    bokehFailed = true;
    params.useBokeh = false;
    renderer.render(scene, camera);
    setStatus(`Bokeh failed — direct render active (${err.message})`, true);
  }
}

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();

  if (params.animatePhase) {
    params.phase += params.iterationRate * dt * 60;
    const bucket = Math.floor(params.phase);
    if (!isRebuilding && bucket !== lastAnimatedPhase) {
      lastAnimatedPhase = bucket;
      scheduleRebuild();
    }
  }

  webGroup.rotation.y += dt * 0.08;
  controls.update();
  renderFrame();
}

animate();

window.addEventListener('error', (event) => {
  setStatus(`Error: ${event.message}`, true);
});

window.addEventListener('resize', () => {
  const { innerWidth, innerHeight } = window;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bokehPass.uniforms.aspect.value = camera.aspect;
});
