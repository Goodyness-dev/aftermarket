# AFTERMARKET — Visual Direction

Status: approved ambition, proposed art direction. This is an implementation brief, not a claim of completed graphics. Working title remains subject to the team's choice.

## Creative decision

Modern, grounded, cinematic 3D. A fictional coastal trading city after a prolonged infrastructure crisis. The playable district is a container port and the dense repair market beside it. Third-person shooting, detailed weapon inspection, believable people, and a world whose changing economy is visible in its streets.

The user's GTA VI reference sets an ambition for believable environments, strong lighting, character presence, and presentation. Matching the production scale and fidelity of a major studio release is not a credible hackathon commitment. Our deliverable is a small, richly composed playable district with consistent materials, convincing lighting, responsive animation, and one exceptional market hub.

This direction supersedes the earlier pixel-art/top-down presentation in MASTER_GAME_DESIGN.md. Preserve its compact raid structure and economy; change the visual delivery to third-person 3D.

## The visual identity: a coastal port after the rain

Working location name: Duskport. West African coastal architecture and commercial street life inspire an original fictional place: concrete shopfronts, shaded arcades, painted metal shutters, corrugated roofs, dense cabling, roadside repair benches, and heavy port machinery. Infrastructure, ordinary work, and small businesses give the setting specificity. People have individual occupations, backgrounds, and personal spaces.

The opening takes place just after tropical rain, in the final light before sunset. The sky retains a warm band above the cranes. Cool shadows collect below market awnings. Practical work lamps illuminate tools, fabric, and worn metal. Water sits in believable depressions, with restrained reflections and ripples from footsteps.

The world should feel inhabited and economically active. Deliveries arrive; people repair equipment; empty shelving reveals shortages; spent packing material gathers around a successful dealer. Avoid decorating every surface with equal dirt, every corner with neon, or every character with tactical armor.

## Five visual rules

1. **A strong silhouette before surface detail.** Cranes, roofs, characters, and weapons should read at gameplay distance.
2. **Light has a visible source.** The sun, floodlights, shop bulbs, generators, muzzle flashes, and vehicle lamps explain the illumination.
3. **Materials tell a consistent story.** Sun-bleached paint, worn grip rubber, scratched blued steel, damp concrete, and repaired canvas age differently.
4. **The economy changes the environment.** Stock, completed repairs, deliveries, and faction equipment reflect actual game state.
5. **Readability survives atmosphere.** Smoke, rain, bloom, darkness, camera motion, and clutter never conceal essential combat information.

## Camera and composition

Use an over-the-shoulder camera with smooth collision avoidance and optional shoulder switching. Aim framing tightens gently; movement remains responsive. Begin camera tuning around a moderate third-person field of view, with a user adjustment range. Validate camera offset, perspective, and cover visibility in the greybox before detailed art.

Use three complementary views:

- Combat: stable shoulder camera, legible sightline, minimal shake, no cinematic depth of field obscuring enemies.
- Hub: wider framing that reveals people, stock, and the player's character. Approaching a merchant naturally frames their counter.
- Inspection: controlled close-up of the actual weapon asset, with orbit, zoom, legible markings, and soft workshop lighting. This is where material fidelity gets its most concentrated showcase.

Camera collision must work in stalls, doorways, stairwells, and against cover. A cinematic opening can last 5–8 seconds and must be skippable. Its final shot must match the playable scene.

## Environment plan

### The Exchange: hero hub

A former customs warehouse converted into a neutral market. A broad central aisle leads to a large illuminated district map. Merchant workspaces branch from it. Tall windows admit the last sunlight; localized fixtures give each business its own identity.

Mara's counter has carefully ordered weapons, numbered storage drawers, sales receipts, and lockable cases. Ivo's workshop has stripped components, repair trays, a vise, an inspection lamp, and queued jobs. Sable's stall uses stacked supply cases, tally cards, shipping labels, and a small dispatch radio.

The hub earns visual density through repeated useful props and credible organization. Characters touch counters and tools with plausible animation. Prioritize three convincing merchants over a crowd of poorly animated extras.

### Freight Nine: first raid district

One connected route through a warehouse, freight lane, workshop yard, and extraction checkpoint. Use a compact navigable space with a larger distant port skyline. The backdrop creates scale without promising accessible areas.

Landmarks: an orange gantry crane, a damaged blue customs arch, and a lit water tower. Give each section a distinct outline and accent so players navigate without constantly reading a minimap. Alternate open lanes, interior cover, and flank routes. Build sightlines and enemy contrast into the geometry.

