import * as THREE from 'three';

// A small pool of reusable icosahedron sprites for dust / sparkle / debris.
export function createParticles(scene, count = 46) {
  const particles = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.12, 0),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }),
    );
    m.visible = false;
    scene.add(m);
    particles.push({ mesh: m, life: 0, max: 1, vel: new THREE.Vector3(), grav: 8 });
  }

  function emit(pos, o) {
    let n = o.count || 6;
    for (const p of particles) {
      if (n <= 0) break;
      if (p.life > 0) continue;
      p.life = p.max = o.life || 0.6;
      p.grav = o.grav ?? 8;
      p.mesh.visible = true;
      p.mesh.position.copy(pos);
      p.mesh.material.color.setHex(o.color ?? 0xffffff);
      p.mesh.material.opacity = 1;
      const a = Math.random() * Math.PI * 2, sp = (o.speed || 2) * (0.4 + Math.random());
      if (o.dir) {
        // Bias the burst along a direction (e.g. a near-miss streak trailing
        // behind the player) with a little jitter so it reads as motion.
        p.vel.set(o.dir.x * sp + (Math.random() - 0.5) * 0.8, (o.up || 1) * (0.3 + Math.random() * 0.6), o.dir.z * sp + (Math.random() - 0.5) * 0.8);
      } else {
        p.vel.set(Math.cos(a) * sp, (o.up || 2) * (0.4 + Math.random()), Math.sin(a) * sp);
      }
      p.mesh.scale.setScalar(o.size ?? (0.6 + Math.random() * 0.6));
      n--;
    }
  }

  function update(dt) {
    for (const p of particles) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.mesh.visible = false; continue; }
      p.vel.y -= p.grav * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = p.life / p.max;
      p.mesh.scale.multiplyScalar(1 - dt * 0.7);
      p.mesh.rotation.x += dt * 4;
      p.mesh.rotation.y += dt * 5;
    }
  }

  return { emit, update };
}
