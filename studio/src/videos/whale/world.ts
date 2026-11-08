// The whole film as one three.js scene: sky + sun rig (camera-relative, frozen per shot), the beach (beach.ts), the
// sea and its foam line, the whale (with its blast crater), the parked 1970 cars (Walter's Oldsmobile gets flattened),
// the blast (flash, smoke column, 90 flying blubber chunks + the giant one) and the cast (cast.ts).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { staticFile } from "remotion";
import { V, lam, Kit, Ray, kitClone } from "./build";
import { ctex, cloudHD } from "./paint";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone, twoTone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { buildBeach, whale, seaTex, foam } from "./beach";
import { Car, OLDS70 } from "./car";
import {
  FPS, SHOTS, camAt, ShotDef, V3, FOREGROUND, SHORE, PARKED, OLDS, CHUNKS, GIANT, chunkAt, blownAt, crushAt, BOOM, hh, clamp01, WHALE,
} from "./story";

const KENNEY: string[] = [];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const puffTex = () => ctex("blastPuff", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.6, "rgba(255,255,255,0.85)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});

const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 2) {
    const c = camAt(s.id, Math.max(0, Math.min(f, s.b + 6))), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)); if (rt.lengthSq() < 1e-6) rt.set(1, 0, 0); rt.normalize();
    const up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

