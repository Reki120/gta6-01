// Procedural cars: a box body, a cabin, four wheels and headlights, in a few
// distinct paint jobs. One of them is the black-and-white patrol car that
// chases Rook in the chase scene. The arcade drive model lives here too.
import { CAR } from './config.js';

const PAINTS = [
  { name: 'Ember', body: 0xc22e2e, trim: 0x1a1a1a },
  { name: 'Lagoon', body: 0x1f8fb0, trim: 0x10242c },
  { name: 'Volt', body: 0xe8b31a, trim: 0x222222 },
  { name: 'Orchid', body: 0x7a3fd1, trim: 0x1c1426 },
];

export function paintJobs() {
  return PAINTS;
}

/** Build a car mesh. `police` adds the white doors and the light bar. */
export function buildCar(paint, police = false) {
  const group = new THREE.Group();
  group.name = police ? 'patrol-car' : 'car';
  const bodyMat = new THREE.MeshLambertMaterial({ color: paint.body });
  const trimMat = new THREE.MeshLambertMaterial({ color: paint.trim });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x0e1a24 });
  const tyreMat = new THREE.MeshLambertMaterial({ color: 0x111111 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), bodyMat);
  body.position.y = 0.62;
  body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.28, -0.2);
  cabin.castShadow = true;
  group.add(body, cabin);

  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, tyreMat);
    wheel.position.set(wx, 0.38, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }

  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const lx of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), lightMat);
    lamp.position.set(lx, 0.72, 2.22);
    group.add(lamp);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const lx of [-0.6, 0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.16, 0.1), tailMat);
    lamp.position.set(lx, 0.72, -2.22);
    group.add(lamp);
  }

  if (police) {
    const doorMat = new THREE.MeshLambertMaterial({ color: 0xe8e8e8 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.04, 0.4, 2.0), doorMat);
    door.position.set(0, 0.62, 0.1);
    group.add(door);
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.14, 0.4), trimMat);
    barBase.position.set(0, 1.68, -0.2);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.3, 1.68, -0.2);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.42), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    blue.position.set(0.3, 1.68, -0.2);
    group.add(barBase, red, blue);
  }

  return { group, wheels };
}

/**
 * One step of the arcade car model. `drive` is -1..1 (throttle / reverse),
 * `steer` is -1..1. Heading is radians, forward is -z rotated by heading.
 * Returns the new speed in m/s.
 */
export function stepCar(car, drive, steer, dt) {
  const speed = car.speed;
  if (drive > 0) car.speed += CAR.accel * drive * dt;
  else if (drive < 0) {
    if (speed > 0.5) car.speed -= CAR.brake * dt; // braking while moving forward
    else car.speed -= CAR.reverseAccel * dt; // then reversing
  } else {
    car.speed -= Math.sign(speed) * Math.min(Math.abs(speed), 6 * dt); // drag
  }
  car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
  // steering bites less the faster you go, and nothing at a standstill
  const steerAuthority = Math.min(1, Math.abs(car.speed) / 6);
  const turn = steer * CAR.steer * steerAuthority * Math.max(0.25, 1 - Math.abs(car.speed) / CAR.maxSpeed * 0.55);
  car.heading += turn * (car.speed / 4.4) * dt * (car.speed >= 0 ? 1 : -1);
  // a touch of drift: velocity lags the heading a little at speed
  const vx = Math.sin(car.heading) * car.speed;
  const vz = Math.cos(car.heading) * car.speed;
  car.vx += (vx - car.vx) * Math.min(1, CAR.grip * dt);
  car.vz += (vz - car.vz) * Math.min(1, CAR.grip * dt);
  car.x += car.vx * dt;
  car.z += car.vz * dt;
  return car.speed;
}