Use a modular kit: concrete walls, shuttered doors, containers, roof panels, stairs, railings, drains, cables, crates, and workshop furniture. Scatter props selectively; keep critical routes clear of decorative collision.

## Lighting, color, and materials

| Role | Direction | Starting color |
| --- | --- | --- |
| Structural shadows | Blue charcoal | #18252B |
| Painted architecture | Faded limestone | #B9AD96 |
| Industrial identifier | Weathered safety orange | #C96C35 |
| Aged equipment | Muted green | #68786B |
| Workshop practical light | Warm amber | #E8B66D |
| UI primary text | Warm off-white | #EEE8DC |
| Confirmed action | Restrained mint, with icon/text | #8EBEA8 |
| Danger or rejection | Muted vermilion, with icon/text | #D9634C |

Colors are starting points for art tests, not fixed replacements for lighting judgment. Use physically plausible base-color, roughness, metallic, and normal maps. Reserve the sharpest detail for weapons, hands, faces, counters, and nearby cover. Vary roughness so wet concrete, oily tools, and plastic do not share the same shine.

One authored dusk lighting condition is the first release target. Bake or precompute static contributions where supported, and use dynamic lighting sparingly for moving actors and localized effects. Fog should produce depth without filling the scene with opaque haze. Turn off decorative effects when they damage visibility or frame rate.

## Characters and factions

The player is an independent scavenger with practical civilian layers, a modest rig, a backpack, and visibly carried equipment. Their silhouette should read as adaptable and mobile. Equipment upgrades alter visible components consistently.

Two initial factions use separate shapes and materials as well as color: one has organized uniforms and standardized gear; the other has mixed protective workwear and repaired equipment. Both need believable roles and individual variation. Identification cannot depend on red versus green.

Merchant faces, posture, clothing, and workspaces communicate personality. Mara is precise and economical in motion. Ivo's hands stay close to the repair bench. Sable frequently checks stock and dispatch information. Avoid dialogue animations that stop the entire world.

Initial animation requirements: idle, walk, jog, aim locomotion, fire, reload, equip, hit reaction, death, interact, and extraction. Grounded foot contact, hand alignment, and smooth transitions matter more than adding numerous gestures. Recoil and animation must match the actual gameplay timing.

## Weapons as the visual centerpiece

Three original fictional weapon families share a coherent manufacturing language. Each receives a strong silhouette, correct scale relative to hands, distinct reload behavior, sound, recoil feel, and detailed close-up materials.

Every unique gun has a serial marking and a readable condition state. Use condition-driven material variation: finish wear, grip damage, repaired sections, and accumulated marks. Do not randomize expensive unique textures for every item; use reusable masks and bounded variations.

The same asset and identity follow the gun through stash, merchant display, faction loadout, battlefield loot, and inspection. A familiar repaired grip or serial label helps the player recognize the rifle they sold earlier. History belongs in the inspection panel; avoid permanently covering the battlefield in floating item labels.

## Make trading feel physical and important

Open trade by approaching a counter. Place the selected weapon into a close-up inspection composition. Keep a concise inventory panel beside it, with dealer stock and available money visible. Show condition, current bid, repair estimate, and the reason for the quote.

The trade flow should be quick: choose item, compare available actions, confirm, receive an authoritative result. A short placement animation and receipt sound add weight without blocking repeated transactions. Multi-item selection and keyboard controls remain available.

Actual settlement drives the visual result. While pending, show a clear reserved/pending state. Only confirmed trades remove owned inventory and change dealer stock. Failure returns a specific explanation and preserves the player's ability to retry safely.

### Economy state expressed in the world

| Actual state | Visible consequence |
| --- | --- |
| Dealer stock depleted | Empty designated shelf positions and an updated order board |
| Repair backlog increases | More labeled job trays, capped to a manageable visual count |
| Shipment completes | Cases appear in a receiving area and the trader's stock updates |
| Merchant cannot buy | Purchase service changes to unavailable, with a clear reason |
| Faction buys rifles | A later authorized squad visibly carries those assigned weapons |
| Scarcity eases | Quote and stock indicators change together, with a short explanation |

Map aggregate quantities to bounded prop states. Five visible cases may represent a larger inventory; the quantity label remains authoritative. Set dressing must not imply that a transaction completed when it did not.

## Interface direction

An understated industrial interface: confident typography, restrained framing, subtle surface texture, and strong alignment. Navigation belongs to the game: Raid, Stash, Market, Workshop, Contracts. Avoid a financial-dashboard home screen.

