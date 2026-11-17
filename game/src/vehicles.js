// Procedural cars: a low-poly body, cabin, wheels and lights, built from boxes and
// cylinders. A police car is the same body in black-and-white with a light bar.
function buildCarMesh(colour, police) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.35, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x0e1a24, roughness: 0.15, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.3), paint);
  body.position.y = 0.55;
  group.add(body);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.55, 2.1), glass);
  cabin.position.set(0, 1.1, -0.25);
  group.add(cabin);

  if (police) {
    const doors = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.4, 1.6), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.4 }));
    doors.position.set(0, 0.6, 0.2);
    group.add(doors);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.3), dark);
    bar.position.set(0, 1.46, -0.25);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.28), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1.4 }));
    red.position.set(-0.28, 1.5, -0.25);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.14, 0.28), new THREE.MeshStandardMaterial({ color: 0x2244ff, emissive: 0x2244ff, emissiveIntensity: 1.4 }));
    blue.position.set(0.28, 1.5, -0.25);
    group.add(blue);
    group.userData.flashRed = red;
    group.userData.flashBlue = blue;
  }

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelPositions = [
    [-0.85, 0.36, 1.35], [0.85, 0.36, 1.35],
    [-0.85, 0.36, -1.35], [0.85, 0.36, -1.35],
  ];
  const wheels = [];
  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(x, y, z);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }

  const lightMat = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffe9a0, emissiveIntensity: 0.8 });
  for (const x of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), lightMat);
    lamp.position.set(x, 0.62, 2.16);
    group.add(lamp);
  }
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, emissive: 0x881111, emissiveIntensity: 0.8 });
  for (const x of [-0.6, 0.6]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tailMat);
    tail.position.set(x, 0.62, -2.16);
    group.add(tail);
  }

  group.traverse((child) => {
    if (child.isMesh) child.castShadow = true;
  });
  group.userData.wheels = wheels;
  return group;
}

export function createCarMesh(spawn, police = false) {
  const mesh = buildCarMesh(spawn.colour, police);
  mesh.position.set(spawn.x, 0, spawn.z);
  mesh.rotation.y = spawn.angle;
  return mesh;
}

/** Spin the wheels to match the car's speed and steer the front pair a little. */
export function animateCar(mesh, speed, steer) {
  const wheels = mesh.userData.wheels;
  if (!wheels) return;
  for (let i = 0; i < wheels.length; i += 1) {
    wheels[i].rotation.x += speed * 0.016 / 0.36;
    if (i < 2) wheels[i].rotation.y = steer * 0.5;
  }
}
