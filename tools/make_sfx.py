"""
Slotolog Motion Studio — özgün ses efektleri üreticisi.
Tüm sesler burada matematiksel olarak sentezlenir (harici örnek/kayıt yok),
bu yüzden ticari kullanım dahil tamamen projeye aittir.
Kullanım: python3 tools/make_sfx.py  ->  public/sfx/*.wav
"""
import numpy as np, wave, os

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sfx')
rng = np.random.default_rng(7)

def t_axis(d): return np.arange(int(SR * d)) / SR

def save(name, x, peak_db=-4.0):
    x = np.asarray(x, dtype=np.float64)
    fade = int(0.004 * SR)
    x[:fade] *= np.linspace(0, 1, fade); x[-fade:] *= np.linspace(1, 0, fade)
    x = x / (np.max(np.abs(x)) + 1e-9) * (10 ** (peak_db / 20))
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    print(name, f'{len(x)/SR:.2f}s')

def reverb(x, decay=0.35, delays=(0.031, 0.047, 0.061, 0.079), tail=0.6):
    y = np.concatenate([x, np.zeros(int(SR * tail))])
    for i, d in enumerate(delays):
        n = int(d * SR); g = decay * (0.85 ** i)
        buf = np.zeros_like(y)
        for k in range(1, 6):
            if n * k < len(y): buf[n * k:] += y[: len(y) - n * k] * (g ** k)
        y = y + buf * 0.5
    return y

def bandpass_sweep(noise, f0, f1, q=2.5):
    # STFT shaping with a moving Gaussian band (smooth, no clicks)
    n = 1024; hop = 256; win = np.hanning(n)
    out = np.zeros(len(noise) + n); norm = np.zeros(len(noise) + n)
    frames = (len(noise) - n) // hop + 1
    freqs = np.fft.rfftfreq(n, 1 / SR)
    for i in range(frames):
        seg = noise[i * hop: i * hop + n] * win
        p = i / max(1, frames - 1)
        fc = f0 * (f1 / f0) ** p
        bw = fc / q
        mask = np.exp(-0.5 * ((freqs - fc) / bw) ** 2)
        out[i * hop: i * hop + n] += np.fft.irfft(np.fft.rfft(seg) * mask) * win
        norm[i * hop: i * hop + n] += win ** 2
    return (out / np.maximum(norm, 1e-3))[: len(noise)]

def bell(f, d, partials=((1, 1.0), (2.01, 0.45), (3.02, 0.25), (4.2, 0.12)), decay=6.0):
    t = t_axis(d)
    return sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t * decay * (1 + m * 0.4)) for m, a in partials)

os.makedirs(OUT, exist_ok=True)

# 1) whoosh: filtered noise sweeping up then down, soft swell
d = 0.6; t = t_axis(d)
x = bandpass_sweep(rng.standard_normal(len(t)), 350, 2600, q=2.2)
env = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 2.2
save('whoosh.wav', x * env, -7)

# 2) bounce: soft rubbery thump with quick pitch drop
d = 0.32; t = t_axis(d)
f = 90 + 230 * np.exp(-t * 28)
ph = 2 * np.pi * np.cumsum(f) / SR
x = np.sin(ph) * np.exp(-t * 13) + 0.25 * np.sin(2 * ph) * np.exp(-t * 22)
x += 0.08 * rng.standard_normal(len(t)) * np.exp(-t * 120)
save('bounce.wav', x, -6)

# 3) coins: metallic glitter — several short inharmonic 'tings'
d = 1.2; x = np.zeros(int(SR * d))
for k in range(9):
    st = int(SR * (0.02 + rng.random() * 0.45)); f0 = 2100 + rng.random() * 2300
    b = bell(f0, 0.5, partials=((1, 1.0), (2.76, 0.5), (5.4, 0.28), (8.93, 0.12)), decay=9 + rng.random() * 6)
    x[st: st + len(b)] += b[: len(x) - st] * (0.5 + rng.random() * 0.5)
x += bandpass_sweep(rng.standard_normal(len(x)), 6000, 9000, q=3) * np.exp(-t_axis(d) * 5) * 0.25
save('coins.wav', reverb(x, 0.25, tail=0.3), -7)

# 4) sparkle: quick rising pentatonic shimmer
notes = [1046.5, 1174.7, 1318.5, 1568.0, 1760.0, 2093.0]
x = np.zeros(int(SR * 0.9))
for i, f0 in enumerate(notes):
    st = int(SR * i * 0.055); b = bell(f0 * 2, 0.45, decay=9) * (0.6 + i * 0.08)
    x[st: st + len(b)] += b[: len(x) - st]
save('sparkle.wav', reverb(x, 0.3, tail=0.5), -9)

# 5) riser: short upward lift for text entrances
d = 0.7; t = t_axis(d)
f = 220 * (4 ** (t / d))
ph = 2 * np.pi * np.cumsum(f) / SR
tone = np.sin(ph) + 0.35 * np.sin(2 * ph) + 0.15 * np.sin(3 * ph)
air = bandpass_sweep(rng.standard_normal(len(t)), 800, 7000, q=1.6)
env = (t / d) ** 1.6 * np.exp(-np.clip(t - d * 0.9, 0, None) * 60)
save('riser.wav', reverb((0.55 * tone + 0.5 * air) * env, 0.25, tail=0.35), -8)

# 6) button: bright two-step "ta-da" chime
x = np.zeros(int(SR * 1.3))
chords = [(0.0, [659.3, 830.6, 987.8]), (0.16, [880.0, 1108.7, 1318.5, 1760.0])]
for st_s, fs in chords:
    st = int(SR * st_s)
    for f0 in fs:
        b = bell(f0, 1.1, decay=4.2)
        x[st: st + len(b)] += b[: len(x) - st] * 0.5
save('button.wav', reverb(x, 0.35, tail=0.6), -6)

# 7) rewind: tape rewinding — a fast warbling whirr that speeds up and stops, over hiss
d = 1.5; t = t_axis(d)
speed = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 0.7          # spool speeds up, then brakes
f = 180 + 1400 * speed + 90 * np.sin(2 * np.pi * 23 * t) * speed
ph = 2 * np.pi * np.cumsum(f) / SR
whirr = np.sign(np.sin(ph)) * 0.25 + np.sin(ph) * 0.5 + 0.2 * np.sin(2.01 * ph)
hiss = bandpass_sweep(rng.standard_normal(len(t)), 2500, 6000, q=1.4)
chatter = (np.sin(2 * np.pi * 38 * t) > 0.6) * speed
env = np.clip(t / 0.06, 0, 1) * np.clip((d - t) / 0.12, 0, 1)
save('rewind.wav', (0.55 * whirr * speed + 0.45 * hiss * (0.4 + speed) + 0.12 * chatter * hiss) * env, -8)
