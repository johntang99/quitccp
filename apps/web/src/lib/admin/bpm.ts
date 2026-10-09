/**
 * Measures a track's tempo in the browser.
 *
 * BPM exists here for one narrow reason: when the music is shorter than the
 * film it has to be looped, and a loop that is cut on a beat is inaudible
 * while one cut anywhere else is a stumble. So the number is real work -- but
 * it is work nobody should have to do by ear, and most people have never heard
 * the term. Hence measuring it.
 *
 * It runs on Web Audio rather than ffmpeg on purpose. Everything else in the
 * render path needs a machine with ffmpeg, which is why 出片 is local-only;
 * choosing music is not that kind of task, and an editor on the live site
 * should not be blocked from it. Storage sends `access-control-allow-origin:
 * *`, so the page can fetch the file and decode it itself.
 *
 * The method is the standard one: an onset-strength envelope, then a comb
 * filter swept across plausible tempi, the beat and its first three harmonics
 * summed so that a waltz does not read as twice its speed. Checked against
 * synthetic click tracks at 90, 115.4, 118, 128 and 140 BPM -- every one came
 * back within 0.3 -- and against speech and silence, which must *not* produce
 * a confident answer and do not.
 */

const RATE = 22050;
const HOP = 256;
const WINDOW = 1024;
const ENV_RATE = RATE / HOP;
const MIN_BPM = 70;
const MAX_BPM = 180;

/** Above this the peak is a real pulse; below it the track has no steady beat. */
const CONFIDENT = 5;

export interface MusicInfo {
  /** Whole-track length in seconds. */
  duration: number;
  bpm: number;
  /** How far the winning tempo stands out, in standard deviations. */
  strength: number;
  confident: boolean;
}

/** Biggest file worth pulling into memory to measure. */
export const MAX_ANALYSE_BYTES = 80 * 1024 * 1024;

/**
 * Rise in log energy, frame to frame, with slow drift removed.
 *
 * Log energy rather than raw: a chorus is louder than a verse, and without the
 * log the loud half of the track would dominate the correlation. The local
 * mean subtraction does the same job over shorter spans.
 */
function onsetEnvelope(x: Float32Array): Float64Array {
  const frames = Math.floor((x.length - WINDOW) / HOP);
  if (frames < 1) return new Float64Array(0);
  const raw = new Float64Array(frames);
  let prev = -12;
  for (let i = 0; i < frames; i += 1) {
    let energy = 0;
    const start = i * HOP;
    for (let j = 0; j < WINDOW; j += 1) {
      const v = x[start + j];
      energy += v * v;
    }
    const logEnergy = Math.log(energy / WINDOW + 1e-10);
    raw[i] = Math.max(0, logEnergy - prev);
    prev = logEnergy;
  }

  const span = 40;
  const out = new Float64Array(frames);
  for (let i = 0; i < frames; i += 1) {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - span); j < Math.min(frames, i + span); j += 1) {
      sum += raw[j];
      n += 1;
    }
    out[i] = Math.max(0, raw[i] - sum / n);
  }
  return out;
}

/** How well a steady pulse at this tempo explains the envelope. */
function combScore(env: Float64Array, bpm: number): number {
  const period = (60 / bpm) * ENV_RATE;
  let score = 0;
  for (let k = 1; k <= 4; k += 1) {
    const lag = period * k;
    if (lag >= env.length) break;
    const whole = Math.floor(lag);
    const frac = lag - whole;
    let sum = 0;
    for (let i = 0; i + whole + 1 < env.length; i += 1) {
      sum += env[i] * (env[i + whole] * (1 - frac) + env[i + whole + 1] * frac);
    }
    score += sum / (k * (env.length - whole));
  }
  return score;
}

function tempoOf(env: Float64Array): { bpm: number; strength: number } | null {
  if (env.length < 200) return null;

  const scores: number[] = [];
  let best = { bpm: MIN_BPM, score: -Infinity };
  for (let bpm = MIN_BPM; bpm <= MAX_BPM; bpm += 0.25) {
    const score = combScore(env, bpm);
    scores.push(score);
    if (score > best.score) best = { bpm, score };
  }

  let fine = best;
  for (let bpm = best.bpm - 0.5; bpm <= best.bpm + 0.5; bpm += 0.01) {
    const score = combScore(env, bpm);
    if (score > fine.score) fine = { bpm, score };
  }

  /* Peakiness, not height. A click track and a string pad have envelopes
     orders of magnitude apart in energy, so only the shape of the curve can
     be compared between one piece of music and the next. */
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length;
  const sd = Math.sqrt(variance);
  return {
    bpm: Math.round(fine.bpm * 10) / 10,
    strength: sd > 0 ? Math.round(((fine.score - mean) / sd) * 100) / 100 : 0
  };
}

/**
 * Fetch a track, measure its length and its tempo.
 *
 * Only the first 90 seconds are analysed: tempo is a property of the whole
 * piece, and more audio buys precision long after it stops buying correctness.
 * The returned `duration` is still the real one, because that is what decides
 * whether looping happens at all.
 */
export async function measureMusic(url: string, signal?: AbortSignal): Promise<MusicInfo> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`取不到这个文件（${response.status}）`);

  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > MAX_ANALYSE_BYTES) {
    throw new Error("文件太大，没法在浏览器里测节拍");
  }

  const bytes = await response.arrayBuffer();

  const Ctx: typeof AudioContext =
    window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) throw new Error("这个浏览器不支持 Web Audio");

  const ctx = new Ctx();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(bytes);
  } finally {
    void ctx.close();
  }

  const duration = decoded.duration;

  /* Resample to mono 22.05k through an offline graph rather than by hand:
     the browser's resampler is better than a decimation loop, and this is the
     one step where aliasing would smear the onsets we are about to measure. */
  const seconds = Math.min(duration, 90);
  const offline = new OfflineAudioContext(1, Math.ceil(seconds * RATE), RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const mono = (await offline.startRendering()).getChannelData(0);

  const result = tempoOf(onsetEnvelope(mono));
  if (!result) throw new Error("这段音频太短，测不出节拍");

  return {
    duration,
    bpm: result.bpm,
    strength: result.strength,
    confident: result.strength >= CONFIDENT
  };
}
