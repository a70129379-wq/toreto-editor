// One continuous real-time 3D world: a giant film strip winding through an anime sky,
// flown by a single camera. Everything is cel shaded with ink outlines.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { films } from "./content";
import { LAST } from "./shots";

const STRIP_H = 20;
const FRAME_H = STRIP_H * 0.74;
const STRIP_START = 74;
const FRAME_GAP = 86;

// The colour journey: red night, rain, open sky, dawn.
const PALETTE = [
  { at: 0.0, top: 0x07040c, low: 0x7a0a1e, cloud: 0x3a0d1c, shade: 0x12040a, sun: 0xfff0dc, glow: 0xff2a3c, light: 0xffb08a, fill: 0x552033 },
  { at: 0.42, top: 0x03060f, low: 0x12305e, cloud: 0x1a2c4e, shade: 0x070d1c, sun: 0xdfeaff, glow: 0x3f7cff, light: 0xa8c4ff, fill: 0x223458 },
  { at: 0.72, top: 0x0d5fb0, low: 0x58c3df, cloud: 0xe4f0fb, shade: 0x7fb6d8, sun: 0xfffbe8, glow: 0xffffff, light: 0xfff4dc, fill: 0x9cc8e8 },
  { at: 1.0, top: 0x241654, low: 0xff8a3c, cloud: 0xffc9a0, shade: 0x6a2c58, sun: 0xfff2b8, glow: 0xffa040, light: 0xffc890, fill: 0x8a4a78 },
];

const mix = (out: THREE.Color, j: number, key: "top" | "low" | "cloud" | "shade" | "sun" | "glow" | "light" | "fill") => {
  let a = PALETTE[0];
  let b = PALETTE[PALETTE.length - 1];
  for (let i = 0; i < PALETTE.length - 1; i++) {
    if (j >= PALETTE[i].at && j <= PALETTE[i + 1].at) {
      a = PALETTE[i];
      b = PALETTE[i + 1];
      break;
    }
  }
  const t = THREE.MathUtils.smoothstep(j, a.at, b.at);
  return out.set(a[key]).lerp(new THREE.Color(b[key]), t);
};

const toonRamp = () => {
  const data = new Uint8Array([70, 70, 70, 255, 150, 150, 150, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
};

/** Ink outline: the mesh again, inside out and pushed along its normals. */
const inkMaterial = (width: number, color = 0x08060c) =>
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uW: { value: width }, uC: { value: new THREE.Color(color) } },
    vertexShader: `
      uniform float uW;
      void main(){
        vec4 p=vec4(position+normalize(normal)*uW,1.);
        #ifdef USE_INSTANCING
          p=instanceMatrix*p;
        #endif
        gl_Position=projectionMatrix*modelViewMatrix*p;
      }`,
    fragmentShader: `uniform vec3 uC; void main(){ gl_FragColor=vec4(uC,1.); }`,
  });

const filmTexture = () => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const x = c.getContext("2d")!;
  x.fillStyle = "#0c0a10";
  x.fillRect(0, 0, 256, 512);
  x.fillStyle = "#1a1219";
  x.fillRect(0, 52, 256, 408);
  // Sprocket holes are cut out of the alpha along both edges.
  x.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 2; i++) {
    const px = 44 + i * 128;
    [12, 468].forEach((py) => {
      x.beginPath();
      x.roundRect(px, py, 40, 30, 7);
      x.fill();
    });
  }
  x.globalCompositeOperation = "source-over";
  x.fillStyle = "rgba(255,42,60,0.5)";
  x.fillRect(0, 48, 256, 3);
  x.fillRect(0, 461, 256, 3);
  x.fillStyle = "#08060c";
  x.fillRect(0, 52, 10, 408);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
};

const rock = (radius: number, seed: number, grass: THREE.ColorRepresentation, ramp: THREE.Texture) => {
  const raw = new THREE.IcosahedronGeometry(radius, 4);
  raw.deleteAttribute("uv");
  raw.deleteAttribute("normal");
  // Welded, so shading is smooth and the ink outline has no gaps.
  const g = mergeVertices(raw);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const noise = (a: number, b: number) => Math.sin(a * 1.7 + seed) * Math.cos(b * 2.3 + seed * 2) * 0.5 + Math.sin(a * 4.1 + b * 3.3 + seed) * 0.22;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const n = noise(v.x * 3, v.z * 3);
    const top = v.y > 0;
    const r = radius * (top ? 1 + n * 0.08 : 1 + n * 0.4);
    v.multiplyScalar(r);
    v.y = top ? v.y * 0.12 : v.y * 1.25 - Math.abs(noise(v.x, v.z)) * radius * 0.35;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  const count = p.count;
  const colors = new Float32Array(count * 3);
  const top = new THREE.Color(grass);
  const side = new THREE.Color(0x2a2230);
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    col.copy(p.getY(i) > -radius * 0.05 ? top : side);
    colors.set([col.r, col.g, col.b], i * 3);
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const group = new THREE.Group();
  group.add(new THREE.Mesh(g, new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp })));
  group.add(new THREE.Mesh(g, inkMaterial(radius * 0.012)));
  return group;
};

const reel = (radius: number, ramp: THREE.Texture) => {
  const s = new THREE.Shape();
  s.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const holes = 6;
  for (let i = 0; i < holes; i++) {
    const a = (i / holes) * Math.PI * 2;
    const h = new THREE.Path();
    h.absarc(Math.cos(a) * radius * 0.56, Math.sin(a) * radius * 0.56, radius * 0.25, 0, Math.PI * 2, true);
    s.holes.push(h);
  }
  const hub = new THREE.Path();
  hub.absarc(0, 0, radius * 0.08, 0, Math.PI * 2, true);
  s.holes.push(hub);
  const g = new THREE.ExtrudeGeometry(s, { depth: radius * 0.05, bevelEnabled: false, curveSegments: 40 });
  g.translate(0, 0, -radius * 0.025);
  const metal = new THREE.MeshToonMaterial({ color: 0xc9c9d4, gradientMap: ramp });
  const group = new THREE.Group();
  [-radius * 0.11, radius * 0.11].forEach((z) => {
    const m = new THREE.Mesh(g, metal);
    m.position.z = z;
    const outline = new THREE.Mesh(g, inkMaterial(radius * 0.008));
    outline.position.z = z;
    group.add(m, outline);
  });
  const wound = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.8, radius * 0.8, radius * 0.2, 48),
    new THREE.MeshToonMaterial({ color: 0x17121a, gradientMap: ramp })
  );
  wound.rotation.x = Math.PI / 2;
  group.add(wound);
  return group;
};

