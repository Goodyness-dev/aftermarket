# AFTERMARKET asset credits

These are downloaded 3D/PBR source assets for the playable prototype. The character is a temporary animated human reference, not a finished AFTERMARKET soldier. No generated concept image is being presented as a rigged game asset.

## Character — Cesium Man

- Local file: `public/assets/character.glb` (438,044 bytes).
- Creator/copyright: © 2017 Cesium.
- Source: [Khronos glTF Sample Assets — CesiumMan](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CesiumMan).
- Download: [Official GLB](https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CesiumMan/glTF-Binary/CesiumMan.glb).
- License: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
- Source license/credit description is preserved at `public/assets/CHARACTER-LICENSE.md`; the incorporated Cesium mark has separate terms preserved at `public/assets/CESIUM-TRADEMARK.txt`.
- Downloaded asset itself is unmodified. Runtime material overrides, duplication, rescaling, and animation playback are prototype presentation changes and do not imply endorsement by Cesium or Khronos.
- Implementation: single skinned mesh, one unnamed walking animation (approximately 0.0417–2 seconds). Use the first animation group rather than looking up `Walk` or `Idle`; pause it for idle. No authored reload, shooting, death, or idle clips are included.
- Coordinate system: glTF hierarchy contains its own Z-up conversion. Preserve that hierarchy; do not apply another X-axis conversion. Normalize the computed world bounds to the desired human height (suggested 1.8m). Raw vertex position bounds before root conversion are approximately 0.312m × 1.138m × 1.507m; authored roots supply the required orientation.
- Visual limitation: generic test human with branded source suit; a coherent original/licensed clothed soldier asset and full action animation set remain art dependencies. A neutral runtime material can replace the source suit texture while retaining the attribution.

## Concrete Floor 02

- Creator: Rob Tuytel / Poly Haven.
- Source: https://polyhaven.com/a/concrete_floor_02
- License: CC0 1.0, per [Poly Haven asset license](https://polyhaven.com/license).
- Files: `concrete-color.jpg`, `concrete-normal.jpg`, `concrete-arm.jpg` under `public/assets/`.
- Resolution: 1K JPEG maps. Color uses sRGB; normal and ARM are linear. Normal is OpenGL orientation. ARM channels are occlusion (R), roughness (G), metallic (B).
- Source downloads: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/concrete_floor_02/concrete_floor_02_{diff,nor_gl,arm}_1k.jpg`.

## Corrugated Iron

- Creators: Dimitrios Savva (photography), Jenelle van Heerden (processing) / Poly Haven.
- Source: https://polyhaven.com/a/corrugated_iron
- License: CC0 1.0, per [Poly Haven asset license](https://polyhaven.com/license).
- Files: `metal-color.jpg`, `metal-normal.jpg`, `metal-arm.jpg` under `public/assets/`.
- Resolution: 1K JPEG maps, with the same color space/channel conventions as above.
- Source downloads: `https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/corrugated_iron/corrugated_iron_{diff,nor_gl,arm}_1k.jpg`.

## Industrial Sunset HDRI

- Creator: Sergej Majboroda / Poly Haven.
- Source: https://polyhaven.com/a/industrial_sunset
- License: CC0 1.0, per [Poly Haven asset license](https://polyhaven.com/license).
- Local file: `public/assets/industrial-sunset.hdr` (1,640,864 bytes).
- Download: https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/industrial_sunset_1k.hdr
- A genuine 1K equirectangular HDR lighting asset. Load through Babylon HDRCubeTexture for environment lighting; optionally use a skybox. An HDRI is not a playable environment.

## Barlow and Barlow Condensed fonts

- Designer: Jeremy Tribby / Barlow Project Authors.
- Source: official Google Fonts CSS and font binaries served by `fonts.googleapis.com` / `fonts.gstatic.com`.
- Families/weights: Barlow 400, 500, 600, 700; Barlow Condensed 500, 600, 700. Normal style, TTF format.
- Local stylesheet: `public/assets/fonts/fonts.css`, using only local URLs and `font-display: swap`.
- License: SIL Open Font License 1.1. Preserved at `public/assets/fonts/OFL-Barlow.txt` and `public/assets/fonts/OFL-BarlowCondensed.txt`.
- License source: [google/fonts Barlow](https://github.com/google/fonts/tree/main/ofl/barlow) and [Barlow Condensed](https://github.com/google/fonts/tree/main/ofl/barlowcondensed).
- Binaries are unmodified. No Google Fonts network request is needed to display these local fonts.

## Quaternius soldier and rifle — improved prototype assets

- Creator: Quaternius (Tomás Laulhé).
- License: CC0 1.0, verified on the creator's official pack pages and individual Poly Pizza model pages on 14 November 2026. Sources and modification notes are preserved at `public/assets/QUATERNIUS-LICENSE.md`.
- Soldier: `public/assets/soldier.glb`, from [Toon Shooter Game Kit](https://quaternius.com/packs/toonshootergamekit.html), [individual model](https://poly.pizza/m/PpLF4rt4ah). A clothed, helmeted, stylized human with one skin and authored animation clips.
- Soldier changes: removed mesh references for the built-in alternate weapons (which otherwise overlap in one hand), preserved their transform nodes, and simplified animation names by removing the source prefix. Unused source geometry remains embedded; no animation retargeting or new animation was invented.
- Clips: `Death`, `Duck`, `HitReact`, `Idle`, `Idle_Shoot`, `Jump`, `Jump_Idle`, `Jump_Land`, `No`, `Punch`, `Run`, `Run_Gun`, `Wave`, `Yes`. No separate Walk or Reload clip. Slower Run playback may be used for walking as an explicit approximation.
- Preserve glTF root conversion and normalize computed world height to the game's desired human scale. `AK` and `Pistol` transform nodes remain under `Index1.R` for possible attachment; verify gun orientation visually before use.
- Rifle: `public/assets/rifle.glb`, [Ultimate Guns Pack](https://quaternius.com/packs/ultimategun.html), [individual model](https://poly.pizza/m/K2lXTYFSLC). Unmodified GLB, 74,028 bytes, five material primitives, approximately 1,304 triangles. No animation, external buffer, or Draco dependency.
- These improve the playable placeholder silhouette and animation coverage; they do not satisfy the final realistic-character/weapon art requirement.

## Distribution notes

All files are local to avoid depending on third-party asset hosts at runtime. Preserve this credits file and all included license/trademark notices in source distribution, and expose appropriate attribution in the game's Credits/About view. The Cesium asset remains available as an earlier reference; Quaternius soldier is the recommended playable prototype replacement.
