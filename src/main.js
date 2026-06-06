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
};

const statusEl = document.getElementById('status');

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

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
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
  maxblur: 0.025,
  width: window.innerWidth,
  height: window.innerHeight,
});
composer.addPass(bokehPass);
composer.addPass(new OutputPass());

const webGroup = new THREE.Group();
scene.add(webGroup);

let strandLines;
let veilLines;
let nodePoints;
let dewPoints;
let lastRebuildPhase = -1;

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

function rebuildWeb(force = false) {
  const phaseBucket = Math.floor(params.phase);
  if (!force && phaseBucket === lastRebuildPhase) return;
  lastRebuildPhase = phaseBucket;

  const data = buildResidueWeb(params);

  disposeObject(strandLines);
  disposeObject(veilLines);
  disposeObject(nodePoints);
  disposeObject(dewPoints);

  const strandGeometry = new THREE.BufferGeometry();
  strandGeometry.setAttribute('position', new THREE.BufferAttribute(data.linePositions, 3));
  strandLines = new THREE.LineSegments(
    strandGeometry,
    new THREE.LineBasicMaterial({
      color: 0xf0f2f6,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  webGroup.add(strandLines);

  if (data.veilPositions.length > 0) {
    const veilGeometry = new THREE.BufferGeometry();
    veilGeometry.setAttribute('position', new THREE.BufferAttribute(data.veilPositions, 3));
    veilLines = new THREE.LineSegments(
      veilGeometry,
      new THREE.LineBasicMaterial({
        color: 0x8a95a8,
        transparent: true,
        opacity: 0.14 * params.veilWeight,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    webGroup.add(veilLines);
  }

  const nodeGeometry = new THREE.BufferGeometry();
  nodeGeometry.setAttribute('position', new THREE.BufferAttribute(data.nodePositions, 3));
  nodePoints = new THREE.Points(
    nodeGeometry,
    new THREE.PointsMaterial({
      color: 0x252830,
      size: 0.008,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  webGroup.add(nodePoints);

  if (data.dewPositions.length > 0) {
    const dewGeometry = new THREE.BufferGeometry();
    dewGeometry.setAttribute('position', new THREE.BufferAttribute(data.dewPositions, 3));
    dewPoints = new THREE.Points(
      dewGeometry,
      new THREE.PointsMaterial({
        color: 0xc8d0dc,
        size: 0.07,
        transparent: true,
        opacity: 0.92 * params.dewCurrent,
        blending: THREE.NormalBlending,
        depthWrite: true,
        sizeAttenuation: true,
      }),
    );
    webGroup.add(dewPoints);
  }

  statusEl.textContent = `${formatNodeCount(data.nodeCount)} | ${data.dewCount} dew drops | mod ${params.modulus} phase ${Math.floor(params.phase)}`;
}

rebuildWeb(true);

const gui = new GUI({ title: 'Three.js Art Piece V1' });
gui.add(params, 'iterationRate', 0, 2, 0.01).name('Iteration Rate');
gui.add(params, 'modulus', 5, 31, 1).name('Modulus').onChange(() => rebuildWeb(true));
gui.add(params, 'residueWindow', 1, 9, 1).name('Residue Window').onChange(() => rebuildWeb(true));
gui.add(params, 'tension', 0, 0.5, 0.01).name('Tension').onChange(() => rebuildWeb(true));
gui.add(params, 'threadDensity', 0.2, 2, 0.01).name('Thread Density').onChange(() => rebuildWeb(true));
gui.add(params, 'veilWeight', 0, 1, 0.01).name('Veil Weight').onChange(() => rebuildWeb(true));
gui.add(params, 'dewCurrent', 0, 1, 0.01).name('Dew Current').onChange(() => rebuildWeb(true));
gui.add(params, 'focusPlane', 1, 12, 0.01).name('Focus Plane').onChange((v) => {
  bokehPass.uniforms.focus.value = v;
});
gui.add(params, 'aperture', 0.0001, 0.01, 0.0001).name('Aperture').onChange((v) => {
  bokehPass.uniforms.aperture.value = v;
});

const strandFolder = gui.addFolder('Structure');
strandFolder.add(params, 'strandCount', 50, 800, 1).name('Strands').onChange(() => rebuildWeb(true));
strandFolder.add(params, 'phase', 0, 360, 1).name('Phase').onChange(() => rebuildWeb(true));
strandFolder.open();

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  params.phase += params.iterationRate * dt * 60;

  if (Math.floor(params.phase) !== lastRebuildPhase) {
    rebuildWeb();
  }

  controls.update();
  composer.render();
}

animate();

window.addEventListener('resize', () => {
  const { innerWidth, innerHeight } = window;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bokehPass.uniforms.aspect.value = camera.aspect;
});
