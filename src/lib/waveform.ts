/**
 * Waveform peaks for the timeline's audio track: reduce raw PCM samples to a
 * fixed number of max-amplitude buckets, normalized to 0..1 so quiet clips
 * still draw a readable waveform.
 */
export function computePeaks(
  samples: Float32Array,
  buckets = 4000
): Float32Array {
  const n = Math.max(1, Math.min(buckets, samples.length));
  const out = new Float32Array(n);
  const per = samples.length / n;

  let max = 0;
  for (let i = 0; i < n; i++) {
    let m = 0;
    const s = Math.floor(i * per);
    const e = Math.min(samples.length, Math.max(s + 1, Math.ceil((i + 1) * per)));
    for (let j = s; j < e; j++) {
      const a = Math.abs(samples[j]);
      if (a > m) m = a;
    }
    out[i] = m;
    if (m > max) max = m;
  }

  if (max > 0.01) {
    for (let i = 0; i < n; i++) out[i] /= max;
  }
  return out;
}
