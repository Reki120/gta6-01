// The three.js view: renderer, dusk lighting and fog, and the third-person
// camera that follows Rook on foot and lags behind the car while driving.
import { CAMERA, PALETTE } from './config.js';

export function createView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 120, 900);

  const hemi = new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(PALETTE.sun, 2.6);
  sun.position.set(-260, 190, -320);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 1200;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  // a cool fill from the harbour side so shadows are never pitch black
  const fill = new THREE.DirectionalLight(0x5a6fd8, 0.55);
  fill.position.set(200, 120, 300);
  scene.add(fill);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2400);
  const eye = new THREE.Vector3(0, 8, -12);
  const look = new THREE.Vector3();

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /** Paint one frame from the world state. */
  function draw(state, dt) {
    const target = state.activeCar >= 0 ? state.cars[state.activeCar] : state.player;
    const driving = state.activeCar >= 0;
    const dist = driving ? CAMERA.driveDistance : CAMERA.distance;
    const height = driving ? CAMERA.driveHeight : CAMERA.height;
    const lx = Math.sin(state.camYaw);
    const lz = Math.cos(state.camYaw);
    const wantX = target.x - lx * dist;
    const wantY = (target.y || 0) + height + Math.sin(state.camPitch) * dist * 0.7;
    const wantZ = target.z - lz * dist;
    const k = Math.min(1, CAMERA.lag * dt);
    eye.x += (wantX - eye.x) * k;
    eye.y += (wantY - eye.y) * k;
    eye.z += (wantZ - eye.z) * k;
    camera.position.copy(eye);
    look.set(target.x, (target.y || 0) + 1.6, target.z);
    camera.lookAt(look);
    // the sun's shadow box follows the action so shadows stay crisp
    sun.position.set(target.x - 260, 190, target.z - 320);
    sun.target.position.set(target.x, 0, target.z);
    sun.target.updateMatrixWorld();
    renderer.render(scene, camera);
  }

  return { scene, camera, renderer, draw };
}
