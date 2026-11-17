// The player character "Rook": a low-poly figure built from boxes — jacket, head,
// arms and legs — with a simple walk swing driven by speed. No external model.
export function buildCharacter() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshStandardMaterial({ color: 0x1f8a70, roughness: 0.8 });
  const denim = new THREE.MeshStandardMaterial({ color: 0x2e3a55, roughness: 0.9 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.7 });
  const hair = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.9 });
  const shoe = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.34), jacket);
  torso.position.y = 1.12;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.32), skin);
  head.position.y = 1.68;
  group.add(head);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.36), hair);
  cap.position.y = 1.9;
  group.add(cap);

  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.66, 0.2), jacket);
  armL.position.set(-0.42, 1.14, 0);
  group.add(armL);
  const armR = armL.clone();
  armR.position.x = 0.42;
  group.add(armR);

  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.78, 0.26), denim);
  legL.position.set(-0.16, 0.39, 0);
  group.add(legL);
  const legR = legL.clone();
  legR.position.x = 0.16;
  group.add(legR);

  const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.12, 0.4), shoe);
  shoeL.position.set(-0.16, 0.06, 0.05);
  group.add(shoeL);
  const shoeR = shoeL.clone();
  shoeR.position.x = 0.16;
  group.add(shoeR);

  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });

  let phase = 0;
  return {
    group,
    /** Swing the limbs with the walk cycle; `speed` is m/s, `dt` the step. */
    animate(speed, dt) {
      phase += speed * dt * 1.6;
      const swing = Math.min(0.7, speed * 0.09) * Math.sin(phase);
      legL.rotation.x = swing;
      legR.rotation.x = -swing;
      armL.rotation.x = -swing * 0.8;
      armR.rotation.x = swing * 0.8;
      // A little bob while moving.
      group.position.y = Math.abs(Math.sin(phase)) * Math.min(0.05, speed * 0.006);
    },
  };
}
