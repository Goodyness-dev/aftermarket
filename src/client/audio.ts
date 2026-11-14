/** Small synthesized prototype sounds. No third-party recording or autoplay. */
export function createAudio() {
  let ctx: AudioContext | undefined,
    master: GainNode | undefined,
    muted = false;
  function unlock() {
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.2;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
  }
  function tone(freq: number, duration: number, level: number) {
    if (!ctx || !master || muted) return;
    const o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      Math.max(25, freq * 0.3),
      ctx.currentTime + duration,
    );
    g.gain.setValueAtTime(level, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + duration);
  }
  return {
    unlock,
    shot(enemy = false, distance = 0) {
      if (!ctx || !master || muted) return;
      const duration = 0.13,
        buffer = ctx.createBuffer(
          1,
          Math.floor(ctx.sampleRate * duration),
          ctx.sampleRate,
        ),
        data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++)
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (data.length * 0.14));
      const src = ctx.createBufferSource(),
        g = ctx.createGain(),
        filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = enemy ? 900 : 2200;
      g.gain.value = enemy ? Math.max(0.04, 0.6 / (1 + distance * 0.3)) : 1.1;
      src.buffer = buffer;
      src.connect(filter);
      filter.connect(g);
      g.connect(master);
      src.start();
      tone(enemy ? 90 : 135, 0.16, 0.5);
    },
    reload() {
      tone(650, 0.06, 0.3);
    },
    step() {
      tone(80, 0.055, 0.15);
    },
    confirm() {
      tone(550, 0.15, 0.25);
    },
    mute(value: boolean) {
      muted = value;
      if (master && ctx)
        master.gain.setTargetAtTime(value ? 0 : 0.2, ctx.currentTime, 0.03);
    },
    dispose() {
      if (ctx) void ctx.close();
    },
  };
}
