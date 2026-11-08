// The whole film as one three.js scene: sky + sun rig (camera-relative, frozen per shot), the three places
// (city.ts), the Jaguar that melts (car.ts), traffic, the reflected beam (light cone + hot spot + glow), the brise-soleil
// fins, glowing demo rays, the frying pan and doormat, and the cast (cast.ts). update(id, f, camera) poses everything
// for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { staticFile } from "remotion";
import { V, lam, Kit, Ray, kitClone, Strand } from "./build";
import { ctex, cloudHD, rep } from "./paint";
import { matHD } from "./paint2";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage } from "./cast";
import { buildWorld, CURB } from "./city";
import { Car, SALOON, CAB_TAXI, van, bus } from "./car";
import {
  FPS, SHOTS, camAt, ShotDef, V3, FOREGROUND, GARDEN, VEGAS, CAR, VAN, MAT, PAN, FACADE_FOCUS, TOWER, towerZ, towerHW, meltAt, beamAt,
  finsAt, FIN_N, carX, smooth, clamp01, Place,
} from "./story";

const KENNEY = ["plant_bushDetailed", "plant_bush", "flower_redA", "flower_yellowA", "flower_purpleA"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

const ORIGIN: Record<Place, V3> = { london: [0, 0, 0], garden: GARDEN, vegas: VEGAS };

/** sun disc + halo (golden) */
const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
/** soft round glow, white centre (additive hot spots) */
const glowTex = () => ctex("glow", 256, 256, (g) => {
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,246,200,0.95)"); gr.addColorStop(0.6, "rgba(255,210,120,0.45)"); gr.addColorStop(0.75, "rgba(255,190,90,0.08)"); gr.addColorStop(1, "rgba(255,180,80,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
});
/** beam cone: brighter toward the ground end (v = 0 bottom) and soft along its length */
const beamTex = () => ctex("beamCone", 64, 256, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 256); // canvas top = v 1 = the street end after the cone flip
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0.06)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
});

/** every lens position of the film looking at its subject (things there are left out of the static scenery) */
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

