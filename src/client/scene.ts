import {
  Engine,
  Scene,
  Vector3,
  Color3,
  Color4,
  MeshBuilder,
  PBRMaterial,
  StandardMaterial,
  Texture,
  HDRCubeTexture,
  HemisphericLight,
  DirectionalLight,
  PointLight,
  FreeCamera,
  ShadowGenerator,
  TransformNode,
  DynamicTexture,
  DefaultRenderingPipeline,
  Ray,
  Mesh,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { OBSTACLES, type Raid, type Model, type World } from "../domain/game";
import { characterFactory } from "./characters";
import { createAudio } from "./audio";

export type RenderState = {
  raid: Raid | null;
  active: boolean;
  panel: string;
  shooting: boolean;
  selected: Model;
  muted?: boolean;
  paused?: boolean;
  world?: World;
  quality?: "low" | "standard" | "high";
};
export function createGame(
  canvas: HTMLCanvasElement,
  read: () => RenderState,
  onReady: () => void,
) {
  const engine = new Engine(canvas, true, {
    stencil: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  engine.setHardwareScalingLevel(Math.max(1, window.devicePixelRatio / 1.5));
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.13, 0.19, 0.22, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.22, 0.29, 0.31);
  scene.fogDensity = 0.0048;
  const camera = new FreeCamera("shoulder", new Vector3(7, 4, -16), scene);
  camera.inputs.clear();
  camera.minZ = 0.15;
  camera.maxZ = 1200;
  camera.fov = 0.88;
  const hemi = new HemisphericLight("sky", new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.58;
  hemi.groundColor = Color3.FromHexString("#323d3a");
  const sun = new DirectionalLight(
    "sunset",
    new Vector3(-0.5, -0.38, 0.6),
    scene,
  );
  sun.position = new Vector3(60, 70, -80);
  sun.diffuse = Color3.FromHexString("#ffd0a1");
  sun.intensity = 2.1;
  const shadow = new ShadowGenerator(2048, sun);
  shadow.useBlurExponentialShadowMap = true;
  shadow.blurKernel = 16;
  shadow.darkness = 0.35;
  shadow.bias = 0.0005;
  const env = new HDRCubeTexture(
    "/assets/industrial-sunset.hdr",
    scene,
    128,
    false,
    true,
    false,
    true,
    () => {},
    () => {},
  );
  scene.environmentTexture = env;
  scene.environmentIntensity = 0.55;
  scene.createDefaultSkybox(env, true, 900, 0.25);
  const pipe = new DefaultRenderingPipeline("cinema", true, scene, [camera]);
  pipe.fxaaEnabled = true;
  pipe.bloomEnabled = true;
  pipe.bloomThreshold = 1.2;
  pipe.bloomWeight = 0.16;
  pipe.bloomKernel = 40;
  pipe.imageProcessingEnabled = true;
  pipe.imageProcessing.contrast = 1.2;
  pipe.imageProcessing.exposure = 1.05;
  const materials = new Map<string, PBRMaterial>();
  const metalNormal = new Texture("/assets/metal-normal.jpg", scene);
  metalNormal.uScale = metalNormal.vScale = 2;
  function mat(color: string, metal = 0, rough = 0.7) {
    const key = color + metal + rough;
    let m = materials.get(key);
    if (m) return m;
    m = new PBRMaterial(key, scene);
    m.maxSimultaneousLights = 4;
    m.albedoColor = Color3.FromHexString(color);
    m.metallic = metal;
    m.roughness = rough;
    if (metal >= 0.5 && rough > 0.3) {
      m.bumpTexture = metalNormal;
    }
    materials.set(key, m);
    return m;
  }
  const concrete = mat("#91958d", 0, 0.58);
  concrete.albedoTexture = new Texture("/assets/concrete-color.jpg", scene);
  (concrete.albedoTexture as Texture).uScale = 8;
  (concrete.albedoTexture as Texture).vScale = 8;
  concrete.bumpTexture = new Texture("/assets/concrete-normal.jpg", scene);
  (concrete.bumpTexture as Texture).uScale = 8;
  (concrete.bumpTexture as Texture).vScale = 8;
  function box(
    name: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: PBRMaterial,
    casts = true,
  ) {
    const b = MeshBuilder.CreateBox(
      name,
      { width: w, height: h, depth: d },
      scene,
    );
    b.position.set(x, y, z);
    b.material = m;
    b.receiveShadows = true;
    if (casts) shadow.addShadowCaster(b);
    return b;
  }
  function cylinder(
    name: string,
    x: number,
    y: number,
    z: number,
    d: number,
    h: number,
    m: PBRMaterial,
  ) {
    const b = MeshBuilder.CreateCylinder(
      name,
      { diameter: d, height: h, tessellation: 12 },
      scene,
    );
    b.position.set(x, y, z);
    b.material = m;
    shadow.addShadowCaster(b);
    return b;
  }
  function label(
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    bg = "#20312d",
    ink = "#e5d8bb",
    rotation = 0,
  ) {
    const t = new DynamicTexture(
      text,
      { width: 1024, height: 256 },
      scene,
      true,
    );
    const c = t.getContext();
    c.fillStyle = bg;
    c.fillRect(0, 0, 1024, 256);
    c.font = "bold 95px sans-serif";
    c.fillStyle = ink;
    c.fillText(text, 40, 165);
    t.update();
    const m = new StandardMaterial("sign", scene);
    m.diffuseTexture = t;
    m.emissiveColor = new Color3(0.25, 0.25, 0.22);
    m.specularColor = Color3.Black();
    const p = MeshBuilder.CreatePlane(
      "sign",
      { width: w, height: h, sideOrientation: Mesh.DOUBLESIDE },
      scene,
    );
    p.position.set(x, y, z);
    p.rotation.y = rotation;
    p.material = m;
    return p;
  }
  function lamp(
    x: number,
    y: number,
    z: number,
    color = "#ffcf8b",
    intensity = 8,
  ) {
    box("lamp", x, y, z, 0.7, 0.12, 0.25, mat("#ddd8bc", 0.3, 0.2), false);
    if (scene.lights.length < 4) {
      const light = new PointLight(
        "work light",
        new Vector3(x, y - 0.2, z),
        scene,
      );
      light.diffuse = Color3.FromHexString(color);
      light.intensity = intensity;
      light.range = 12;
    }
    const glow = new StandardMaterial("glow", scene);
    glow.disableLighting = true;
    glow.emissiveColor = Color3.FromHexString(color).scale(2);
    const b = box(
      "lamp glow",
      x,
      y - 0.08,
      z,
      0.5,
      0.03,
      0.19,
      mat("#fff4d3"),
      false,
    );
    b.material = glow;
  }
  box("district floor", 0, -0.22, 20, 52, 0.4, 105, concrete, false);
  // Wet patches, road paint, drainage and embedded rails.
  for (let i = 0; i < 24; i++) {
    const x = Math.sin(i * 23) * 19,
      z = -15 + ((i * 13) % 72);
    const p = MeshBuilder.CreateDisc(
      "puddle",
      { radius: 1 + (i % 4) * 0.4, tessellation: 32 },
      scene,
    );
    p.rotation.x = Math.PI / 2;
    p.position.set(x, 0.006, z);
    p.scaling.y = 0.35;
    const m = mat("#586c6a", 0.65, 0.075);
    m.alpha = 0.55;
    p.material = m;
  }
  for (let z = -14; z < 60; z += 5) {
    box("paint line", -5, 0.012, z, 0.12, 0.012, 2, mat("#bca976"), false);
    box("paint line", 5, 0.012, z, 0.12, 0.012, 2, mat("#bca976"), false);
  }
  for (const x of [-18, 18])
    box("drain", x, 0.01, 20, 0.4, 0.03, 78, mat("#283936", 0.6, 0.45), false);
  for (const x of [-3, 3])
    box("rail", x, 0.02, 40, 0.06, 0.04, 40, mat("#8f9a92", 0.9, 0.3), false);
  // Shipping containers with corrugation, corner castings, labels and doors.
  for (const [i, o] of OBSTACLES.entries()) {
    const m = mat(
      o.color ?? (o.kind === "crate" ? "#6d6654" : "#63706b"),
      o.kind === "container" ? 0.6 : 0.1,
      0.55,
    );
    box(o.kind, o.x, o.h / 2, o.z, o.w, o.h, o.d, m);
    if (o.kind === "container") {
      for (let j = -o.d / 2 + 0.25; j < o.d / 2; j += 0.45) {
        for (const side of [-1, 1])
          box(
            "corrugation",
            o.x + side * (o.w / 2 + 0.015),
            o.h / 2,
            o.z + j,
            0.055,
            o.h - 0.15,
            0.13,
            m,
            false,
          );
      }
      for (const side of [-1, 1]) {
        box(
          "door seam",
          o.x,
          1.5,
          o.z + side * (o.d / 2 + 0.02),
          0.04,
          2.8,
          0.04,
          mat("#253835"),
          false,
        );
        for (const xx of [-o.w * 0.24, o.w * 0.24])
          cylinder(
            "locking bar",
            o.x + xx,
            1.4,
            o.z + side * (o.d / 2 + 0.07),
            0.045,
            2.5,
            mat("#a7b0a5", 0.8, 0.3),
          );
      }
      label(
        `DP ${7210 + i}`,
        o.x,
        2.2,
        o.z - o.d / 2 - 0.04,
        o.w * 0.7,
        0.45,
        "#354844",
        "#d7d5b6",
      );
    } else if (o.kind === "crate") {
      for (const dy of [0.15, o.h - 0.15])
        box(
          "crate strap",
          o.x,
          dy,
          o.z,
          o.w + 0.03,
          0.09,
          o.d + 0.03,
          mat("#303e38", 0.6),
          false,
        );
    }
  }
  // Market hall framing and merchant counters, open on the street.
  const structure = mat("#3c4c47", 0.7, 0.48),
    plaster = mat("#b5aa91", 0, 0.86);
  box("market back", -13, 2.6, -10, 11, 5.2, 0.4, plaster);
  box("market side", -18.5, 2.6, -4, 0.4, 5.2, 12, plaster);
  box("market roof", -13, 5.4, -4, 12, 0.25, 14, structure);
  for (const z of [-10, -4, 2]) {
    box("pillar", -7, 2.65, z, 0.18, 5.3, 0.18, structure);
    box("beam", -13, 5.05, z, 12, 0.2, 0.18, structure);
  }
  const stockCases: Mesh[][] = [[], [], []];
  for (let i = 0; i < 3; i++) {
    const z = -7 + i * 3.3;
    box("counter", -11.5, 0.65, z, 3, 1.3, 2.3, mat("#525b4c"));
    box(
      "countertop",
      -11.5,
      1.35,
      z,
      3.2,
      0.12,
      2.45,
      mat("#786851", 0.05, 0.4),
    );
    box("shelves", -17, 1.6, z, 0.55, 3, 2.5, structure);
    for (const y of [0.45, 1.35, 2.3]) {
      box("shelf", -16.5, y, z, 1.4, 0.07, 2.5, structure);
      for (let j = 0; j < 3; j++)
        stockCases[i].push(
          box(
            "stock case",
            -16.3,
            y + 0.2,
            z - 0.8 + j * 0.65,
            0.5,
            0.35,
            0.5,
            mat(i === 1 ? "#a17d48" : "#526558", 0.3),
            false,
          ),
        );
    }
    lamp(-12, 4.3, z);
  }
  label("THE EXCHANGE", -12.5, 4.5, 3.12, 9, 1.2, "#1c302c", "#f1dbac");
  label(
    "MARA / ARMS BROKER",
    -10,
    2.7,
    -7,
    4,
    0.48,
    "#31453d",
    "#ebcca1",
    Math.PI / 2,
  );
  label(
    "IVO / REPAIR & REBUILD",
    -10,
    2.7,
    -3.7,
    4,
    0.48,
    "#31453d",
    "#ebcca1",
    Math.PI / 2,
  );
  label(
    "SABLE / SUPPLY CO.",
    -10,
    2.7,
    -0.4,
    4,
    0.48,
    "#31453d",
    "#ebcca1",
    Math.PI / 2,
  );
  // Warehouse edges and distinctive extraction gate.
  for (const x of [-22, 22]) {
    box("warehouse", x, 4, 26, 2, 8, 70, mat("#78827a", 0.3, 0.8));
    for (let z = -7; z < 60; z += 5)
      box(
        "support",
        x + (x > 0 ? -0.99 : 0.99),
        3.8,
        z,
        0.2,
        7.6,
        0.2,
        structure,
      );
  }
  for (const x of [-6, 6]) {
    box("gate pillar", x, 3, 58, 0.7, 6, 0.7, mat("#5a8c82", 0.5));
    lamp(x, 5.6, 57, "#a1e0bc", 4);
  }
  box("gate", 0, 5.8, 58, 12, 0.8, 0.6, mat("#546f68", 0.5));
  label("09 / NORTH EXTRACTION", 0, 5.8, 57.65, 10, 0.62);
  label("FREIGHT NINE", 0, 7.8, 28, 10, 1.25, "#31433d", "#ddc6a1");
  box(
    "start extraction",
    0,
    0.025,
    -12,
    5,
    0.02,
    5,
    mat("#527f69", 0.3, 0.4),
    false,
  );
  box(
    "north extraction",
    0,
    0.025,
    57,
    5,
    0.02,
    5,
    mat("#527f69", 0.3, 0.4),
    false,
  );
  // Distant port: water, silhouettes, stacked freight and gantry cranes.
  box("sea", 0, -0.5, 180, 1200, 0.1, 450, mat("#526d73", 0.6, 0.18), false);
  function beam(a: Vector3, b: Vector3, width: number, m: PBRMaterial) {
    const mesh = MeshBuilder.CreateCylinder(
      "steel beam",
      { height: Vector3.Distance(a, b), diameter: width, tessellation: 6 },
      scene,
    );
    mesh.position = Vector3.Center(a, b);
    mesh.material = m;
    const direction = b.subtract(a).normalize();
    mesh.rotationQuaternion = undefined as any;
    mesh.setDirection(direction);
    mesh.rotation.x += Math.PI / 2;
    return mesh;
  }
  for (let i = 0; i < 7; i++) {
    const x = -110 + i * 35,
      z = 95 + (i % 3) * 25;
    const m = mat(i % 2 ? "#8b6548" : "#4c625d", 0.6, 0.65);
    for (const side of [-1, 1]) {
      box("crane leg", x + side * 9, 19, z, 1, 38, 1, m, false);
      box("crane brace", x + side * 9, 18, z + 12, 1, 36, 1, m, false);
    }
    box("gantry", x, 38, z, 24, 1.5, 3, m, false);
    box("crane boom", x, 39, z + 14, 2, 1.5, 65, m, false);
    for (let j = -15; j < 40; j += 5)
      box("boom ties", x, 38.3, z + j, 2, 0.15, 0.3, structure, false);
    box("hanging cable", x, 27, z + 35, 0.05, 24, 0.05, structure, false);
    box("hook", x, 15, z + 35, 3, 0.5, 1, m, false);
  }
  for (let i = 0; i < 35; i++) {
    const x = -100 + ((i * 17) % 210),
      z = 78 + Math.floor(i / 12) * 10;
    box(
      "port freight",
      x,
      2 + (i % 3) * 2,
      z,
      9,
      4,
      5,
      mat(["#596e6c", "#9a7252", "#74817a"][i % 3], 0.4, 0.7),
      false,
    );
  }
  // Floodlights and overhead utility lines.
  for (const x of [-19, 19])
    for (const z of [8, 34, 53]) {
      cylinder("light pole", x, 5, z, 0.12, 10, structure);
      box("light head", x, 10, z, 1.3, 0.2, 0.5, structure);
      lamp(x, 9.8, z, "#f1c28d", 3);
    }
  for (let z = 0; z < 50; z += 17) {
    const points = Array.from(
      { length: 20 },
      (_, i) =>
        new Vector3(
          -21 + (i * 42) / 19,
          9 - Math.sin((i / 19) * Math.PI) * 1.3,
          z,
        ),
    );
    MeshBuilder.CreateLines("cable", { points }, scene).color =
      Color3.FromHexString("#263831");
  }
  // Floating airborne dust catches the last light, kept sparse.
  for (let i = 0; i < 35; i++) {
    const p = MeshBuilder.CreateSphere(
      "dust",
      { diameter: 0.025, segments: 4 },
      scene,
    );
    p.position.set(
      Math.sin(i * 12) * 20,
      1 + ((i * 7) % 8),
      -10 + ((i * 17) % 70),
    );
    p.material = mat("#d9c8a3");
    p.isPickable = false;
  }
  const player = new TransformNode("operator", scene);
  const fallback = new TransformNode("fallback", scene);
  fallback.parent = player;
  function human(parent: TransformNode, color: string) {
    const torso = box("vest", 0, 1.2, 0, 0.55, 0.7, 0.3, mat(color, 0.15, 0.8));
    torso.parent = parent;
    const head = MeshBuilder.CreateSphere(
      "helmet",
      { diameter: 0.34, segments: 12 },
      scene,
    );
    head.position.y = 1.76;
    head.parent = parent;
    head.material = mat("#49564c", 0.3);
    shadow.addShadowCaster(head);
    for (const x of [-0.16, 0.16]) {
      const leg = box("leg", x, 0.45, 0, 0.2, 0.8, 0.23, mat("#3a4944"));
      leg.parent = parent;
    }
    const bag = box(
      "backpack",
      0,
      1.2,
      -0.24,
      0.43,
      0.56,
      0.25,
      mat("#6b6954"),
    );
    bag.parent = parent;
    return parent;
  }
  human(fallback, "#677360");
  const weapon = new TransformNode("equipped gun", scene);
  weapon.parent = player;
  weapon.position.set(0.32, 1.24, 0.35);
  function gunMesh(parent: TransformNode, model: Model) {
    const root = new TransformNode("gun-" + model, scene);
    root.parent = parent;
    const metal = mat("#363f3e", 0.9, 0.28),
      grip = mat("#4e5146", 0.1, 0.85);
    const body = box(
      "receiver",
      0,
      0,
      0,
      0.1,
      0.14,
      model === "pistol" ? 0.24 : 0.5,
      metal,
    );
    body.parent = root;
    const barrel = cylinder(
      "barrel",
      0,
      0.015,
      model === "pistol" ? 0.18 : 0.4,
      0.045,
      model === "pistol" ? 0.18 : 0.45,
      metal,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.parent = root;
    const h = box("grip", 0, -0.14, -0.08, 0.08, 0.22, 0.1, grip);
    h.rotation.x = -0.2;
    h.parent = root;
    if (model !== "pistol") {
      const stock = box("stock", 0, -0.03, -0.38, 0.09, 0.16, 0.3, grip);
      stock.parent = root;
      const mag = box("magazine", 0, -0.17, 0.08, 0.08, 0.25, 0.12, metal);
      mag.rotation.x = -0.12;
      mag.parent = root;
    }
    return root;
  }
  let gunRoot = gunMesh(weapon, "pistol"),
    currentModel: Model = "pistol";
  const makeCharacter = characterFactory(scene, shadow);
  const avatar = makeCharacter(player, "operator", "#777862", () =>
    fallback.setEnabled(false),
  );
  const enemyAnimations = new Map<string, ReturnType<typeof makeCharacter>>();
  const audio = createAudio();
  let lastStep = 0,
    lastReload = 0,
    lastRaid = "";
  const enemyRoots = new Map<string, TransformNode>();
  const crateMeshes = new Map<string, Mesh>();
  const tracers = new Map<number, { mesh: Mesh; at: number }>();
  let lastX = 0,
    lastZ = 0;
  let yaw = 0,
    pitch = 0.12;
  let socket: WebSocket | null = null;
  let seq = 0;
  let shooting = false;
  let needReload = false,
    interact = false;
  const keys = new Set<string>();
  const keydown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement).closest("input")) return;
    keys.add(e.code);
    if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
    if (e.code === "KeyR") needReload = true;
    if (e.code === "KeyE") interact = true;
  };
  const keyup = (e: KeyboardEvent) => keys.delete(e.code);
  const move = (e: MouseEvent) => {
    if (document.pointerLockElement === canvas) {
      yaw += e.movementX * 0.0022;
      pitch = Math.max(-0.42, Math.min(0.6, pitch + e.movementY * 0.0015));
    }
  };
  const down = (e: MouseEvent) => {
    audio.unlock();
    if (e.button === 0 && read().active) {
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock();
      else shooting = true;
    }
  };
  const up = () => (shooting = false);
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
  window.addEventListener("mousemove", move);
  canvas.addEventListener("mousedown", down);
  window.addEventListener("mouseup", up);
  const blur = () => {
    keys.clear();
    shooting = false;
  };
  window.addEventListener("blur", blur);
  const interval = setInterval(() => {
    const state = read();
    if (!state.active || state.paused || !socket || socket.readyState !== 1) {
      blur();
      return;
    }
    seq = Math.max(seq, state.raid?.seq ?? 0) + 1;
    socket.send(
      JSON.stringify({
        seq,
        forward: (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0),
        strafe: (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
        yaw,
        shoot: shooting,
        reload: needReload,
        interact,
      }),
    );
    needReload = false;
    interact = false;
  }, 50);
  let appliedQuality = "",
    lastEconomy = "",
    lastMetrics = 0;
  function frame() {
    const s = read(),
      r = s.raid,
      active = s.active;
    const t = performance.now() / 1000,
      dt = Math.min(0.05, engine.getDeltaTime() / 1000);
    const model = active && r ? r.model : s.selected;
    const quality = s.quality ?? "high";
    if (quality !== appliedQuality) {
      engine.setHardwareScalingLevel(
        quality === "low" ? 1.75 : quality === "standard" ? 1.25 : 1,
      );
      shadow
        .getShadowMap()
        ?.resize(
          quality === "low" ? 512 : quality === "standard" ? 1024 : 2048,
        );
      pipe.bloomEnabled = quality !== "low";
      appliedQuality = quality;
    }
    if (s.world) {
      const counts = s.world.merchants.map((m) =>
        Math.min(9, m.stock.length + Math.ceil(m.parts / 8)),
      );
      const signature = counts.join(":");
      if (signature !== lastEconomy) {
        stockCases.forEach((cases, i) =>
          cases.forEach((item, slot) => item.setEnabled(slot < counts[i])),
        );
        lastEconomy = signature;
      }
    }
    if (t - lastMetrics > 1) {
      window.dispatchEvent(
        new CustomEvent("aftermarket:performance", {
          detail: {
            fps: Math.round(engine.getFps()),
            meshes: scene.getActiveMeshes().length,
            quality,
          },
        }),
      );
      lastMetrics = t;
    }
    audio.mute(!!s.muted);
    if (model !== currentModel) {
      gunRoot.dispose(false, false);
      gunRoot = gunMesh(weapon, model);
      currentModel = model;
    }
    if (active && r) {
      player.position.x += (r.x - player.position.x) * Math.min(1, dt * 18);
      player.position.z += (r.z - player.position.z) * Math.min(1, dt * 18);
      player.rotation.y = yaw;
      player.setEnabled(true);
      const moving = Math.hypot(r.x - lastX, r.z - lastZ) > 0.005;
      avatar.play(
        moving
          ? "Run_Gun"
          : r.lastShot > Date.now() - 250
            ? "Idle_Shoot"
            : "Idle",
      );
      if (moving && t - lastStep > 0.34) {
        audio.step();
        lastStep = t;
      }
      if (r.reloadUntil && r.reloadUntil !== lastReload) {
        audio.reload();
        lastReload = r.reloadUntil;
      }
      if (lastRaid !== r.id) {
        for (const root of enemyRoots.values()) root.dispose();
        enemyRoots.clear();
        for (const anim of enemyAnimations.values()) anim.dispose();
        enemyAnimations.clear();
        for (const m of crateMeshes.values()) m.dispose();
        crateMeshes.clear();
        tracers.forEach((v) => v.mesh.dispose());
        tracers.clear();
        lastRaid = r.id;
        yaw = r.yaw;
      }
      lastX = r.x;
      lastZ = r.z;
      const aim = player.position.add(new Vector3(0.6, 1.65, 0));
      const offset = new Vector3(
        -Math.sin(yaw) * 4.4 + Math.cos(yaw) * 0.65,
        1.9 + pitch * 4.5,
        -Math.cos(yaw) * 4.4 - Math.sin(yaw) * 0.65,
      );
      let desired = player.position.add(offset);
      const ray = new Ray(
        aim,
        desired.subtract(aim).normalize(),
        Vector3.Distance(aim, desired),
      );
      const hit = scene.pickWithRay(
        ray,
        (m) =>
          m.name === "container" || m.name === "warehouse" || m.name === "wall",
      );
      if (hit?.hit && hit.pickedPoint)
        desired = hit.pickedPoint.add(
          aim.subtract(hit.pickedPoint).normalize().scale(0.3),
        );
      camera.position = Vector3.Lerp(
        camera.position,
        desired,
        Math.min(1, dt * 12),
      );
      camera.setTarget(
        player.position.add(
          new Vector3(Math.sin(yaw) * 16, 1.5 - pitch * 14, Math.cos(yaw) * 16),
        ),
      );
      for (const e of r.enemies) {
        let root = enemyRoots.get(e.id);
        if (!root) {
          root = new TransformNode(e.id, scene);
          const backup = new TransformNode("enemy fallback", scene);
          backup.parent = root;
          human(backup, e.gunId ? "#a3885c" : "#4b635f");
          enemyAnimations.set(
            e.id,
            makeCharacter(root, e.id, e.gunId ? "#a3885c" : "#4b635f", () =>
              backup.setEnabled(false),
            ),
          );
          const held = new TransformNode("enemy gun", scene);
          held.parent = root;
          held.position.set(0.28, 1.3, 0.3);
          gunMesh(held, e.model);
          enemyRoots.set(e.id, root);
        }
        root.setEnabled(true);
        root.position.x += (e.x - root.position.x) * Math.min(1, dt * 12);
        root.position.z += (e.z - root.position.z) * Math.min(1, dt * 12);
        root.rotation.y = e.yaw;
        enemyAnimations
          .get(e.id)
          ?.play(
            e.hp <= 0
              ? "Death"
              : e.state === "PURSUE" || e.state === "PATROL"
                ? "Run_Gun"
                : e.lastShot > Date.now() - 300
                  ? "Idle_Shoot"
                  : "Idle",
          );
      }
      for (const c of r.crates) {
        let m = crateMeshes.get(c.id);
        if (!m) {
          m = box(
            "loot",
            c.x,
            0.4,
            c.z,
            0.8,
            0.7,
            0.6,
            mat(c.type === "gun" ? "#c59b56" : "#537c6d", 0.5, 0.4),
          );
          crateMeshes.set(c.id, m);
          const latch = box(
            "latch",
            0,
            0.25,
            -0.31,
            0.2,
            0.12,
            0.03,
            mat("#d0b67a", 0.8),
            false,
          );
          latch.parent = m;
        }
        m.setEnabled(!c.taken);
      }
      for (const shot of r.shots) {
        if (tracers.has(shot.id)) continue;
        const shotAge = Date.now() - (shot.at ?? shot.id);
        if (shotAge < 0 || shotAge > 500) continue;
        audio.shot(shot.enemy, Math.hypot(shot.x - r.x, shot.z - r.z));
        const m = MeshBuilder.CreateLines(
          "tracer",
          {
            points: [
              new Vector3(shot.x, 1.35, shot.z),
              new Vector3(shot.tx, 1.35, shot.tz),
            ],
          },
          scene,
        );
        m.color = Color3.FromHexString(shot.enemy ? "#d39b68" : "#f8dfa0");
        tracers.set(shot.id, { mesh: m, at: t });
      }
    } else {
      player.setEnabled(false);
      for (const e of enemyRoots.values()) e.setEnabled(false);
      for (const m of crateMeshes.values()) m.setEnabled(false);
      const desired =
        s.panel === "landing"
          ? new Vector3(6 + Math.sin(t * 0.06) * 2, 3.9, -17)
          : new Vector3(3, 3.1, -13);
      camera.position = Vector3.Lerp(camera.position, desired, dt * 2);
      camera.setTarget(new Vector3(-7.5, 2.1, 10));
    }
    for (const [id, v] of tracers)
      if (t - v.at > 0.09) {
        v.mesh.dispose();
        if (t - v.at > 2) tracers.delete(id);
      }
    scene.render();
  }
  engine.runRenderLoop(frame);
  const resize = () => engine.resize();
  window.addEventListener("resize", resize);
  onReady();
  return {
    connect(ws: WebSocket) {
      socket = ws;
    },
    reset() {
      yaw = 0;
      pitch = 0.12;
      seq = 0;
      player.position.set(0, 0, -11);
      for (const e of enemyRoots.values()) e.dispose();
      enemyRoots.clear();
      enemyAnimations.forEach((a) => a.dispose());
      enemyAnimations.clear();
      for (const m of crateMeshes.values()) m.dispose();
      crateMeshes.clear();
    },
    dispose() {
      clearInterval(interval);
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("mousemove", move);
      canvas.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("resize", resize);
      window.removeEventListener("blur", blur);
      avatar.dispose();
      enemyAnimations.forEach((a) => a.dispose());
      audio.dispose();
      engine.dispose();
    },
  };
}