/** lumpy blubber chunk (shared geometry) */
const chunkGeo = (() => {
  const g0 = new THREE.IcosahedronGeometry(1, 3); g0.deleteAttribute("normal"); g0.deleteAttribute("uv");
  const g = mergeVertices(g0), p = g.attributes.position as THREE.BufferAttribute, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const k = 1 + 0.18 * Math.sin(v.x * 4.1) * Math.sin(v.y * 3.3 + 1) + 0.1 * Math.sin(v.z * 6.7); v.multiplyScalar(k); p.setXYZ(i, v.x, v.y * 0.75, v.z); }
  g.computeVertexNormals(); return g;
})();

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private sea: THREE.Mesh; private seaMap: THREE.Texture; private foam: THREE.Mesh; private foamMap: THREE.Texture;
  private whaleBody: THREE.Mesh; private intact: Float32Array; private crater: Float32Array; private craterCol: Float32Array; private blown = -1;
  private cars: Car[] = []; private olds!: Car;
  private chunks: THREE.Mesh[] = []; private giant: THREE.Mesh;
  private smoke: { m: THREE.Mesh; mat: THREE.MeshBasicMaterial; dir: THREE.Vector3; sp: number; s0: number; life: number; col: THREE.Color }[] = [];
  private flash: THREE.Mesh; private crates: THREE.Group; private fire: THREE.Mesh[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunDisc.visible = false; R.add(this.sunDisc);
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true; this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 100 + (i % 4) * 34, Math.sin(a) * d); m.scale.set(w, w / 2, 1); m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }
    this.crates = buildBeach(R, kit, sightLines()).crateGrp;
    // sea + foam
    this.seaMap = seaTex(); this.seaMap.repeat.set(60, 40);
    this.sea = new THREE.Mesh(new THREE.PlaneGeometry(1600, 800).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.seaMap, color: new THREE.Color(0.95, 1.0, 1.05) }));
    this.sea.position.set(0, -0.06, SHORE - 400 + 1.5); this.sea.receiveShadow = false;
    R.add(this.sea);
    this.foamMap = foam(); this.foamMap.repeat.set(40, 1);
    this.foam = new THREE.Mesh(new THREE.PlaneGeometry(1200, 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.foamMap, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.foam.layers.set(NOINK); R.add(this.foam);
    // whale
    const w = whale(); R.add(w.grp); this.whaleBody = w.body;
    const pa = w.body.geometry.attributes.position.array as Float32Array;
    this.intact = pa.slice(); this.crater = pa.slice();
    const col = (w.body.geometry.attributes.color.array as Float32Array);
    this.craterCol = col.slice();
    const flesh = new THREE.Color("#c06a5c"), burnt = new THREE.Color("#5a3a36");
    for (let i = 0; i < pa.length; i += 3) {
      const x = pa[i], y = pa[i + 1], z = pa[i + 2];
      const d = Math.hypot((x - 0.5) / 4.2, z / 2.4), top = clamp01((y - 0.9) / 1.2);
      const k = Math.max(0, 1 - d) * top;
      this.crater[i + 1] = y - 1.6 * k * k * (0.8 + 0.2 * Math.sin(x * 3));
      this.crater[i + 2] = z * (1 + 0.15 * k);
      const c = k > 0.15 ? flesh.clone().lerp(burnt, clamp01((0.6 - k) * 2)) : new THREE.Color(1, 1, 1).lerp(burnt, clamp01(1 - d * 1.3) * 0.6);
      this.craterCol[i] = c.r; this.craterCol[i + 1] = c.g; this.craterCol[i + 2] = c.b;
    }
    // parked 1970 cars
    for (const [x, c] of PARKED) {
      const car = new Car(OLDS70, c);
      car.root.position.set(x, 0, OLDS[2]); car.root.rotation.y = 0;
      car.update({ mirror: 0, badge: 0, side: 0, roof: 0 });
      this.cars.push(car); R.add(car.root);
      if (x === OLDS[0]) this.olds = car;
    }
    // blubber
    const blub = twoTone(new THREE.MeshPhongMaterial({ color: "#f0d2c2", specular: "#ffffff", shininess: 70 }), 0.5), blub2 = twoTone(new THREE.MeshPhongMaterial({ color: "#c0503f", specular: "#ffd0c0", shininess: 60 }), 0.5);
    for (const c of CHUNKS) {
      const m = new THREE.Mesh(chunkGeo, c.seed % 3 ? blub : blub2); m.castShadow = true; m.receiveShadow = true; m.visible = false;
      this.chunks.push(m); R.add(m);
    }
    this.giant = new THREE.Mesh(chunkGeo, blub); this.giant.castShadow = true; this.giant.visible = false; R.add(this.giant);
    // smoke column + dust ring (soft lit puffs)
    const pt = puffTex();
    for (let i = 0; i < 46; i++) {
      const ring = i >= 30, a = hh(i, 11) * Math.PI * 2, up = ring ? 0.12 : 0.55 + 0.45 * hh(i, 12);
      const dir = new THREE.Vector3(Math.cos(a) * (1 - up * 0.8), up, Math.sin(a) * (1 - up * 0.8)).normalize();
      const col = new THREE.Color().setHSL(0.09, 0.35, ring ? 0.78 : 0.5 + 0.22 * hh(i, 13));
      const mat = new THREE.MeshBasicMaterial({ map: pt, color: col, transparent: true, depthWrite: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); m.layers.set(NOINK); m.visible = false;
      this.smoke.push({ m, mat, dir, sp: ring ? 9 : 6 + 10 * hh(i, 14), s0: ring ? 2 : 3 + 3 * hh(i, 15), life: 4 + 4 * hh(i, 16), col }); R.add(m);
    }
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.4, 2.4), transparent: true, depthWrite: false, fog: false }));
    for (let i = 0; i < 9; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(5.0, 2.2, 0.5), transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
      m.layers.set(NOINK); m.visible = false; this.fire.push(m); R.add(m);
    }
    this.flash.layers.set(NOINK); this.flash.visible = false; R.add(this.flash);
    for (const fg of FOREGROUND) {
      const o = kitClone(kit, fg.kit, fg.s ?? 1);
      if (!o) continue;
      o.position.set(...fg.pos); o.rotation.y = fg.yaw ?? 0; o.visible = false;
      this.fgs.push({ o, a: fg.a, b: fg.b }); R.add(o);
    }
  }

  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(s.sunAz ?? L.az), el = THREE.MathUtils.degToRad(s.sunEl ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }
  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.12; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    const Rr = THREE.MathUtils.clamp(dist * 1.15 + 9, 14, 75);
    this.sun.position.copy(focus).addScaledVector(sunDir, 240); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 520; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear * 1.6; this.fog.far = L.fogFar * 1.8;
    scene.fog = this.fog; scene.background = null;
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i]; m.lookAt(cam.position.x, m.position.y, cam.position.z);
      (m.material as THREE.MeshBasicMaterial).map = this.cloudMaps[s.light][i % 4];
    }
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b;
    // ---- sea + foam ----
    this.seaMap.offset.set(t * 0.01, -t * 0.02);
    const lap = Math.sin(t * 0.9) * 0.9;
    this.foam.position.set(0, 0.03, SHORE + 0.8 + lap); this.foamMap.offset.set(t * 0.02, 0);
    // ---- whale: intact or blown ----
    const b = blownAt(f);
    if (b !== this.blown) {
      const ga = this.whaleBody.geometry.attributes;
      (ga.position.array as Float32Array).set(b ? this.crater : this.intact);
      (ga.color.array as Float32Array).set(b ? this.craterCol : new Float32Array(this.craterCol.length).fill(1));
      ga.position.needsUpdate = true; ga.color.needsUpdate = true; this.whaleBody.geometry.computeVertexNormals();
      this.blown = b;
    }
    this.crates.visible = f < BOOM;
    // ---- Walter's car ----
    this.olds.crush(crushAt(f));
    // ---- blubber ----
    CHUNKS.forEach((ch, i) => {
      const m = this.chunks[i], st = chunkAt(ch, f);
      m.visible = !!st;
      if (!st) return;
      m.position.set(...st.p);
      const sz = ch.size;
      if (st.landed) { m.scale.set(sz * 1.25, sz * 0.42, sz * 1.15); m.position.y = sz * 0.3; m.rotation.set(0, ch.seed, 0); }
      else { m.scale.setScalar(sz); m.rotation.set(st.spin, st.spin * 0.7, st.spin * 0.3); }
    });
    const gs = chunkAt(GIANT, f);
    this.giant.visible = !!gs && f >= BOOM + 2;
    if (gs) {
      this.giant.position.set(...gs.p);
      if (gs.landed) { this.giant.scale.set(1.5, 0.62, 1.25); this.giant.position.y = 0.9 + 0.62 * 0.6; this.giant.rotation.set(0, 0.3, 0); }
      else { this.giant.scale.setScalar(GIANT.size); this.giant.rotation.set(gs.spin, gs.spin * 0.6, 0); }
    }
    // ---- blast: flash ball, smoke column, dust ring ----
    const tb = (f - BOOM) / FPS;
    this.flash.visible = tb >= 0 && tb < 0.2;
    if (this.flash.visible) { this.flash.position.set(0.5, 2, 0); this.flash.scale.setScalar(3 + 30 * tb); (this.flash.material as THREE.MeshBasicMaterial).opacity = 1 - tb / 0.2; }
    this.fire.forEach((m, i) => {
      const u = tb / (0.9 + 0.5 * hh(i, 21));
      m.visible = tb >= 0 && u < 1;
      if (!m.visible) return;
      const a = hh(i, 22) * Math.PI * 2, up = 0.4 + 0.6 * hh(i, 23), d = 5 * (1 - Math.exp(-tb * 4));
      m.position.set(0.5 + Math.cos(a) * d * (1 - up), 1.5 + up * d * 1.6 + tb * 2, Math.sin(a) * d * (1 - up) * 0.6);
      m.scale.setScalar(1.5 + 4.5 * Math.sqrt(u));
      const mt = m.material as THREE.MeshBasicMaterial; mt.opacity = (1 - u) ** 1.5;
      mt.color.setRGB(5.0 * (1 - 0.6 * u), 2.2 * (1 - 0.7 * u), 0.5 * (1 - u));
    });
    for (const p of this.smoke) {
      const u = tb / p.life;
      p.m.visible = tb >= 0 && u < 1;
      if (!p.m.visible) continue;
      const d = p.sp * (1 - Math.exp(-tb * 1.4)) * 2.2;
      p.m.position.set(0.5 + p.dir.x * d, 1.5 + p.dir.y * d + tb * 1.2, p.dir.z * d);
      const sz = p.s0 + 4.2 * Math.sqrt(tb);
      p.m.scale.set(sz, sz, 1); p.m.quaternion.copy(cam.quaternion);
      p.mat.opacity = 0.85 * (1 - u) ** 1.6 * clamp01(tb / 0.05);
      p.mat.color.copy(p.col).lerp(new THREE.Color(1, 0.75, 0.4), clamp01(0.3 - tb) * 2);
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, f, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e2 = this.fx(fi++);
      e2.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e2.use(!!p.soft);
      e2.mesh.visible = true;
      e2.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e2.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e2.mesh.quaternion.copy(cam.quaternion); e2.mesh.rotateZ(p.rot ?? 0); }
      e2.mesh.scale.set(p.w, p.h, 1);
      fused.push(e2);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e3 of fused) e3.bind();
    return focus;
  }
}
export { WHALE };
