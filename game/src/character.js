// Rook, the getaway driver: a low-poly figure built from boxes — jacket, jeans,
// boots and a cap — with swinging limbs while walking and a lean while running.
export function buildCharacter() {
  const group = new THREE.Group();
  group.name = 'rook';
  const jacket = new THREE.MeshLambertMaterial({ color: 0x27324a });
  const jeans = new THREE.MeshLambertMaterial({ color: 0x2c3a55 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const cap = new THREE.MeshLambertMaterial({ color: 0xd43a5e });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
  torso.position.y = 1.18;
  torso.castShadow = true;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skin);
  head.position.y = 1.74;
  head.castShadow = true;
  const hat = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.12, 0.4), cap);
  hat.position.y = 1.95;
  const brim = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.2), cap);
  brim.position.set(0, 1.9, 0.26);

  const armGeo = new THREE.BoxGeometry(0.18, 0.66, 0.2);
  const legGeo = new THREE.BoxGeometry(0.24, 0.78, 0.26);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.42, 1.2, 0);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.42, 1.2, 0);
  const legL = new THREE.Mesh(legGeo, jeans);
  legL.position.set(-0.16, 0.42, 0);
  const legR = new THREE.Mesh(legGeo, jeans);
  legR.position.set(0.16, 0.42, 0);
  for (const limb of [armL, armR, legL, legR]) limb.castShadow = true;

  group.add(torso, head, hat, brim, armL, armR, legL, legR);
  return {
    group,
    limbs: { armL, armR, legL, legR },
    /** Swing the limbs with the walk cycle; `phase` advances with distance. */
    pose(phase, speedRatio) {
      const swing = 0.65 * speedRatio;
      legL.rotation.x = Math.sin(phase) * swing;
      legR.rotation.x = -Math.sin(phase) * swing;
      armL.rotation.x = -Math.sin(phase) * swing * 0.8;
      armR.rotation.x = Math.sin(phase) * swing * 0.8;
      torso.rotation.x = speedRatio * 0.12;
    },
    idle() {
      legL.rotation.x = 0;
      legR.rotation.x = 0;
      armL.rotation.x = 0;
      armR.rotation.x = 0;
      torso.rotation.x = 0;
    },
  };
}