During combat, display ammunition, health, extraction status, and contextual interaction prompts. Show the value at risk before deployment and in the inventory; avoid distracting price tickers during combat.

Use one readable sans-serif family and tabular numbers for money and quantities. Keep decorative condensed lettering to large labels. Establish type sizes at 1080p, provide UI scaling, and test at 720p. Text sits on surfaces with sufficient contrast. Color is accompanied by text, shape, or icons.

Market layout: player stock on the left, selected weapon in the center, merchant offer and actions on the right. At narrow widths, switch to tabs without shrinking everything. A receipt shows goods, quantity, unit price, fee, final total, and confirmation state. Ownership history appears as a short timeline with an optional verified transaction link.

Menus use short, consistent transitions. Reduced-motion mode removes camera sweeps and decorative movement. Shake, blur, flashes, and subtitles have individual controls. No essential information is communicated only through sound.

## Sound and effects

Layer distant port machinery, market conversation, workshop sounds, rain drips, and faction activity. Interior and exterior gunfire should sound different. Enemy and player firing need spatial clarity. Musical intensity supports danger without overwhelming audible threats.

Use restrained muzzle flashes, material-specific impacts, brief dust bursts, and persistent marks within bounded budgets. Recoil is readable; excessive shake and screen blur reduce responsiveness. Successful extraction should deliver a satisfying release in sound and composition, then move quickly into the loot decision.

## Three hero moments

1. **Arrival:** the player passes under a wet market awning; the Exchange opens ahead, with merchants working beneath warm lamps and port cranes beyond the windows.
2. **The sale:** a worn rifle rotates under an inspection light; its serial and previous owner are visible. A confirmed sale updates the dealer's available stock and produces a concise receipt.
3. **The return:** after a later encounter, inspection reveals the same rifle on a defeated faction carrier. Its recognizable wear and new history make the economy tangible.

These must be captured from the running game. Concept art and offline renders may guide production but must not be presented as playable footage.

## Asset and implementation plan

Create a small style sheet and one environment lighting test before producing many assets. Then build the greybox with the real camera and controls. Verify movement, cover, enemy visibility, and extraction before environmental detail.

Use licensed, coherent modular assets where they accelerate delivery. Keep an asset register with source, license, attribution requirements, texture scale, and modifications. Prefer a consistent kit over a collection of unrelated high-detail assets. Original merchant identity, signage, materials, and composition provide the game's own character.

Generated imagery can supply mood exploration or selected textures after review. It does not automatically provide a rigged character, a usable 3D model, or a consistent set of gameplay animations. Hero assets require appropriate geometry, materials, and animation integration.

The chosen runtime must prove third-person controls, animation, skinned models, lighting, and stable deployment in a greybox test before expensive art work. This document does not claim an engine or renderer has already been selected or benchmarked.

## Performance and quality gates

Target 1080p at 60 FPS on a declared reference machine, with a 720p/30 FPS low preset. These are acceptance targets, not measured results. Name the actual test hardware in the README. If browser delivery is selected, measure load time, memory, shader compilation, and frame-time spikes there.

Use compressed textures, LODs, instancing, bounded effects, limited shadow-casting lights, and occlusion appropriate to the runtime. A low preset reduces shadows, reflections, particles, and background detail while preserving enemy visibility and UI readability.

Required checks:

- The hub, a combat lane, and weapon inspection look coherent in actual runtime screenshots.
- Characters do not float, hands align with guns, and reload timing agrees with ammunition state.
- Enemies remain recognizable against both bright and shadowed environments.
- Camera collision works through all intended routes; aiming and shots agree near cover.
- Menus and purchase confirmation work with keyboard and mouse at supported resolutions.
- The scene remains responsive during the busiest intended encounter and market transition.
- Every visible economic change agrees with authoritative state.
- The three hero moments can be reproduced without manual editing or misleading footage.

## Delivery priorities

First: responsive third-person controls and camera; one complete combat route; convincing lighting; detailed weapon inspection; a coherent market counter; clear trade feedback.

Next: polished player animation, distinct merchants, economic changes in the environment, spatial sound, and the serial-number return sequence.

Later: expansive city blocks, drivable vehicles, crowds, dynamic weather, a full day/night cycle, extensive facial acting, and cinematic missions. The first demo earns its visual impact through one excellent district and complete interactions.

## One-sentence art brief

A grounded modern extraction shooter set in a rain-soaked coastal port at dusk, where warm repair markets meet cold industrial battlefields and every worn weapon has an owner, a price, and a history.
