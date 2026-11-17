// Drawing only: the three.js scene for Neon Bay — dusk sky, fog, the procedural city,
// the harbour and beach, Rook, the cars and the chase camera. The world's state in,
// pixels out. Nothing here changes the rules.
import { PALETTE } from './config.js';
import { cityHalfSize } from './city.js';
import { neonTexture, roadTexture, windowTexture } from './textures.js';
import { buildCharacter } from './character.js';
import { animateCar, createCarMesh } from './vehicles.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

export function createRenderer(canvas, random) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(PALETTE.fog, 120, 900);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 2000);

  // Dusk light: a low warm sun plus a cool sky fill.
  const hemi = new THREE.HemisphereLight(0xa89be8, 0x3a2a3a, 1.5);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xff9a5c, 2.4);
  sun.position.set(-180, 140, 260);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -500;
  sun.shadow.camera.right = 500;
  sun.shadow.camera.top = 500;
  sun.shadow.camera.bottom = -500;
  sun.shadow.camera.far = 1200;
  scene.add(sun);

  let cityGroup = null;
  let character = null;
  let carMeshes = [];
  let policeMesh = null;
  let camPos = new THREE.Vector3(0, 8, 20);
  let camTarget = new THREE.Vector3(0, 1, 0);

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  /** Build (or rebuild) every static mesh from the city's layout data. */
  function buildCity(city, random) {
    if (cityGroup) {
      scene.remove(cityGroup);
      cityGroup.traverse((child) => {
        if (child.isMesh) {
          child.geometry.dispose();
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
    }
    cityGroup = new THREE.Group();
    const half = cityHalfSize();

    // Ground slab, sand strip and the sea beyond the south edge.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 400, half * 2 + 400),
      new THREE.MeshStandardMaterial({ color: PALETTE.ground, roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    cityGroup.add(ground);

    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 400, 60),
      new THREE.MeshStandardMaterial({ color: PALETTE.sand, roughness: 1 }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.02, city.beachZ);
    sand.receiveShadow = true;
    cityGroup.add(sand);

    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 400, 400),
      new THREE.MeshStandardMaterial({ color: PALETTE.sea, roughness: 0.25, metalness: 0.4 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.01, city.seaZ + 140);
    cityGroup.add(sea);

    // Roads: one dark strip per street, with a dashed centre line texture.
    const roadTex = roadTexture();
    const pitch = 132;
    for (let i = 0; i <= 10; i += 1) {
      const offset = (i - 5) * pitch;
      const texH = roadTex.clone();
      texH.repeat.set((half * 2 + 24) / 48, 1);
      texH.needsUpdate = true;
      const roadH = new THREE.Mesh(
        new THREE.PlaneGeometry(half * 2 + 24, 12),
        new THREE.MeshStandardMaterial({ map: texH, roughness: 0.95 }),
      );
      roadH.rotation.x = -Math.PI / 2;
      roadH.position.set(0, 0.03, offset);
      roadH.receiveShadow = true;
      cityGroup.add(roadH);
      const texV = roadTex.clone();
      texV.repeat.set(1, (half * 2 + 24) / 48);
      texV.needsUpdate = true;
      const roadV = new THREE.Mesh(
        new THREE.PlaneGeometry(12, half * 2 + 24),
        new THREE.MeshStandardMaterial({ map: texV, roughness: 0.95 }),
      );
      roadV.rotation.x = -Math.PI / 2;
      roadV.position.set(offset, 0.03, 0);
      roadV.receiveShadow = true;
      cityGroup.add(roadV);
    }

    // Buildings: boxes with lit-window facades; downtown towers get a neon strip.
    const facadeMats = [];
    for (let i = 0; i < 5; i += 1) {
      facadeMats.push(new THREE.MeshStandardMaterial({
        map: windowTexture(random, '#232030', 0.45 + i * 0.1),
        roughness: 0.85,
      }));
    }
    const neonPink = new THREE.MeshStandardMaterial({ map: neonTexture('#ff2e88'), emissive: 0xffffff, emissiveMap: neonTexture('#ff2e88'), emissiveIntensity: 0.7 });
    const neonCyan = new THREE.MeshStandardMaterial({ map: neonTexture('#2ee6ff'), emissive: 0xffffff, emissiveMap: neonTexture('#2ee6ff'), emissiveIntensity: 0.7 });
    for (const b of city.buildings) {
      const mat = facadeMats[Math.floor(random() * facadeMats.length)];
      const box = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), mat);
      box.position.set(b.x, b.h / 2, b.z);
      box.castShadow = true;
      box.receiveShadow = true;
      cityGroup.add(box);
      // A coloured roof cap so towers read at dusk.
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(b.w * 0.92, 0.6, b.d * 0.92),
        new THREE.MeshStandardMaterial({ color: b.colour, roughness: 0.7 }),
      );
      cap.position.set(b.x, b.h + 0.3, b.z);
      cityGroup.add(cap);
      if (b.downtown) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(3, b.h * 0.8), random() < 0.5 ? neonPink : neonCyan);
        strip.position.set(b.x + b.w / 2 + 0.06, b.h * 0.45, b.z);
        strip.rotation.y = Math.PI / 2;
        cityGroup.add(strip);
      }
    }

    // Parks: green slabs with a few low-poly trees.
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4028, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 1 });
    for (const park of city.parks) {
      const lawn = new THREE.Mesh(
        new THREE.PlaneGeometry(park.size, park.size),
        new THREE.MeshStandardMaterial({ color: PALETTE.park, roughness: 1 }),
      );
      lawn.rotation.x = -Math.PI / 2;
      lawn.position.set(park.x, 0.04, park.z);
      lawn.receiveShadow = true;
      cityGroup.add(lawn);
      for (let t = 0; t < 8; t += 1) {
        const tx = park.x + (random() - 0.5) * (park.size - 16);
        const tz = park.z + (random() - 0.5) * (park.size - 16);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 6), trunkMat);
        trunk.position.set(tx, 1.5, tz);
        trunk.castShadow = true;
        cityGroup.add(trunk);
        const crown = new THREE.Mesh(new THREE.ConeGeometry(2.6, 6, 8), leafMat);
        crown.position.set(tx, 5.5, tz);
        crown.castShadow = true;
        cityGroup.add(crown);
      }
    }

    // Streetlights: a pole and a warm glowing head.
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a33, roughness: 0.8 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc46b, emissiveIntensity: 2 });
    for (const light of city.lights) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6.5, 6), poleMat);
      pole.position.set(light.x, 3.25, light.z);
      cityGroup.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lampMat);
      head.position.set(light.x, 6.6, light.z);
      cityGroup.add(head);
    }

    // A pier reaching into the sea at the harbour.
    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(30, 1, 80),
      new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 }),
    );
    pier.position.set(-half + 60, 0.5, city.beachZ + 30);
    pier.castShadow = true;
    cityGroup.add(pier);

    scene.add(cityGroup);
  }

  function buildActors(state) {
    if (character) scene.remove(character.group);
    for (const mesh of carMeshes) scene.remove(mesh);
    if (policeMesh) scene.remove(policeMesh);
    character = buildCharacter();
    scene.add(character.group);
    carMeshes = state.cars.map((car) => {
      const mesh = createCarMesh(car, false);
      scene.add(mesh);
      return mesh;
    });
    policeMesh = null;
  }

  /** Paint one frame from the world's state. */
  function draw(state, screen, dt) {
    if (!cityGroup) buildCity(state.city, random);
    if (!character) buildActors(state);

    // Police car appears and disappears with a pursuit.
    if (state.police && !policeMesh) {
      policeMesh = createCarMesh({ x: state.police.x, z: state.police.z, angle: state.police.angle, colour: 0x111111 }, true);
      scene.add(policeMesh);
    } else if (!state.police && policeMesh) {
      scene.remove(policeMesh);
      policeMesh = null;
    }

    const p = state.player;
    const inCar = state.mode === 'car';
    const target = new THREE.Vector3(p.x, 1.4 + p.y, p.z);
    const dist = inCar ? 11 : 7.5;
    const height = inCar ? 4.2 : 3.2;
    const yaw = state.camera.yaw;
    const pitch = state.camera.pitch;
    const desired = new THREE.Vector3(
      target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      target.y + Math.sin(pitch) * dist + height * 0.35,
      target.z + Math.cos(yaw) * Math.cos(pitch) * dist,
    );
    // Chase camera with lag: it eases toward its spot instead of snapping.
    const lag = screen === SCREEN_TITLE ? 1 : 1 - Math.pow(0.001, dt);
    camPos.lerp(desired, lag);
    camTarget.lerp(target, 1 - Math.pow(0.0005, dt));
    camera.position.copy(camPos);
    camera.lookAt(camTarget);

    // Rook: visible on foot, hidden while driving (he is inside the car) and on
    // the title screen (the city is the backdrop there, not him).
    character.group.visible = !inCar && screen !== SCREEN_TITLE;
    character.group.position.set(p.x, p.y, p.z);
    character.group.rotation.y = p.heading;
    character.animate(p.speed, dt);

    for (let i = 0; i < state.cars.length; i += 1) {
      const car = state.cars[i];
      const mesh = carMeshes[i];
      if (!mesh) continue;
      mesh.position.set(car.x, 0, car.z);
      mesh.rotation.y = car.angle;
      animateCar(mesh, car.speed, car.steer);
    }
    if (policeMesh && state.police) {
      policeMesh.position.set(state.police.x, 0, state.police.z);
      policeMesh.rotation.y = state.police.angle;
      animateCar(policeMesh, state.police.speed, 0);
      // Flash the light bar.
      const on = Math.floor(performance.now() / 280) % 2 === 0;
      policeMesh.userData.flashRed.material.emissiveIntensity = on ? 2.5 : 0.2;
      policeMesh.userData.flashBlue.material.emissiveIntensity = on ? 0.2 : 2.5;
    }

    renderer.render(scene, camera);
  }

  /** Snap the chase camera to its spot (used right after staging a screenshot). */
  function snapCamera(state) {
    const p = state.player;
    const dist = state.mode === 'car' ? 11 : 7.5;
    camPos.set(
      p.x + Math.sin(state.camera.yaw) * dist,
      1.4 + p.y + 4,
      p.z + Math.cos(state.camera.yaw) * dist,
    );
    camTarget.set(p.x, 1.4 + p.y, p.z);
  }

  return { draw, buildCity, buildActors, snapCamera, scene, camera };
}
