import { useEffect, useRef } from "react";
import {
  Engine,
  Scene,
  ArcRotateCamera,
  Vector3,
  HemisphericLight,
  DirectionalLight,
  HDRCubeTexture,
  PBRMaterial,
  Color3,
  Color4,
  LoadAssetContainerAsync,
  TransformNode,
  MeshBuilder,
  DynamicTexture,
  StandardMaterial,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { MODELS, type Gun } from "../domain/game";

export function WeaponViewer({
  gun,
  onClose,
}: {
  gun: Gun;
  onClose: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const engine = new Engine(canvas.current!, true),
      scene = new Scene(engine);
    scene.clearColor = new Color4(0.055, 0.09, 0.075, 1);
    const camera = new ArcRotateCamera(
      "inspection",
      -0.85,
      1.17,
      1.65,
      Vector3.Zero(),
      scene,
    );
    camera.lowerRadiusLimit = 0.65;
    camera.upperRadiusLimit = 2.6;
    camera.wheelPrecision = 70;
    camera.minZ = 0.01;
    camera.attachControl(canvas.current!, true);
    const ambient = new HemisphericLight(
      "softbox",
      new Vector3(0, 1, 0),
      scene,
    );
    ambient.intensity = 0.85;
    const key = new DirectionalLight("key", new Vector3(-1, -2, 1), scene);
    key.intensity = 2.5;
    key.diffuse = Color3.FromHexString("#e9c994");
    scene.environmentTexture = new HDRCubeTexture(
      "/assets/industrial-sunset.hdr",
      scene,
      128,
    );
    scene.environmentIntensity = 0.7;
    const root = new TransformNode("display", scene);
    if (gun.model === "rifle")
      LoadAssetContainerAsync("/assets/rifle.glb", scene)
        .then((asset) => {
          if (scene.isDisposed) return;
          asset.addAllToScene();
          asset.rootNodes.forEach((n) => (n.parent = root));
          root.computeWorldMatrix(true);
          const b = root.getHierarchyBoundingVectors(true),
            size = b.max.subtract(b.min),
            center = b.max.add(b.min).scale(0.5),
            s = 0.95 / Math.max(size.x, size.y, size.z);
          root.scaling.setAll(s);
          root.position = center.scale(-s);
          root.getChildMeshes().forEach((mesh) => {
            if (mesh.material instanceof PBRMaterial) {
              mesh.material.maxSimultaneousLights = 2;
              mesh.material.roughness = 0.4 + (100 - gun.condition) / 220;
            }
          });
        })
        .catch(() => {});
    else {
      const metal = new PBRMaterial("steel", scene);
      metal.albedoColor = Color3.FromHexString("#50665b");
      metal.metallic = 0.8;
      metal.roughness = 0.35 + (100 - gun.condition) / 200;
      const body = MeshBuilder.CreateBox(
        "receiver",
        {
          width: gun.model === "pistol" ? 0.36 : 0.6,
          height: 0.12,
          depth: 0.08,
        },
        scene,
      );
      body.material = metal;
      const barrel = MeshBuilder.CreateCylinder(
        "barrel",
        { diameter: 0.035, height: 0.26, tessellation: 16 },
        scene,
      );
      barrel.rotation.z = Math.PI / 2;
      barrel.position.x = 0.3;
      barrel.material = metal;
      const grip = MeshBuilder.CreateBox(
        "grip",
        { width: 0.08, height: 0.2, depth: 0.07 },
        scene,
      );
      grip.position.set(-0.06, -0.12, 0);
      grip.rotation.z = -0.2;
      grip.material = metal;
    }
    const plate = MeshBuilder.CreatePlane(
      "serial",
      { width: 0.35, height: 0.07 },
      scene,
    );
    plate.position.set(0, -0.28, 0);
    plate.billboardMode = 7;
    const texture = new DynamicTexture(
      "serial",
      { width: 512, height: 128 },
      scene,
    );
    texture.drawText(
      gun.id,
      20,
      85,
      "bold 60px monospace",
      "#dbcca3",
      "#172820",
      true,
    );
    const material = new StandardMaterial("serial", scene);
    material.diffuseTexture = texture;
    material.disableLighting = true;
    material.emissiveColor = Color3.White();
    plate.material = material;
    engine.runRenderLoop(() => scene.render());
    const resize = () => engine.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      engine.dispose();
    };
  }, [gun.id, gun.model, gun.condition]);
  return (
    <div
      className="modal-backdrop inspection-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Weapon inspection"
    >
      <section>
        <button
          className="close"
          onClick={onClose}
          aria-label="Close inspection"
        >
          ×
        </button>
        <div className="inspection-scene">
          <canvas ref={canvas} />
          <span className="inspection-hint">
            DRAG TO ROTATE / SCROLL TO ZOOM
          </span>
        </div>
        <div className="inspection-details">
          <span className="eyebrow">
            {gun.id} / {gun.condition}% CONDITION
          </span>
          <h2>{MODELS[gun.model].name}</h2>
          <p>
            This is the same weapon identity that moves between your stash, the
            market and faction patrols.
          </p>
          <div className="provenance">
            {gun.history.map((h, i) => (
              <div key={i}>
                <span>○</span>
                <p>
                  <b>{h.who}</b>
                  <small>{h.action}</small>
                </p>
              </div>
            ))}
          </div>
          <small className="tiny-caption">
            LOCAL PRACTICE PROVENANCE / NOT AN ON-CHAIN RECEIPT
          </small>
        </div>
      </section>
    </div>
  );
}
