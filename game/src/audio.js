// Neon Bay sound: everything is synthesized live with WebAudio — no audio
// files, no network. Engine hum follows the car's speed, a two-tone siren
// wails while the wanted level is up, and a quiet synthwave loop (bass +
// pad + arp over Am–F–C–G) runs underneath. One-shots: gunshot, pickup /
// mission chimes, UI click. The context is only created on the first user
// gesture, so a plain load or a headless ?shot= scene never touches audio.
const MUTE_KEY = 'NEONBAY_MUTE_V1';

// 100 BPM, eighth-note grid. Chords are Am, F, C, G — one bar each.
const BPM = 100;
const EIGHTH = 60 / BPM / 2;
const CHORDS = [
  { root: 55.00, tones: [220.00, 261.63, 329.63] }, // Am
  { root: 43.65, tones: [174.61, 220.00, 261.63] }, // F
  { root: 65.41, tones: [196.00, 261.63, 329.63] }, // C
  { root: 49.00, tones: [196.00, 246.94, 293.66] }, // G
];

function note(freq, at, dur, type, gain, dest, filterFreq) {
  const ctx = dest.context;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, at);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  let head = osc;
  if (filterFreq) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    osc.connect(f);
    head = f;
  }
  head.connect(g);
  g.connect(dest);
  osc.start(at);
  osc.stop(at + dur + 0.05);
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicBus = null;
  let engineOsc = null;
  let engineFilter = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  try {
    muted = window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    muted = false;
  }
  // music sequencer state
  let nextStepAt = 0;
  let step = 0;

  function buildGraph() {
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);

    // engine: a sawtooth through a lowpass, pitch + loudness follow speed
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();

    // siren: triangle at ~825 Hz, a square LFO swings it +/-125 Hz twice
    // a second so it wails; gain is 0 until the wanted level rises
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 825;
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 125;
    lfo.connect(lfoGain);
    lfoGain.connect(sirenOsc.frequency);
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    lfo.start();

    musicBus = ctx.createGain();
    musicBus.gain.value = 0.5;
    musicBus.connect(master);
    nextStepAt = ctx.currentTime + 0.1;
    step = 0;
  }

  /** Create / resume the context. Call from a click or keypress. */
  function unlock() {
    try {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        buildGraph();
      }
      if (ctx.state === 'suspended') void ctx.resume();
    } catch {
      // Audio is decoration: never let it break the game.
    }
  }

  function setMuted(m) {
    muted = !!m;
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // ignore
    }
    if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.05);
    return muted;
  }

  /** Schedule the music a step ahead; called every frame while playing. */
  function scheduleMusic() {
    if (!ctx || !musicBus) return;
    while (nextStepAt < ctx.currentTime + 0.25) {
      const bar = Math.floor(step / 8) % CHORDS.length;
      const chord = CHORDS[bar];
      const inBar = step % 8;
      // bass: root on every eighth, octave hop on the off-beats
      const bassFreq = inBar % 2 === 1 ? chord.root * 2 : chord.root;
      note(bassFreq, nextStepAt, EIGHTH * 0.95, 'sawtooth', 0.055, musicBus, 420);
      // pad: the chord tones, once per bar, soft and long
      if (inBar === 0) {
        for (const t of chord.tones) note(t, nextStepAt, EIGHTH * 8, 'triangle', 0.018, musicBus);
      }
      // arp: a quiet 16th-note sparkle on the top two tones
      if (inBar % 2 === 0) {
        note(chord.tones[2], nextStepAt, EIGHTH * 0.45, 'square', 0.012, musicBus, 2400);
      }
      nextStepAt += EIGHTH;
      step += 1;
    }
  }

  return {
    get muted() { return muted; },
    get ready() { return !!ctx; },
    get ctxState() { return ctx ? ctx.state : 'none'; },
    /** Test hook: live node levels, for the headless smoke test. */
    snapshot() {
      return {
        ready: !!ctx,
        ctxState: ctx ? ctx.state : 'none',
        muted,
        engineGain: engineGain ? +engineGain.gain.value.toFixed(4) : 0,
        sirenGain: sirenGain ? +sirenGain.gain.value.toFixed(4) : 0,
        musicStep: step,
      };
    },
    unlock,
    setMuted,
    toggleMuted() { return setMuted(!muted); },

    /**
     * Per-frame: engine follows the car, siren follows the wanted level,
     * music keeps its step. No-ops until unlock() has run.
     */
    update(_dt, { speedKmh, wanted, driving }) {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      const speed = Math.max(0, speedKmh || 0);
      const engineLevel = driving ? Math.min(0.085, 0.02 + speed * 0.00045) : 0;
      engineGain.gain.setTargetAtTime(engineLevel, t, 0.08);
      engineOsc.frequency.setTargetAtTime(48 + speed * 1.15, t, 0.08);
      engineFilter.frequency.setTargetAtTime(280 + speed * 9, t, 0.1);
      const sirenLevel = wanted > 0 ? 0.012 + wanted * 0.006 : 0;
      sirenGain.gain.setTargetAtTime(sirenLevel, t, 0.4);
      scheduleMusic();
    },

    /** A gunshot: a short noise burst plus a low thump. */
    shot() {
      if (!ctx || ctx.state !== 'running') return;
      try {
        const t = ctx.currentTime;
        const len = Math.floor(ctx.sampleRate * 0.12);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900;
        bp.Q.value = 0.7;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        src.connect(bp);
        bp.connect(g);
        g.connect(master);
        src.start(t);
        note(70, t, 0.12, 'sine', 0.35, master);
      } catch {
        // ignore
      }
    },

    /** UI click: one short blip. */
    click() {
      if (!ctx || ctx.state !== 'running') return;
      note(660, ctx.currentTime, 0.07, 'square', 0.05, master, 3000);
    },

    /** Chimes: 'pickup' (two notes), 'mission' (intro), 'complete' (arp up), 'fail' (down). */
    chime(kind) {
      if (!ctx || ctx.state !== 'running') return;
      const t = ctx.currentTime;
      if (kind === 'complete') {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(f, t + i * 0.09, 0.35, 'triangle', 0.09, master));
      } else if (kind === 'fail') {
        [392.0, 329.63, 261.63].forEach((f, i) => note(f, t + i * 0.12, 0.3, 'triangle', 0.07, master));
      } else if (kind === 'mission') {
        [440.0, 554.37].forEach((f, i) => note(f, t + i * 0.1, 0.3, 'triangle', 0.08, master));
      } else {
        [880.0, 1174.66].forEach((f, i) => note(f, t + i * 0.08, 0.22, 'sine', 0.09, master));
      }
    },
  };
}
