import {
  LoadAssetContainerAsync,
  PBRMaterial,
  Color3,
  Vector3,
  TransformNode,
  type Scene,
  type AnimationGroup,
  type ShadowGenerator,
} from "@babylonjs/core";
import "@babylonjs/loaders/glTF";

export function characterFactory(scene: Scene, shadow: ShadowGenerator) {
  const asset = LoadAssetContainerAsync("/assets/soldier.glb", scene);
  return (
    parent: TransformNode,
    name: string,
    tint: string,
    onLoaded?: () => void,
  ) => {
    let clips: AnimationGroup[] = [],
      active = "",
      wanted = "Idle",
      disposed = false;
    const play = (clip: string) => {
      wanted = clip;
      if (clip === active || !clips.length) return;
      const next = clips.find((g) => g.name.endsWith(clip));
      if (!next) return;
      clips.forEach((g) => g.stop());
      next.start(clip !== "Death", clip === "Run_Gun" ? 1.15 : 1);
      active = clip;
    };
    asset
      .then((container) => {
        if (disposed || scene.isDisposed || parent.isDisposed()) return;
        const instance = container.instantiateModelsToScene(
          (n) => `${name}-${n}`,
          true,
          { doNotInstantiate: true },
        );
        const pivot = new TransformNode(`${name}-model`, scene);
        instance.rootNodes.forEach((n) => (n.parent = pivot));
        pivot.computeWorldMatrix(true);
        const bounds = pivot.getHierarchyBoundingVectors(true);
        const height = Math.max(0.01, bounds.max.y - bounds.min.y),
          scale = 1.82 / height;
        const center = bounds.min.add(bounds.max).scale(0.5);
        pivot.scaling.setAll(scale);
        pivot.position.set(
          -center.x * scale,
          -bounds.min.y * scale,
          -center.z * scale,
        );
        pivot.parent = parent;
        pivot.getChildMeshes().forEach((mesh) => {
          mesh.receiveShadows = true;
          shadow.addShadowCaster(mesh);
          if (mesh.material instanceof PBRMaterial) {
            mesh.material.maxSimultaneousLights = 4;
            mesh.material.albedoColor = Color3.Lerp(
              mesh.material.albedoColor,
              Color3.FromHexString(tint),
              0.25,
            );
          }
        });
        clips = instance.animationGroups;
        clips.forEach((g) => g.stop());
        play(wanted);
        onLoaded?.();
      })
      .catch((error) =>
        console.warn(
          "Character asset could not load; using the fallback.",
          error,
        ),
      );
    return {
      play,
      dispose() {
        disposed = true;
        clips.forEach((g) => g.dispose());
      },
    };
  };
}