/** channel art: a fixed camera instead of the shot camera (null = film camera) */
export const CAM_OVERRIDE: { c: ReturnType<typeof camAt> | null } = { c: null };

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: { m: THREE.Mesh; off: V3 }[] = [];
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private jag: Car; private taxi: Car; private silver: Car; private van: THREE.Group; private bus: THREE.Group;
  private beam: THREE.Mesh; private beamMat: THREE.MeshBasicMaterial;
  private spotFloor: THREE.Mesh; private spotGlow: THREE.Sprite;
  private fins: Strand[] = [];
  private rays: THREE.Mesh[] = []; private rayMat: THREE.MeshBasicMaterial; private rayCore: THREE.MeshBasicMaterial;
  private pan = new THREE.Group(); private mat: THREE.Mesh;
  private vegasBeam: THREE.Mesh;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root;
    // ---- sky + light (as the bridge) ----
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
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    R.add(this.hemi, this.sun, this.sun.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.scale.set(w, w / 2, 1); m.layers.set(NOINK);
      this.clouds.push({ m, off: [Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d] }); R.add(m);
    }

    // ---- static scenery ----
    buildWorld(R, kit, sightLines());

    // ---- vehicles ----
    this.jag = new Car(SALOON, "#1f5a44", { badge: true, mirror: true, drips: true });
    this.silver = new Car(SALOON, "#9aa3b0");
    this.taxi = new Car(CAB_TAXI, "#25232b");
    this.van = van(); this.bus = bus();
    R.add(this.jag.root, this.silver.root, this.taxi.root, this.van, this.bus);

    // ---- the beam ----
    const cone = new THREE.CylinderGeometry(0.16, 1, 1, 40, 1, true); // bottom radius 1 at y = -0.5, top 0.16 at +0.5 ... flipped below
    cone.rotateX(Math.PI); // radius 1 now at the top (facade end), 0.16 at the street end
    cone.translate(0, 0.5, 0);
    this.beamMat = new THREE.MeshBasicMaterial({ map: beamTex(), color: new THREE.Color(0.5, 0.42, 0.28), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    this.beam = new THREE.Mesh(cone, this.beamMat);
    this.beam.layers.set(NOINK); this.beam.frustumCulled = false; this.beam.renderOrder = 4;
    R.add(this.beam);
    this.vegasBeam = new THREE.Mesh(cone, this.beamMat);
    this.vegasBeam.layers.set(NOINK); this.vegasBeam.frustumCulled = false; this.vegasBeam.renderOrder = 4;
    R.add(this.vegasBeam);
    const spotM = new THREE.MeshBasicMaterial({ map: glowTex(), color: new THREE.Color(2.6, 2.2, 1.5), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false, polygonOffset: true, polygonOffsetFactor: -4 });
    this.spotFloor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), spotM);
    this.spotFloor.layers.set(NOINK); this.spotFloor.renderOrder = 3;
    R.add(this.spotFloor);
    this.spotGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: new THREE.Color(2.2, 1.9, 1.3), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false }));
    this.spotGlow.layers.set(NOINK); this.spotGlow.renderOrder = 6;
    R.add(this.spotGlow);

    // ---- brise-soleil fins on the tower front ----
    const finM = lam("fin", () => ({ color: "#e4e6ea" }));
    for (let j = 0; j < FIN_N; j++) { const s = new Strand(41, 3.4, 0.9, finM, 4); this.fins.push(s); R.add(s.mesh); }

    // ---- demo rays (pooled) ----
    this.rayMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.05, 0.45), transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.rayCore = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.6, 1.1), transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    // ---- pan + doormat ----
    const iron = lam("panIron", () => ({ color: "#34333b" }));
    const panBody = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.05, 28), iron); panBody.position.y = 0.025;
    const panIn = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.005, 28), lam("panInside", () => ({ color: "#4a4954" }))); panIn.position.y = 0.051;
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.025, 0.04), lam("panHandle", () => ({ color: "#2b2a30" }))); handle.position.set(0.26, 0.05, 0); handle.rotation.z = 0.12;
    this.pan.add(panBody, panIn, handle); this.pan.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    this.pan.position.set(PAN[0], CURB, PAN[2]); this.pan.rotation.y = 0.5;
    R.add(this.pan);
    this.mat = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.62).rotateX(-Math.PI / 2), lam("mat", () => ({ map: rep(matHD(), 1, 1) })));
    this.mat.position.set(MAT[0], CURB + 0.01, MAT[2]); this.mat.receiveShadow = true;
    R.add(this.mat);
    // foreground framing objects
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
  private ray(i: number) {
    while (this.rays.length <= i) {
      const g = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true).translate(0, 0.5, 0).rotateX(Math.PI / 2); // along +z from 0 to 1
      const m = new THREE.Mesh(g, this.rayMat), c = new THREE.Mesh(g, this.rayCore);
      c.scale.set(0.22, 0.22, 1); m.add(c);
      for (const o of [m, c]) { o.layers.set(NOINK); o.frustumCulled = false; }
      m.renderOrder = 4; this.rays.push(m); this.root.add(m);
    }
    return this.rays[i];
  }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light], O = ORIGIN[s.place];
    // ---- camera ----
    const c = CAM_OVERRIDE.c ?? camAt(id, f);
    cam.position.set(...c.pos);
    const fwd = V(c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]).normalize();
    cam.up.set(0, 1, 0);
    if (Math.abs(fwd.y) > 0.97) cam.up.set(0, 0, -1); // straight-down shots
    cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.12; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    // ---- light rig ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 110);
    if (s.light === "golden") Rr = Math.max(Rr, 40);
    if (id === 2 || id === 7 || id === 12 || (id === 13 && f >= 1365)) Rr = Math.max(Rr, 90);
    this.sun.position.copy(focus).addScaledVector(sunDir, 260); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 560; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...K.bounce); TONE.uSat.value = K.sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog, sun disc, clouds ----
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color);
    // big establishing views see further than the street (the tower must not wash out)
    const far = id === 2 || id === 12 || (id === 13 && f >= 1365) || id === 15 ? 1.9 : id === 7 || id === 8 ? 1.4 : 1;
    this.fog.near = L.fogNear * far; this.fog.far = L.fogFar * far;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const { m, off } = this.clouds[i];
      m.position.set(O[0] + off[0], off[1], O[2] + off[2]);
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      (m.material as THREE.MeshBasicMaterial).map = this.cloudMaps[s.light][i % 4];
    }
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b && g.a < s.b && g.b > s.a;

    // ---- vehicles ----
    const london = s.place === "london";
    this.jag.root.visible = london;
    const jx = id === 3 ? carX(f) : CAR[0];
    this.jag.root.position.set(jx, 0, CAR[2]);
    this.jag.update(meltAt(id, f));
    this.van.visible = london; this.van.position.set(VAN[0], 0, VAN[2]);
    this.silver.root.visible = london && id >= 8; this.silver.root.position.set(6.1, 0, CAR[2]);
    this.silver.update({ mirror: 0, badge: 0, side: 0, roof: 0 });
    // traffic: a cab and a bus pass along the far lane in the wide shots
    this.taxi.root.visible = london && (id === 2 || id === 7 || id === 8 || id === 13);
    this.taxi.root.position.set(-60 + ((t * 9) % 140), 0, -3.6); this.taxi.root.rotation.y = 0;
    this.bus.visible = london && (id === 2 || id === 8 || id === 12);
    this.bus.position.set(70 - ((t * 7) % 160), 0, -4.0); this.bus.rotation.y = Math.PI;

    // ---- the beam (London) ----
    const B = beamAt(id, f);
    const showBeam = london && B.k > 0.01;
    this.beam.visible = this.spotFloor.visible = this.spotGlow.visible = showBeam;
    if (showBeam) {
      const top = V(FACADE_FOCUS[0] + 0.15 * (B.at[0] - FACADE_FOCUS[0]), FACADE_FOCUS[1], FACADE_FOCUS[2] + 1.5), bot = V(...B.at);
      const d = bot.clone().sub(top), len = d.length();
      this.beam.position.copy(bot);
      this.beam.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().negate().normalize());
      // cone radii are fixed (0.16 street end -> 1 facade end): scale so that the street end has radius B.r
      this.beam.scale.set(B.r / 0.16, len, B.r / 0.16);
      // the cone only reads from a distance; a lens inside it would wash the frame out
      const camD = cam.position.distanceTo(bot);
      // fade the cone out when the lens is near or inside it (its wall sweeping past the lens reads as a pop)
      const axis = top.clone().sub(bot), u = THREE.MathUtils.clamp(cam.position.clone().sub(bot).dot(axis) / axis.lengthSq(), 0, 1);
      const rad = B.r + (B.r / 0.16 - B.r) * u, off = cam.position.distanceTo(bot.clone().addScaledVector(axis, u));
      const vis = smooth((off / rad - 1.3) / 0.7) * smooth((camD - 8) / 6);
      this.beam.visible = vis > 0.01;
      this.beamMat.opacity = 0.18 * B.k * vis;
      this.beamMat.color.setRGB(0.75 * B.k * vis, 0.6 * B.k * vis, 0.22 * B.k * vis);
      const onGround = B.at[1] < 0.3;
      this.spotFloor.visible = onGround;
      const onPave = B.at[2] > 5 || B.at[2] < -7;
      this.spotFloor.position.set(B.at[0], (onPave ? CURB : 0) + 0.015, B.at[2]);
      this.spotFloor.scale.set(B.r * 2.2, 1, B.r * 1.6);
      (this.spotFloor.material as THREE.MeshBasicMaterial).color.setRGB(1.9 * B.k, 1.55 * B.k, 0.7 * B.k);
      const toCam = cam.position.clone().sub(bot).normalize();
      this.spotGlow.position.copy(bot).addScaledVector(toCam, onGround ? 0.25 : 0.9);
      const gk = B.k * Math.min(1, Math.max(0.15, (camD - 2) / 12));
      this.spotGlow.scale.setScalar(B.r * (onGround ? 0.9 : 1.1));
      (this.spotGlow.material as THREE.SpriteMaterial).color.setRGB(1.1 * gk, 0.9 * gk, 0.35 * gk);
      (this.spotGlow.material as THREE.SpriteMaterial).depthTest = true;
      this.spotGlow.visible = !onGround;
      (this.spotFloor.material as THREE.MeshBasicMaterial).color.multiplyScalar(Math.min(1, Math.max(0.45, (camD - 1) / 8)));
    }
    // ---- Las Vegas beam onto the pool deck ----
    this.vegasBeam.visible = s.place === "vegas";
    if (this.vegasBeam.visible) {
      const top = V(VEGAS[0], 60, VEGAS[2] - 26), bot = V(VEGAS[0] + 1.5, 0.05, VEGAS[2] + 44);
      const d = bot.clone().sub(top);
      this.vegasBeam.position.copy(bot);
      this.vegasBeam.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().negate().normalize());
      this.vegasBeam.scale.set(3.2 / 0.16, d.length(), 3.2 / 0.16);
      this.beamMat.opacity = 0.2; this.beamMat.color.setRGB(0.6, 0.45, 0.25);
    }

    // ---- fins ----
    const nf = finsAt(id, f);
    this.fins.forEach((s2, j) => {
      const k = clamp01(nf - j);
      s2.mesh.visible = london && k > 0.01;
      if (!s2.mesh.visible) return;
      const y = 26 + j * 10.5, hw = towerHW(y) * 0.98 * (0.35 + 0.65 * smooth(k)), pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 40; i++) { const x = -hw + (2 * hw * i) / 40; pts.push(V(x, y, towerZ(x, y) + 1.35)); }
      s2.set(pts);
    });

    // ---- props ----
    this.pan.visible = id === 6 && f >= 737;
    this.mat.visible = london;

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
    // rays
    let ri = 0;
    for (const r of st.rays) {
      const a = V(...r.a), b = V(...r.b), d = b.clone().sub(a), len = d.length() * clamp01(r.k);
      if (len < 0.01) continue;
      const m = this.ray(ri++);
      m.visible = true; m.position.copy(a);
      m.quaternion.setFromUnitVectors(V(0, 0, 1), d.normalize());
      m.scale.set(r.w * 2.2, r.w * 2.2, len);
    }
    for (let i = ri; i < this.rays.length; i++) this.rays[i].visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e3 of fused) e3.bind();
    return focus;
  }
}
export { TOWER };
