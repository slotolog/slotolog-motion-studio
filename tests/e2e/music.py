import os, sys, time, json, subprocess
import numpy as np
from playwright.sync_api import sync_playwright
# Müzik + otomatik ritim: BPM/vuruş doğruluğu, önizleme = MP4 karesi, ses-görüntü senkronu
out = os.path.abspath(sys.argv[1])
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
truth = json.load(open(os.path.join(os.path.dirname(__file__), '..', 'fixtures', 'test-song-128bpm.json')))
SONG = os.path.join(os.path.dirname(__file__), '..', 'fixtures', 'test-song-128bpm.mp3')
DUR_S = 6
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1512, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    pg.click('[data-testid=template-bombparty2]'); time.sleep(1.2)
    pg.evaluate(f"window.__slotolog.getState().setDuration({DUR_S * 30})")
    pg.click('button:has-text("Medya")')
    pg.set_input_files('[data-testid=upload]', [SONG])
    pg.wait_for_selector('[data-testid=user-asset]')
    pg.locator('[data-testid=user-asset] button:has-text("Ekle")').first.click()
    pg.wait_for_function("window.__slotolog.getState().project.assets.some(a => a.analysis)", timeout=60000)
    an = pg.evaluate("window.__slotolog.getState().project.assets.find(a => a.analysis).analysis")
    det = np.array(an['beats']); tb = np.array(truth['beats'])
    err = np.array([np.min(np.abs(det - t)) for t in tb])
    hit = float(np.mean(err < 0.05))
    print(f"BPM algılanan {an['bpm']} / gerçek {truth['bpm']} · vuruş isabeti {hit*100:.0f}% · medyan sapma {np.median(err)*1000:.0f} ms")
    assert abs(an['bpm'] - truth['bpm']) < 2, 'BPM yanlış'
    assert hit > 0.9, 'vuruşlar kaçtı'
    pg.locator('button:has-text("★")').first.click() if False else None
    pg.keyboard.press('Escape'); time.sleep(0.5)
    markers = pg.locator('[data-testid=beat-marker]').count()
    print('zaman çizelgesindeki vuruş işaretleri:', markers); assert markers > 5
    status = pg.locator('[data-testid=music-status]').inner_text(); print('panel:', status)
    # preview frame right after a beat
    beat = float(tb[np.argmin(np.abs(tb - 4.0))])
    F = int(round(beat * 30)) + 2
    pg.evaluate(f"window.__slotolog.getState().setFrame({F})")
    r = pg.locator('[data-testid=ruler]').bounding_box()
    pg.mouse.click(r['x'] + F * 3 + 1, r['y'] + 5); time.sleep(1.2)
    fr = pg.evaluate("window.__slotolog.getState().frame"); print('önizleme karesi', fr)
    pg.locator('[data-stage]').screenshot(path=f'{out}/music_preview.png')
    pg.click('[data-testid=export]')
    with pg.expect_download(timeout=600000) as dl:
        pg.click('[data-testid=start-export]')
        while not pg.locator('[data-testid=export-done], [data-testid=export-error]').count(): time.sleep(2)
        if pg.locator('[data-testid=export-error]').count(): print(pg.locator('[data-testid=export-error]').inner_text())
    dl.value.save_as(f'{out}/music.mp4')
    assert not errs, errs
    b.close()

info = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type:format=duration', '-of', 'compact', f'{out}/music.mp4'], capture_output=True, text=True).stdout
print(info.strip()); assert 'audio' in info
# same frame from the MP4 vs the preview
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{out}/music.mp4', '-vf', f'select=eq(n\\,{fr}),scale=270:480', '-frames:v', '1', f'{out}/music_mp4frame.png'])
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{out}/music_preview.png', '-vf', 'scale=270:480', f'{out}/music_preview_s.png'])
from PIL import Image
a = np.asarray(Image.open(f'{out}/music_mp4frame.png').convert('RGB'), dtype=float)
c = np.asarray(Image.open(f'{out}/music_preview_s.png').convert('RGB'), dtype=float)
diff = np.abs(a - c).mean()
print(f'önizleme ↔ MP4 aynı kare ortalama piksel farkı: {diff:.1f}/255')
assert diff < 12, 'önizleme ile MP4 farklı'
# audio onsets in the export vs the known kick times
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'{out}/music.mp4', '-ac', '1', '-ar', '22050', '-f', 's16le', '-'], capture_output=True).stdout
x = np.frombuffer(raw, np.int16).astype(float)
from scipy import signal
lowsos = signal.butter(4, 150, 'low', fs=22050, output='sos'); lo = signal.sosfilt(lowsos, x)
hop = 128; env = np.sqrt(np.convolve(lo**2, np.ones(hop)/hop, 'same'))[::hop]
d = np.maximum(0, np.diff(np.log(env + 1)))
offs = []
for t in tb[tb < DUR_S - 0.5]:
    i0 = int((t - 0.08) * 22050 / hop); i1 = int((t + 0.12) * 22050 / hop)
    k = i0 + int(np.argmax(d[i0:i1]))
    offs.append(k * hop / 22050 - t)
med = np.median(offs) * 1000
print(f'MP4 içinde kick vuruşlarının zaman sapması (medyan): {med:.0f} ms')
assert abs(med) < 60, 'ses kayması'
print('MUSIC OK')
