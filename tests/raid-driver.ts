import {
  distance,
  lineBlocked,
  MODELS,
  type Raid,
  type World,
} from "../src/domain/game.js";
import { tick } from "../src/server/engine.js";

// Server-side integration fixture, never exposed as an HTTP endpoint or client
// extraction claim. It supplies ordinary movement/fire inputs to the real engine.
export function driveRecovery(world: World, raid: Raid, tokenId: string) {
  let phase = 0;
  for (let step = 1; step <= 5000 && !raid.finished; step++) {
    const loot = raid.crates.find((c) => c.gun?.id === tokenId && !c.taken);
    if (raid.loot.some((g) => g.id === tokenId) && phase < 2) phase = 2;
    let target =
      phase === 0
        ? { x: -3, z: -4 }
        : phase === 1
          ? (loot ?? { x: -3, z: 18 })
          : phase === 2
            ? { x: -3, z: -4 }
            : { x: 0, z: -12 };
    if (distance(raid, target) < 0.6 && (phase === 0 || phase === 2)) {
      phase++;
      target = phase === 1 ? (loot ?? { x: -3, z: 18 }) : { x: 0, z: -12 };
    }
    const enemy = raid.enemies
      .filter(
        (e) =>
          e.hp > 0 &&
          distance(e, raid) < MODELS[raid.model].range &&
          !lineBlocked(raid, e),
      )
      .sort((a, b) => distance(a, raid) - distance(b, raid))[0];
    const dx = target.x - raid.x,
      dz = target.z - raid.z,
      length = Math.max(1, Math.hypot(dx, dz));
    const yaw = enemy
      ? Math.atan2(enemy.x - raid.x, enemy.z - raid.z)
      : Math.atan2(dx, dz);
    const moving = distance(raid, target) > 0.4;
    tick(
      structuredClone(world),
      raid,
      {
        forward: moving
          ? (dx * Math.sin(yaw) + dz * Math.cos(yaw)) / length
          : 0,
        strafe: moving ? (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / length : 0,
        yaw,
        shoot: !!enemy,
        reload: raid.mag === 0,
        interact: !!loot && distance(raid, loot) < 2.6,
      },
      0.05,
      raid.started + step * 50,
    );
  }
  if (raid.outcome !== "extracted" || !raid.loot.some((g) => g.id === tokenId))
    throw Error(
      `Recovery fixture did not extract ${tokenId}: hp=${raid.hp}, position=${raid.x},${raid.z}, outcome=${raid.outcome}`,
    );
}