export type WorldCallbacks = {
  onLoad?: (fraction: number) => void;
  onReady?: () => void;
  onTick?: (u: number) => void;
  onFrame?: (index: number) => void;
};

export type World = {
  setScroll: (u: number) => void;
  setPointer: (x: number, y: number) => void;
  /** Starts the opening animation once the loader has cleared. */
  begin: () => void;
  /** Returns the film index under a screen point, or -1. */
  pick: (clientX: number, clientY: number) => number;
  dispose: () => void;
};

export function createWorld(canvas: HTMLCanvasElement, cb: WorldCallbacks = {}): World | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  const small = window.innerWidth < 760;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || small;
  let dpr = Math.min(window.devicePixelRatio || 1, weak ? 1.25 : 1.5);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x000000, 90, 620);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 2400);
  scene.add(camera);
  const ramp = toonRamp();

  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(-0.5, 0.75, 0.7);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x222233, 0.85);
  scene.add(sun, hemi);

  // ---------- Sky ----------
  const skyU = {
    uTop: { value: new THREE.Color() },
    uLow: { value: new THREE.Color() },
    uGlow: { value: new THREE.Color() },
    uCloud: { value: new THREE.Color() },
    uShade: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 0.2, -1) },
    uStars: { value: 1 },
    uRays: { value: 0 },
    uFlash: { value: 0 },
    uTime: { value: 0 },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(1800, 32, 20),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: skyU,
      vertexShader: `varying vec3 vDir; void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `
        uniform vec3 uTop,uLow,uGlow,uCloud,uShade,uSunDir; uniform float uStars,uRays,uFlash,uTime; varying vec3 vDir;
        float hash(vec3 p){ return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
        float h2(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453); }
        float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(h2(i),h2(i+vec2(1,0)),f.x),mix(h2(i+vec2(0,1)),h2(i+vec2(1,1)),f.x),f.y); }
        float fbm(vec2 p){ float a=.5,v=0.; for(int i=0;i<4;i++){ v+=a*n2(p); p=p*2.03+vec2(7.1,3.7); a*=.5; } return v; }
        void main(){
          vec3 d=normalize(vDir);
          float h=smoothstep(-.35,.55,d.y);
          vec3 col=mix(uLow,uTop,h);
          float sunAmt=max(dot(d,uSunDir),0.);
          col+=uGlow*.45*pow(sunAmt,7.);
          // Cel-painted cloud banks, stretched sideways and cut into hard tones
          vec2 q=vec2(atan(d.x,-d.z)*1.7,d.y*5.)+vec2(uTime*.01,0.);
          float n=fbm(q+fbm(q*1.3)*.55);
          float band=smoothstep(.62,.05,abs(d.y-.12))*.5+.17;
          float c=n*band*1.9;
          float lit=fbm(q+vec2(.05,.42));
          vec3 cloud=mix(uShade,uCloud,step(.5,lit+dot(d,uSunDir)*.22));
          col=mix(col,cloud,smoothstep(.43,.445,c));
          // Rim where a cloud edge catches the light
          col=mix(col,uGlow,smoothstep(.43,.445,c)*(1.-smoothstep(.445,.456,c))*.22);
          // Stars
          vec3 g=floor(d*260.);
          float s=step(.9975,hash(g))*smoothstep(-.05,.3,d.y)*(1.-smoothstep(.43,.44,c));
          col+=vec3(.9,.92,1.)*s*uStars;
          // Light shafts from the sun
          if(uRays>.001){
            vec3 side=normalize(cross(uSunDir,vec3(0.,1.,0.)));
            vec3 upv=cross(side,uSunDir);
            float a=atan(dot(d,upv),dot(d,side));
            float ray=n2(vec2(a*14.,uTime*.05))*n2(vec2(a*37.+3.,-uTime*.04));
            col+=uGlow*smoothstep(.2,.62,ray)*pow(sunAmt,2.6)*uRays*.55;
          }
          col+=vec3(.42,.5,.72)*uFlash;
          col+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)/255.;
          gl_FragColor=vec4(col,1.);
        }`,
    })
  );
  scene.add(sky);

  const moonColor = new THREE.Color();
  const moonU = { uC: { value: moonColor }, uShade: { value: new THREE.Color() }, uBand: { value: new THREE.Color() }, uTime: skyU.uTime };
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(150, 48, 32),
    new THREE.ShaderMaterial({
      fog: false,
      uniforms: moonU,
      vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN=normalize(normalMatrix*normal); vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
      fragmentShader: `
        uniform vec3 uC,uShade,uBand; uniform float uTime; varying vec3 vN; varying vec3 vP;
        float h(vec2 p){ return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
        float fbm(vec2 p){ return n(p)*.55+n(p*2.1+5.)*.3+n(p*4.3+9.)*.15; }
        void main(){
          vec2 q=vP.xy/150.;
          float l=dot(vN,normalize(vec3(.35,.45,.8)))+(fbm(q*3.2)-.5)*.75;
          vec3 c=l>.58?uC:l>.28?mix(uC,uShade,.5):uShade;
          // Two cloud streaks drift across the face
          float s1=fbm(vec2(q.x*2.2+uTime*.02,q.y*9.+2.))*smoothstep(.34,.0,abs(q.y+.26));
          float s2=fbm(vec2(q.x*1.8-uTime*.016,q.y*8.+7.))*smoothstep(.22,.0,abs(q.y-.34));
          c=mix(c,uBand,step(.34,max(s1,s2)));
          gl_FragColor=vec4(c,1.);
        }`,
    })
  );
  scene.add(moon);

  // ---------- Film strip ----------
  const pts: THREE.Vector3[] = [];
  const END_X = STRIP_START + 40 + FRAME_GAP * films.length + 560;
  for (let x = STRIP_START - 40; x <= END_X; x += 34) {
    pts.push(new THREE.Vector3(x, 15 + Math.sin(x * 0.0125) * 6 + Math.sin(x * 0.031) * 2, -150 + Math.sin(x * 0.0085) * 18));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
  curve.arcLengthDivisions = 1200;
  const totalLen = curve.getLength();
  const tAtX = (x: number) => (x - pts[0].x) / (END_X - pts[0].x);
  const basis = (t: number) => {
    const P = curve.getPointAt(t);
    const T = curve.getTangentAt(t);
    const roll = Math.sin(t * 22) * 0.035;
    const up0 = new THREE.Vector3(Math.sin(roll), Math.cos(roll), 0);
    const N = new THREE.Vector3().crossVectors(T, up0).normalize();
    const U = new THREE.Vector3().crossVectors(N, T).normalize();
    return { P, T, N, U };
  };
  {
    const samples = 1100;
    const pos = new Float32Array((samples + 1) * 6);
    const uv = new Float32Array((samples + 1) * 4);
    const idx: number[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const { P, U } = basis(t);
      const a = P.clone().addScaledVector(U, STRIP_H / 2);
      const b = P.clone().addScaledVector(U, -STRIP_H / 2);
      pos.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
      const along = (t * totalLen) / (STRIP_H * 0.5);
      uv.set([along, 1, along, 0], i * 4);
      if (i < samples) {
        const k = i * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    const strip = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: filmTexture(), side: THREE.DoubleSide, alphaTest: 0.5, fog: true }));
    strip.frustumCulled = false;
    scene.add(strip);
  }

  // ---------- The work: a dark void of drifting rock, one glowing screen at a time ----------
  const texLoader = new THREE.TextureLoader();
  const manager = new THREE.LoadingManager();
  texLoader.manager = manager;
  const FIELD_Y = 18;
  const FIELD_Z = -60;
  const SWAY = 20;
  const SCREEN_H = 13;
  const screenX = (i: number) => STRIP_START + 40 + FRAME_GAP * i;
  const accents = films.map((f) => new THREE.Color(f.accent));
  const tint = new THREE.Color();
  const voidCol = new THREE.Color();
  const field = new THREE.Group();
  scene.add(field);
  const frames = films.map((f, i) => {
    const side = i % 2 ? 1 : -1;
    const wide = f.ratio === "16 / 9";
    const w = wide ? (SCREEN_H * 16) / 9 : (SCREEN_H * 9) / 16;
    const poster = texLoader.load(`/media/${f.id}-poster.jpg`);
    poster.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: poster, toneMapped: false, fog: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, SCREEN_H), mat);
    mesh.userData.index = i;
    const edgeMat = new THREE.MeshBasicMaterial({ color: accents[i], toneMapped: false, fog: false, side: THREE.DoubleSide });
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.5, SCREEN_H + 0.5), edgeMat);
    edge.position.z = -0.06;
    const pivot = new THREE.Group();
    const pos = new THREE.Vector3(screenX(i), FIELD_Y + side * 2.5, FIELD_Z + side * SWAY);
    pivot.position.copy(pos);
    pivot.add(edge, mesh);
    field.add(pivot);
    return { mesh, edge, edgeMat, mat, poster, pivot, w, pos, side, lift: 0 };
  });
  // One light ribbon threads every screen together.
  const ribbonMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false, fog: false });
  {
    const pts: THREE.Vector3[] = [];
    for (let i = -1; i <= films.length; i++) {
      const side = i % 2 ? 1 : -1;
      pts.push(new THREE.Vector3(screenX(i) + 4, FIELD_Y + side * 9, FIELD_Z - side * 15));
      pts.push(new THREE.Vector3(screenX(i) + FRAME_GAP * 0.55, FIELD_Y - side * 7, FIELD_Z + side * 12));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    field.add(new THREE.Mesh(new THREE.TubeGeometry(curve, weak ? 200 : 380, 0.11, 5), ribbonMat));
  }
  // Two hoops of light orbit whichever screen is live.
  const halo = new THREE.Group();
  const haloAt = new THREE.Vector3();
  const hoops = [0, 1].map((i) => {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(1, 0.008, 6, 72), ribbonMat);
    hoop.rotation.set(i ? 0.22 : -0.16, Math.PI / 2 + (i ? 0.2 : -0.2), 0, "YXZ");
    halo.add(hoop);
    return hoop;
  });
  field.add(halo);
  // Rock field, drawn in one call and moved as one piece so it costs nothing per frame.
  const rockMat = new THREE.MeshToonMaterial({ color: 0x2c2a36, gradientMap: ramp });
  const rocks = new THREE.Group();
  rocks.position.set(0, FIELD_Y, FIELD_Z);
  field.add(rocks);
  {
    const geo = new THREE.IcosahedronGeometry(1, 1).toNonIndexed();
    const gp = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < gp.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(gp, i);
      const n = Math.sin(v.x * 7.1 + v.y * 3.3) * Math.cos(v.z * 5.7 + v.x * 2.1);
      v.multiplyScalar(1 + n * 0.24);
      gp.setXYZ(i, v.x, v.y * 0.82, v.z);
    }
    geo.computeVertexNormals();
    const count = weak ? 150 : 380;
    const mesh = new THREE.InstancedMesh(geo, rockMat, count);
    const d = new THREE.Object3D();
    let placed = 0;
    while (placed < count) {
      const ang = Math.random() * Math.PI * 2;
      const r = 24 + Math.pow(Math.random(), 0.7) * 125;
      const y = Math.sin(ang) * r;
      const z = Math.cos(ang) * r;
      if (Math.abs(y) < 15 && Math.abs(z) < SWAY + 18) continue;
      const big = Math.random() < 0.08;
      d.position.set(screenX(-1) + Math.random() * (FRAME_GAP * (films.length + 2)), y, z);
      d.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      d.scale.setScalar(big ? 9 + Math.random() * 9 : 0.7 + Math.random() * 3.6);
      d.updateMatrix();
      mesh.setMatrixAt(placed++, d.matrix);
    }
    mesh.frustumCulled = false;
    rocks.add(mesh);
  }
  // Covers the sky while the work is on show.
  const domeMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, transparent: true, opacity: 0, fog: false, depthWrite: false, toneMapped: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(1500, 16, 10), domeMat);
  dome.renderOrder = -1;
  scene.add(dome);

  // One video decoder for the whole world, moved to whichever frame is nearest.
  const video = document.createElement("video");
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  const videoTex = new THREE.VideoTexture(video);
  videoTex.colorSpace = THREE.SRGBColorSpace;
  let liveFrame = -1;
  const goLive = (i: number) => {
    if (i === liveFrame) return;
    if (liveFrame >= 0) frames[liveFrame].mat.map = frames[liveFrame].poster;
    liveFrame = i;
    cb.onFrame?.(i);
    if (i < 0) {
      video.pause();
      return;
    }
    const target = i;
    video.src = `/media/${films[i].id}-preview.mp4`;
    video.oncanplay = () => {
      if (liveFrame === target) {
        frames[target].mat.map = videoTex;
        frames[target].mat.needsUpdate = true;
      }
      video.oncanplay = null;
    };
    video.play().catch(() => {});
  };

  // ---------- Clouds: smooth cel-shaded masses, far enough to read as sky ----------
  const puff = new THREE.SphereGeometry(1, 12, 8);
  const CLOUDS = weak ? 180 : 340;
  const cloudMat = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: ramp });
  const clouds = new THREE.InstancedMesh(puff, cloudMat, CLOUDS);
  {
    const d = new THREE.Object3D();
    let n = 0;
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    while (n < CLOUDS) {
      const cx = rand(-300, END_X + 300);
      const low = Math.random() < 0.82;
      const cy = low ? rand(-105, -62) : rand(30, 170);
      const cz = low ? rand(-520, 170) : rand(-720, -420);
      const size = rand(14, 34);
      const parts = 6 + Math.floor(Math.random() * 6);
      for (let p = 0; p < parts && n < CLOUDS; p++, n++) {
        const s = size * rand(0.35, 1);
        const along = (p / parts - 0.5) * 3.4;
        d.position.set(cx + along * size, cy + (1 - Math.abs(along) / 1.8) * size * 0.4 + rand(-0.1, 0.1) * size, cz + rand(-0.5, 0.5) * size);
        d.scale.set(s * 1.5, s * 0.72, s * 1.1);
        d.updateMatrix();
        clouds.setMatrixAt(n, d.matrix);
      }
    }
  }
  clouds.frustumCulled = false;
  scene.add(clouds);

  // ---------- Islands ----------
  const heroIsland = rock(24, 1.3, 0x3a1622, ramp);
  heroIsland.position.set(0, 0, 0);
  scene.add(heroIsland);
  const END = basis(tAtX(END_X - 60)).P;
  const dawnPos = new THREE.Vector3(END.x + 34, END.y - 12, END.z + 30);
  const dawnIsland = rock(34, 4.2, 0x5f9a4a, ramp);
  dawnIsland.position.copy(dawnPos);
  scene.add(dawnIsland);
  const floaters: THREE.Group[] = [];
  for (let i = 0; i < (weak ? 9 : 15); i++) {
    const g = rock(5 + Math.random() * 11, i * 2.7, i % 3 ? 0x2c3a4c : 0x3f5a3c, ramp);
    g.position.set(40 + (i / 15) * END_X, -6 + Math.random() * 46, -205 - Math.random() * 130);
    g.userData.seed = Math.random() * 10;
    floaters.push(g);
    scene.add(g);
  }

  const startReel = reel(26, ramp);
  startReel.position.set(STRIP_START - 28, 18, -156);
  const endReel = reel(30, ramp);
  endReel.position.copy(END).add(new THREE.Vector3(6, 6, -30));
  scene.add(startReel, endReel);

  // ---------- Models ----------
  const heroA = new THREE.Group();
  const heroB = new THREE.Group();
  const car = new THREE.Group();
  const propCamera = new THREE.Group();
  const propClapper = new THREE.Group();
  const propPhones = new THREE.Group();
  scene.add(heroA, heroB, car, propCamera, propClapper, propPhones);

  const propT = [0, 1, 2].map((i) => tAtX(STRIP_START + 40 + FRAME_GAP * films.length + 215 + i * 70));
  propT.forEach((t, i) => {
    const { P, N } = basis(t);
    [propCamera, propClapper, propPhones][i].position.copy(P).addScaledVector(N, 12);
  });

  heroA.position.set(-2, 1.5, 4);
  heroA.rotation.y = -0.32;
  heroB.rotation.y = Math.PI;
  heroB.position.copy(dawnPos).add(new THREE.Vector3(-2, 2.5, 6));

  const fit = (root: THREE.Object3D, height: number, ink: number, emissive = 0.0) => {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const scale = height / size.y;
    root.scale.setScalar(scale);
    const c = box.getCenter(new THREE.Vector3());
    root.position.set(-c.x * scale, -box.min.y * scale, -c.z * scale);
    const inks: THREE.Mesh[] = [];
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const old = m.material as THREE.MeshStandardMaterial;
      m.material = new THREE.MeshToonMaterial({
        map: old.map ?? null,
        color: old.map ? 0xffffff : old.color,
        gradientMap: ramp,
        emissive: new THREE.Color(0xffffff),
        emissiveMap: old.map ?? null,
        emissiveIntensity: emissive,
      });
      if (ink > 0) inks.push(new THREE.Mesh(m.geometry, inkMaterial(ink / scale)));
    });
    inks.forEach((h, i) => {
      let k = 0;
      root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh && !inks.includes(o as THREE.Mesh)) {
          if (k === i) o.add(h);
          k++;
        }
      });
    });
    return root;
  };

  const loader = new GLTFLoader(manager);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const load = (name: string, then: (s: THREE.Group) => void) =>
    loader.load(`/models/${name}.glb`, (g) => then(g.scene), undefined, (e) => console.error(name, e));

  load(weak ? "hero-lite" : "hero", (s) => {
    heroA.add(fit(s, 15, 0, 0.62));
    const clone = s.clone(true);
    clone.scale.copy(s.scale);
    heroB.add(clone);
  });
  load("car", (s) => car.add(fit(s, 4.6, 0.035, 0.22)));
  load("camera", (s) => propCamera.add(fit(s, 12, 0.04, 0.32)));
  load("clapper", (s) => propClapper.add(fit(s, 11, 0.04, 0.32)));
  load("headphones", (s) => propPhones.add(fit(s, 11, 0.04, 0.32)));

  manager.onProgress = (_, done, total) => cb.onLoad?.(done / total);
  let readyFired = false;
  manager.onLoad = () => {
    if (readyFired) return;
    readyFired = true;
    cb.onLoad?.(1);
    // Shaders and textures are prepared now rather than on first sight, which is what causes stutter.
    const hidden: THREE.Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    renderer
      .compileAsync(scene, camera)
      .catch(() => {})
      .then(() => {
        scene.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.MeshToonMaterial | undefined;
          if (m?.map) renderer.initTexture(m.map);
        });
        hidden.forEach((o) => (o.visible = false));
        warmed = true;
        cb.onReady?.();
      });
  };

  // ---------- Grass: thousands of blades moving in the same wind ----------
  const grassU = { uTime: skyU.uTime, uRoot: { value: new THREE.Color() }, uTip: { value: new THREE.Color() } };
  const grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: grassU,
    vertexShader: `
      uniform float uTime; varying float vH;
      void main(){
        vH=position.y;
        vec4 w=instanceMatrix*vec4(position,1.);
        float gust=sin(w.x*.35+uTime*1.5)+sin(w.z*.5+uTime*2.3)*.5;
        w.x+=gust*.42*vH*vH; w.z+=gust*.2*vH*vH;
        gl_Position=projectionMatrix*modelViewMatrix*w;
      }`,
    fragmentShader: `
      uniform vec3 uRoot,uTip; varying float vH;
      void main(){ gl_FragColor=vec4(mix(uRoot,uTip,step(.55,vH)),1.); }`,
  });
  const bladeGeo = new THREE.BufferGeometry();
  bladeGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.09, 0, 0, 0.09, 0, 0, -0.05, 0.55, 0, 0.05, 0.55, 0, 0, 1, 0]), 3));
  bladeGeo.setIndex([0, 1, 2, 1, 3, 2, 2, 3, 4]);
  const addGrass = (parent: THREE.Object3D, radius: number, count: number) => {
    const m = new THREE.InstancedMesh(bladeGeo, grassMat, count);
    const d = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const r = Math.sqrt(Math.random()) * radius * 0.82;
      const a = Math.random() * Math.PI * 2;
      d.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r);
      d.rotation.y = Math.random() * Math.PI;
      const h = 0.7 + Math.random() * 1.5;
      d.scale.set(1.4, h, 1.4);
      d.updateMatrix();
      m.setMatrixAt(i, d.matrix);
    }
    m.frustumCulled = false;
    parent.add(m);
  };
  addGrass(heroIsland, 24, weak ? 900 : 2400);
  addGrass(dawnIsland, 34, weak ? 900 : 2400);

  // ---------- The title is a place: giant letters you fly through ----------
  const titleGroup = new THREE.Group();
  scene.add(titleGroup);
  const oCentre = new THREE.Vector3(30, 16, -46);
  type Letter = { root: THREE.Group; ch: string; w: number; cy: number; seed: number };
  const letters: Letter[] = [];
  const layoutTitle = (aspect: number) => {
    if (!letters.length) return;
    const stacked = aspect < 1;
    const rows = stacked ? [letters.slice(0, 3), letters.slice(3)] : [letters];
    const gap = 1.8;
    const rowW = (row: Letter[]) => row.reduce((n, l) => n + l.w + gap, -gap);
    const widest = Math.max(...rows.map(rowW));
    // Sized so the word spans the view at the depth it stands at.
    const dist = stacked ? 92 : 90;
    const view = 2 * dist * Math.tan(THREE.MathUtils.degToRad(stacked ? 23 : 19)) * aspect;
    const scale = (view * (stacked ? 0.72 : 0.9)) / widest;
    titleGroup.scale.setScalar(scale);
    titleGroup.position.set(stacked ? -2 : -17, stacked ? 33 : 34, -46);
    const lh = 21;
    rows.forEach((row, ri) => {
      let x = -rowW(row) / 2;
      row.forEach((l) => {
        l.root.position.set(x, (rows.length - 1 - ri) * lh, 0);
        l.root.userData.base = l.root.position.clone();
        x += l.w + gap;
      });
    });
    const o = letters[letters.length - 1];
    titleGroup.updateMatrixWorld(true);
    const local = new THREE.Vector3(o.w / 2, o.cy, 3).add(o.root.position);
    oCentre.copy(local).applyMatrix4(titleGroup.matrixWorld);
  };
  manager.itemStart("font");
  new FontLoader().load(
    "/fonts/title.json",
    (font) => {
      const face = new THREE.MeshBasicMaterial({ color: 0xfff7ea, fog: false, toneMapped: false });
      const side = new THREE.MeshBasicMaterial({ color: 0xe0152b, fog: false, toneMapped: false });
      "TORETO".split("").forEach((ch, i) => {
        const g = new TextGeometry(ch, { font, size: 24, depth: 6, curveSegments: 18, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.3, bevelSegments: 2 });
        g.computeBoundingBox();
        const w = g.boundingBox!.max.x - g.boundingBox!.min.x;
        g.translate(-g.boundingBox!.min.x, 0, 0);
        const root = new THREE.Group();
        root.add(new THREE.Mesh(g, [face, side]));
        const inkSource = g.clone();
        inkSource.deleteAttribute("uv");
        inkSource.deleteAttribute("normal");
        const inkGeo = mergeVertices(inkSource, 0.01);
        inkGeo.computeVertexNormals();
        root.add(new THREE.Mesh(inkGeo, inkMaterial(0.28)));
        titleGroup.add(root);
        const cy = (g.boundingBox!.max.y + g.boundingBox!.min.y) / 2;
        letters.push({ root, ch, w, cy, seed: i * 1.7 });
      });
      layoutTitle(camera.aspect);
      path = buildPath(camera.aspect);
      manager.itemEnd("font");
    },
    undefined,
    () => manager.itemEnd("font")
  );

  // ---------- Air: petals and rain live in a box around the camera ----------
  const AIR = weak ? 500 : 1100;
  const airPos = new Float32Array(AIR * 3);
  const airSeed = new Float32Array(AIR);
  for (let i = 0; i < AIR; i++) {
    airPos.set([Math.random() * 160, Math.random() * 110, Math.random() * 160], i * 3);
    airSeed[i] = Math.random();
  }
  const airGeo = new THREE.BufferGeometry();
  airGeo.setAttribute("position", new THREE.BufferAttribute(airPos, 3));
  airGeo.setAttribute("aSeed", new THREE.BufferAttribute(airSeed, 1));
  const airU = {
    uTime: { value: 0 },
    uCam: { value: new THREE.Vector3() },
    uRain: { value: 0 },
    uColor: { value: new THREE.Color() },
    uPx: { value: dpr },
  };
  const air = new THREE.Points(
    airGeo,
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: airU,
      vertexShader: `
        attribute float aSeed; uniform float uTime,uRain,uPx; uniform vec3 uCam; varying float vA; varying float vS;
        void main(){
          vec3 p=position;
          float fall=mix(1.6+aSeed*2.,62.,uRain);
          p.y-=uTime*fall;
          p.x+=uTime*mix(2.4,5.,uRain)+sin(uTime*.5+aSeed*40.)*mix(3.,0.,uRain);
          vec3 box=vec3(160.,110.,160.);
          p=mod(p-uCam+box*.5,box)-box*.5+uCam;
          vec4 mv=modelViewMatrix*vec4(p,1.);
          vS=aSeed;
          vA=smoothstep(4.,16.,-mv.z);
          gl_PointSize=uPx*(mix(1.6,1.,uRain)+aSeed*mix(3.2,1.4,uRain))*(110./-mv.z);
          gl_Position=projectionMatrix*mv;
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uRain; varying float vA; varying float vS;
        void main(){
          vec2 c=gl_PointCoord-.5;
          float a=sin(vS*30.); mat2 r=mat2(cos(a),-sin(a),sin(a),cos(a));
          vec2 petal=r*c;
          float shape=mix(smoothstep(.5,.42,length(petal*vec2(1.,2.1))),smoothstep(.1,.02,abs(c.x))*.7,uRain);
          if(shape<.01) discard;
          gl_FragColor=vec4(uColor,shape*vA*.9);
        }`,
    })
  );
  air.frustumCulled = false;
  scene.add(air);

  // ---------- Action lines: they answer to how fast you are moving ----------
  const linesU = { uTime: { value: 0 }, uAmt: { value: 0 }, uAspect: { value: 1 } };
  const lines = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: linesU,
      vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=vec4(position.xy,0.,1.); }`,
      fragmentShader: `
        uniform float uTime,uAmt,uAspect; varying vec2 vP;
        float h(float x){ return fract(sin(x*91.17)*43758.5453); }
        void main(){
          vec2 p=vec2(vP.x*uAspect,vP.y);
          float a=atan(p.y,p.x)*38./3.14159;
          float i=floor(a), f=fract(a);
          float seed=h(i);
          float flick=step(.5,fract(seed*7.+uTime*(1.2+seed*2.)));
          float width=.05+seed*.14;
          float line=smoothstep(width,width*.4,abs(f-.5))*flick*step(.45,seed);
          float inner=mix(1.25,.52,uAmt);
          float m=smoothstep(inner,inner+.42,length(p));
          gl_FragColor=vec4(1.,.97,.93,line*m*uAmt*.85);
        }`,
    })
  );
  lines.frustumCulled = false;
  lines.renderOrder = 999;
  scene.add(lines);

  // ---------- The flight path ----------
  const camPts: THREE.Vector3[] = [];
  const lookPts: THREE.Vector3[] = [];
  const buildPath = (aspect: number) => {
    camPts.length = 0;
    lookPts.length = 0;
    const add = (c: THREE.Vector3, l: THREE.Vector3) => {
      camPts.push(c);
      lookPts.push(l);
    };
    const portrait = aspect < 1;
    const heroBack = portrait ? 1.65 : 1;
    const head = heroA.position.clone().add(new THREE.Vector3(0, portrait ? 7 : 8, 0));
    // Hero: three moves around him, then off the edge.
    add(new THREE.Vector3(portrait ? -2 : -8, 1.5, portrait ? 40 : 44), head.clone().add(new THREE.Vector3(portrait ? 0 : -10, portrait ? 2.5 : 3.2, 0)));
    add(new THREE.Vector3(portrait ? 5 : 8, 13, portrait ? 24 : 15), head.clone().add(new THREE.Vector3(portrait ? 0 : -10, portrait ? 2.5 : 1.5, 0)));
    // Straight through the O, with the strip waiting on the other side.
    add(oCentre.clone().add(new THREE.Vector3(0, 0, -1)), oCentre.clone().add(new THREE.Vector3(3, -2, -70)));

    // Strip revealed wide
    // The field revealed from outside, then a dive from screen to screen.
    add(
      new THREE.Vector3(screenX(0) - 92 * heroBack, FIELD_Y + 5, FIELD_Z + 2),
      new THREE.Vector3(screenX(0) + 30, FIELD_Y - 11, FIELD_Z - 2)
    );
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    frames.forEach((f) => {
      const byH = (SCREEN_H / 2) / (0.56 * tan);
      const byW = (f.w / 2) / (0.86 * tan * aspect);
      const d = Math.max(byH, byW) + 3;
      add(
        new THREE.Vector3(f.pos.x - d, f.pos.y + 0.6, f.pos.z),
        new THREE.Vector3(f.pos.x, f.pos.y - (portrait ? 3 : 2.4), f.pos.z)
      );
    });

    // The car runs along the top edge of the strip
    const cA = basis(carT(0.1));
    const cB = basis(carT(0.55));
    add(cA.P.clone().addScaledVector(cA.N, 44 * heroBack).addScaledVector(cA.U, 18), cA.P.clone().addScaledVector(cA.U, STRIP_H / 2));
    add(cB.P.clone().addScaledVector(cB.N, 13 * heroBack).addScaledVector(cB.U, STRIP_H / 2 + 4).addScaledVector(cB.T, -6), cB.P.clone().addScaledVector(cB.U, STRIP_H / 2 + 1).addScaledVector(cB.T, 14));

    // Props
    [propCamera, propClapper, propPhones].forEach((prop, i) => {
      const { N, U, T } = basis(propT[i]);
      add(prop.position.clone().addScaledVector(N, 26 * heroBack).addScaledVector(U, 3).addScaledVector(T, portrait ? 0 : -9), prop.position.clone().addScaledVector(U, portrait ? -2 : 3).addScaledVector(T, portrait ? 0 : -7));
    });

    // Rising above the strip for the process stop
    const before = basis(propT[2] + 0.03);
    add(before.P.clone().addScaledVector(before.N, 60).addScaledVector(before.U, 46), before.P.clone().addScaledVector(before.T, 90).addScaledVector(before.U, -4));

    // Dawn: behind the hero, looking at the sun
    add(dawnPos.clone().add(new THREE.Vector3(portrait ? -2 : -22, portrait ? 7 : 6, 36 * heroBack)), dawnPos.clone().add(new THREE.Vector3(portrait ? 0 : -13, portrait ? 3 : 15, -30)));
    return { cam: new THREE.CatmullRomCurve3(camPts.map((p) => p.clone()), false, "centripetal"), look: new THREE.CatmullRomCurve3(lookPts.map((p) => p.clone()), false, "centripetal") };
  };
  const carStart = tAtX(STRIP_START + 40 + FRAME_GAP * films.length - 10);
  const carEnd = tAtX(STRIP_START + 40 + FRAME_GAP * films.length + 170);
  function carT(k: number) {
    return carStart + (carEnd - carStart) * k;
  }

  let path = buildPath(1.6);

  // ---------- Post ----------
  const useBloom = false; // Native antialiasing is far cheaper, and flat colour suits cel shading.
  const composer = useBloom
    ? new EffectComposer(renderer, new THREE.WebGLRenderTarget(4, 4, { samples: 4, type: THREE.HalfFloatType }))
    : null;
  if (composer) {
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.16, 0.5, 0.97));
    composer.addPass(new OutputPass());
  }

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer?.setPixelRatio(dpr);
    composer?.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = w < h ? 46 : 38;
    camera.updateProjectionMatrix();
    layoutTitle(w / h);
    linesU.uAspect.value = w / h;
    airU.uPx.value = dpr;
    path = buildPath(w / h);
  };
  resize();
  addEventListener("resize", resize);

  // ---------- Loop ----------
  let target = 0;
  let u = 0;
  const pointer = new THREE.Vector2();
  const pointerS = new THREE.Vector2();
  const camPos = new THREE.Vector3();
  const lookAt = new THREE.Vector3();
  const c = new THREE.Color();
  const timer = new THREE.Timer();
  let raf = 0;
  let elapsed = 0;
  let speed = 0;
  let frameTimeAvg = 16;
  let lastDprChange = 0;
  let introStart = -1;
  let warmed = false; // Nothing renders until the world is prepared.
  let pinned = -1; // Dev only: holds the camera on one shot for inspection.

  // Slows near each stop without ever stopping, so the flight never hitches.
  const ease = (s: number) => {
    const i = Math.min(Math.floor(s), LAST - 1);
    const f = s - i;
    return (i + f - (0.72 * Math.sin(2 * Math.PI * f)) / (2 * Math.PI)) / LAST;
  };

  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!warmed) return;
    timer.update();
    const raw = timer.getDelta();
    const dt = Math.min(raw, 0.25);
    elapsed += dt;

    if (pinned >= 0) u = target = pinned;
    const prev = u;
    u += (target - u) * (1 - Math.exp(-dt * 7));
    const instant = Math.abs(u - prev) / Math.max(dt, 0.001);
    speed += (Math.min(instant * 12, 1) - speed) * (1 - Math.exp(-dt * 6));
    pointerS.lerp(pointer, 1 - Math.exp(-dt * 3));

    const s = Math.min(u * LAST, LAST - 1e-4);
    const k = ease(s);
    path.cam.getPoint(k, camPos);
    path.look.getPoint(k, lookAt);
    camera.position.copy(camPos);
    camera.position.x += pointerS.x * 1.6 + Math.sin(elapsed * 0.31) * 0.22;
    camera.position.y += pointerS.y * 1 + Math.sin(elapsed * 0.43) * 0.18;
    // The opening push-in.
    const introT = introStart < 0 ? 0 : THREE.MathUtils.clamp((elapsed - introStart) / 2.1, 0, 1);
    const introE = 1 - Math.pow(1 - introT, 3);
    if (s < 1.2) {
      camera.position.z += (1 - introE) * 26;
      camera.position.y += (1 - introE) * 5;
    }
    heroA.scale.setScalar(0.9 + 0.1 * introE);
    // He turns to meet the camera in the close-up, so the face stays readable.
    heroA.rotation.y = THREE.MathUtils.lerp(-0.32, 0.62, THREE.MathUtils.smootherstep(s, 0, 1));
    camera.lookAt(lookAt);
    camera.rotation.z += Math.sin(u * 40) * 0.012 * speed;

    // Colour journey
    const j = Math.min(u * 1.0, 1);
    mix(skyU.uTop.value, j, "top");
    mix(skyU.uLow.value, j, "low");
    mix(skyU.uGlow.value, j, "glow");
    mix(skyU.uCloud.value, j, "cloud");
    mix(skyU.uShade.value, j, "shade");
    mix(moonU.uBand.value, j, "shade");
    mix(grassU.uRoot.value, j, "shade");
    mix(grassU.uTip.value, j, "cloud");
    grassU.uTip.value.lerp(c.set(j > 0.8 ? 0x8fbf5a : 0xa3233e), 0.75);
    skyU.uTime.value = elapsed;
    skyU.uRays.value = THREE.MathUtils.smoothstep(j, 0.8, 0.98);
    mix(moonColor, j, "sun");
    mix(moonU.uShade.value, j, "glow");
    mix(cloudMat.color, j, "cloud");
    mix(sun.color, j, "light");
    mix(hemi.color, j, "fill");
    (scene.fog as THREE.Fog).color.copy(mix(c, j, "low"));
    skyU.uStars.value = 1 - THREE.MathUtils.smoothstep(j, 0.48, 0.66);
    const rain = THREE.MathUtils.smoothstep(j, 0.26, 0.38) * (1 - THREE.MathUtils.smoothstep(j, 0.52, 0.62));
    airU.uRain.value = rain;
    // Soft sheet lightning while it rains: a slow glow, never a strobe.
    const pulse = Math.max(0, Math.sin(elapsed * 0.9) * Math.sin(elapsed * 0.37 + 1.3) - 0.72) * 3.2;
    skyU.uFlash.value = rain * pulse * 0.22;
    airU.uColor.value.copy(rain > 0.5 ? c.set(0xcfe0ff) : mix(c, j, "sun").lerp(new THREE.Color(0xff6a7a), 1 - j * 0.6));

    // Sun and moon stay out in the sky ahead of the camera
    const dawn = THREE.MathUtils.smoothstep(j, 0.86, 1);
    moon.position.set(camera.position.x + THREE.MathUtils.lerp(70, 180, dawn), THREE.MathUtils.lerp(110, 60, dawn) + camera.position.y * 0.4, camera.position.z - 780);
    moon.scale.setScalar(THREE.MathUtils.lerp(1.15, 0.9, dawn));
    // The moon clears the frame while the work is on show.
    const onRing = THREE.MathUtils.smoothstep(s, 2.1, 2.9) * (1 - THREE.MathUtils.smoothstep(s, 11.2, 12.2));
    moon.position.y += onRing * 420;
    skyU.uSunDir.value.copy(moon.position).sub(camera.position).normalize();
    sky.position.copy(camera.position);

    // Each edit brings its own colour into the void.
    const fp = THREE.MathUtils.clamp(s - 4, 0, films.length - 1);
    const fi = Math.floor(fp);
    tint.copy(accents[fi]).lerp(accents[Math.min(fi + 1, films.length - 1)], fp - fi);
    voidCol.copy(tint).multiplyScalar(0.007);
    const fog = scene.fog as THREE.Fog;
    fog.color.lerp(voidCol, onRing);
    fog.near = THREE.MathUtils.lerp(90, 30, onRing);
    fog.far = THREE.MathUtils.lerp(620, 215, onRing);
    dome.visible = onRing > 0.002;
    dome.position.copy(camera.position);
    domeMat.opacity = onRing;
    domeMat.color.copy(voidCol);
    field.visible = s > 2.2 && s < 12.8;
    if (field.visible) {
      ribbonMat.color.copy(tint);
      rockMat.emissive.copy(tint).multiplyScalar(0.03);
      rocks.rotation.x = Math.sin(elapsed * 0.07) * 0.14;
      const showing = frames[fi];
      haloAt.copy(showing.pos);
      haloAt.x += 4;
      halo.position.lerp(haloAt, 1 - Math.exp(-dt * 5));
      const hs = Math.max(showing.w * 0.62, SCREEN_H * 0.82);
      halo.scale.setScalar(halo.scale.x + (hs - halo.scale.x) * (1 - Math.exp(-dt * 5)));
      hoops[0].rotation.x = Math.sin(elapsed * 0.5) * 0.2;
      hoops[1].rotation.x = -Math.sin(elapsed * 0.37) * 0.24;
      frames.forEach((f, i) => {
        f.lift += ((i === liveFrame ? 1 : 0) - f.lift) * (1 - Math.exp(-dt * 6));
        f.pivot.position.y = f.pos.y + Math.sin(elapsed * 0.6 + i) * 0.25;
        // Facing the incoming camera, with a slight lean towards the pointer.
        f.pivot.rotation.y = -Math.PI / 2 - f.side * 0.1 + pointerS.x * 0.05 * f.lift;
        f.pivot.rotation.x = -pointerS.y * 0.04 * f.lift;
        f.pivot.scale.setScalar(0.92 + 0.08 * f.lift);
        const l = 0.22 + 0.78 * f.lift;
        f.mat.color.setRGB(l, l, l);
        f.edgeMat.color.copy(accents[i]).multiplyScalar(0.25 + 0.75 * f.lift);
      });
    }

    // Letters breathe and lean with the pointer.
    letters.forEach((l, i) => {
      const base = l.root.userData.base as THREE.Vector3 | undefined;
      if (!base) return;
      const t = introStart < 0 ? 0 : THREE.MathUtils.clamp((elapsed - introStart - 0.25 - i * 0.1) / 0.75, 0, 1);
      // Overshoots slightly, so each letter lands with weight.
      const back = 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
      l.root.position.y = base.y + Math.sin(elapsed * 0.7 + l.seed) * 0.32 + (1 - back) * 46;
      l.root.rotation.x = (1 - back) * -1.1;
      l.root.rotation.y = Math.sin(elapsed * 0.45 + l.seed) * 0.03 + pointerS.x * 0.03;
      l.root.visible = t > 0;
    });
    titleGroup.visible = s < 3.6;

    // Time-based motion
    airU.uTime.value = elapsed;
    airU.uCam.value.copy(camera.position);
    linesU.uTime.value = elapsed;
    linesU.uAmt.value = speed;
    lines.visible = speed > 0.02;

    heroA.position.y = 1.5 + Math.sin(elapsed * 0.9) * 0.08;
    heroIsland.position.y = Math.sin(elapsed * 0.45) * 0.7;
    heroA.position.y += heroIsland.position.y;
    dawnIsland.position.y = dawnPos.y + Math.sin(elapsed * 0.4) * 0.7;
    heroB.position.y = dawnIsland.position.y + 2.5;
    floaters.forEach((f) => {
      f.position.y += Math.sin(elapsed * 0.4 + f.userData.seed) * 0.01;
      f.rotation.y += dt * 0.03;
    });
    startReel.rotation.z = -u * 40 - elapsed * 0.1;
    endReel.rotation.z = -u * 40 - elapsed * 0.1;

    propCamera.rotation.y = elapsed * 0.32 - 0.5;
    propClapper.rotation.y = Math.sin(elapsed * 0.5) * 0.7 - 0.2;
    propClapper.rotation.z = Math.sin(elapsed * 0.7) * 0.1;
    propPhones.rotation.y = elapsed * 0.4;
    [propCamera, propClapper, propPhones].forEach((p, i) => {
      p.position.y += Math.sin(elapsed * 0.8 + i) * 0.008;
    });

    // The car drives the top edge of the strip, sped up by your scroll
    const carK = THREE.MathUtils.clamp(0.1 + (s - 12) * 0.45, 0, 1) + Math.sin(elapsed * 0.6) * 0.004;
    const cb2 = basis(carT(carK));
    car.position.copy(cb2.P).addScaledVector(cb2.U, STRIP_H / 2);
    const m = new THREE.Matrix4().makeBasis(cb2.N, cb2.U, cb2.T.clone().negate());
    car.quaternion.setFromRotationMatrix(m);

    // Models out of the shot aren't drawn at all.
    heroA.visible = s < 3.2;
    heroB.visible = s > 16.2;
    heroIsland.visible = s < 4.2;
    dawnIsland.visible = s > 15.5;
    car.visible = s > 10.6 && s < 14.6;
    propCamera.visible = s > 12.6 && s < 15.6;
    propClapper.visible = s > 13.6 && s < 16.6;
    propPhones.visible = s > 14.6 && s < 17.6;

    // Nearest frame goes live
    const nearest = s > 3.55 && s < 11.45 ? THREE.MathUtils.clamp(Math.round(s - 4), 0, films.length - 1) : -1;
    goLive(nearest);

    cb.onTick?.(u);

    if (composer) composer.render(dt);
    else renderer.render(scene, camera);

    // Holds frame rate by trading resolution, a little at a time.
    if (raw < 0.2) frameTimeAvg += (raw * 1000 - frameTimeAvg) * 0.04;
    if (!document.hidden && elapsed - lastDprChange > 2.5) {
      if (frameTimeAvg > 24 && dpr > 0.8) {
        dpr = Math.max(0.8, dpr - 0.15);
        lastDprChange = elapsed;
        resize();
      }
    }
  };
  loop();

  if (process.env.NODE_ENV === "development") {
    (window as unknown as Record<string, unknown>).__world = {
      heroA,
      // jump(shotNumber) holds the camera on a shot; jump(-1) releases it.
      jump: (i: number) => {
        pinned = i < 0 ? -1 : i / LAST;
      },
      // True GPU cost: forces each frame to finish, independent of how the page is presented.
      bench: (n = 6) => {
        const gl = renderer.getContext();
        const px = new Uint8Array(4);
        renderer.info.autoReset = false;
        renderer.info.reset();
        const t = performance.now();
        for (let i = 0; i < n; i++) {
          if (composer) composer.render(0.016);
          else renderer.render(scene, camera);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        }
        const ms = (performance.now() - t) / n;
        const tris = renderer.info.render.triangles / n;
        const calls = renderer.info.render.calls / n;
        renderer.info.autoReset = true;
        return { ms: Math.round(ms * 10) / 10, tris: Math.round(tris), calls: Math.round(calls), dpr, size: [canvas.width, canvas.height] };
      },
    };
  }

  const ray = new THREE.Raycaster();
  return {
    setScroll: (v) => {
      target = v;
    },
    setPointer: (x, y) => pointer.set(x, y),
    begin: () => {
      if (introStart < 0) introStart = elapsed;
    },
    pick: (x, y) => {
      ray.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
      const hit = ray.intersectObjects(frames.map((f) => f.mesh))[0];
      return hit ? (hit.object.userData.index as number) : -1;
    },
    dispose: () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      video.pause();
      video.removeAttribute("src");
      composer?.dispose();
      renderer.dispose();
    },
  };
}
