"""Ritim algılama testi için sentetik 'pop' döngüsü üretir (vuruş zamanları biliniyor)."""
import numpy as np, wave, sys, json
SR = 44100
bpm = float(sys.argv[2]) if len(sys.argv) > 2 else 128.0
dur = 20.0
offset = 0.25
t = np.arange(int(SR * dur)) / SR
x = np.zeros_like(t)
beat = 60 / bpm
beats = []
k = 0
while offset + k * beat < dur - 0.5:
    bt = offset + k * beat; beats.append(round(bt, 4))
    i = int(bt * SR); n = int(0.35 * SR); tt = np.arange(n) / SR
    f = 50 + 110 * np.exp(-tt * 30)
    kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9) * (1.0 if k % 4 == 0 else 0.75)
    x[i:i + n] += kick[: len(x) - i]
    # off-beat hi-hat
    j = int((bt + beat / 2) * SR); m = int(0.05 * SR)
    if j + m < len(x): x[j:j + m] += np.random.default_rng(k).standard_normal(m) * np.exp(-np.arange(m) / SR * 80) * 0.15
    k += 1
# chord pad (A minor / F / C / G) so it sounds like music
chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]]
bar = beat * 4
for c in range(int(dur / bar) + 1):
    s0 = int(c * bar * SR); s1 = min(len(x), int((c + 1) * bar * SR))
    tt = np.arange(s1 - s0) / SR
    for f in chords[c % 4]: x[s0:s1] += 0.06 * np.sin(2 * np.pi * f * tt) * (1 - np.exp(-tt * 20))
x /= np.abs(x).max() * 1.12
with wave.open(sys.argv[1], 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes((x * 32767).astype(np.int16).tobytes())
json.dump({'bpm': bpm, 'beats': beats}, open(sys.argv[1] + '.json', 'w'))
print('beats', len(beats))
