import type { AudioAnalysis } from '../types';

/**
 * Automatic tempo + beat detection, entirely in the browser.
 *
 * 1. decode the file and low-pass it (bass / kick drum region)
 * 2. build an onset-strength envelope (rise in log energy)
 * 3. tempo = strongest autocorrelation lag between 70 and 180 BPM
 * 4. beats = best grid phase, then every beat snapped to the nearest onset peak
 *    (so slight tempo drift is followed)
 *
 * Beats are reliable for music with a clear pulse (pop, dance). Chorus detection is
 * NOT automatic — sections are marked by hand in the editor.
 */
export async function analyzeAudio(blob: Blob): Promise<AudioAnalysis> {
  const data = await blob.arrayBuffer();
  const tmp = new OfflineAudioContext(1, 1, 44100);
  const audio = await tmp.decodeAudioData(data);
  const sr = audio.sampleRate;

  const off = new OfflineAudioContext(1, audio.length, sr);
  const src = off.createBufferSource();
  src.buffer = audio;
  const lp = off.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 160;
  lp.Q.value = 0.8;
  src.connect(lp).connect(off.destination);
  src.start();
  const low = (await off.startRendering()).getChannelData(0);

  const hop = 512;
  const frames = Math.floor(low.length / hop);
  const env = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let j = 0; j < hop; j++) {
      const v = low[i * hop + j];
      s += v * v;
    }
    env[i] = Math.log(1e-6 + s / hop);
  }
  // onset strength: positive change of energy, smoothed
  const onset = new Float32Array(frames);
  for (let i = 1; i < frames; i++) onset[i] = Math.max(0, env[i] - env[i - 1]);
  const smoothOn = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    let n = 0;
    for (let j = -2; j <= 2; j++) {
      const k = i + j;
      if (k >= 0 && k < frames) {
        s += onset[k] * (3 - Math.abs(j));
        n += 3 - Math.abs(j);
      }
    }
    smoothOn[i] = s / n;
  }
  // remove slow trend (local mean) so quiet/loud parts weigh the same
  const W = 43;
  const norm = new Float32Array(frames);
  let acc = 0;
  for (let i = 0; i < frames; i++) {
    acc += smoothOn[i];
    if (i >= W) acc -= smoothOn[i - W];
    norm[i] = Math.max(0, smoothOn[i] - acc / Math.min(i + 1, W));
  }

  const fps = sr / hop; // envelope frames per second
  // tempo via autocorrelation
  const minLag = Math.floor((fps * 60) / 180);
  const maxLag = Math.ceil((fps * 60) / 70);
  let bestLag = minLag;
  let best = -Infinity;
  const ac: number[] = [];
  for (let lag = minLag; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = lag; i < frames; i++) s += norm[i] * norm[i - lag];
    s /= frames - lag;
    // mild preference for the common 95–140 BPM range
    const bpm = (60 * fps) / lag;
    const w = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 120) / 0.9, 2));
    ac[lag] = s;
    if (s * w > best) {
      best = s * w;
      bestLag = lag;
    }
  }
  // parabolic refinement of the lag
  const a0 = ac[bestLag - 1] ?? ac[bestLag];
  const a1 = ac[bestLag];
  const a2 = ac[bestLag + 1] ?? ac[bestLag];
  const denom = a0 - 2 * a1 + a2;
  const lag = bestLag + (denom !== 0 ? (0.5 * (a0 - a2)) / denom : 0);
  const bpm = Math.round(((60 * fps) / lag) * 10) / 10;

  // best phase of a fixed grid
  let bestPhase = 0;
  let bestScore = -Infinity;
  for (let ph = 0; ph < lag; ph++) {
    let s = 0;
    for (let p = ph; p < frames; p += lag) s += norm[Math.round(p)] ?? 0;
    if (s > bestScore) {
      bestScore = s;
      bestPhase = ph;
    }
  }
  // walk the grid, snapping each beat to the local onset peak
  const beats: number[] = [];
  const strengths: number[] = [];
  const win = Math.max(2, Math.round(lag * 0.12));
  let pos = bestPhase;
  while (pos < frames) {
    let bi = Math.round(pos);
    let bv = -1;
    for (let k = Math.max(0, Math.round(pos) - win); k <= Math.min(frames - 1, Math.round(pos) + win); k++) {
      if (norm[k] > bv) {
        bv = norm[k];
        bi = k;
      }
    }
    beats.push(((bi + 0.5) * hop) / sr);
    strengths.push(bv);
    pos = bi + lag;
  }
  const sorted = [...strengths].sort((x, y) => x - y);
  const ref = sorted[Math.floor(sorted.length * 0.95)] || 1;
  return {
    peak: filePeak(audio),
    bpm,
    beats: beats.map((b) => Math.round(b * 1000) / 1000),
    strengths: strengths.map((s) => Math.round(Math.min(1, s / ref) * 100) / 100),
    duration: audio.duration,
  };
}

function filePeak(audio: AudioBuffer): number {
  let p = 0;
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const d = audio.getChannelData(c);
    for (let i = 0; i < d.length; i++) {
      const v = Math.abs(d[i]);
      if (v > p) p = v;
    }
  }
  return Math.round(p * 10000) / 10000;
}

/** Decodes a file and returns its peak level (0..1). */
export async function measurePeak(blob: Blob): Promise<number> {
  const tmp = new OfflineAudioContext(1, 1, 44100);
  const audio = await tmp.decodeAudioData(await blob.arrayBuffer());
  return filePeak(audio);
}

/** Gain that brings the file's peak to the target level (dBFS). */
export const normalizeGain = (peak: number, targetDb = -1.5) => Math.min(8, Math.pow(10, targetDb / 20) / Math.max(1e-4, peak));
