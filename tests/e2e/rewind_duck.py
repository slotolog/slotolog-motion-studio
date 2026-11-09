import os, sys, time, subprocess
import numpy as np
from playwright.sync_api import sync_playwright
# Geri sarma efekti (kayıt geriye doğru hızla akar) ve seslendirme sırasında oyun sesinin kısılması.
# ramp-timecode.mp4: görüntüde kare numarası, her tam saniyede 1 kHz bip. voice-test.wav: sentetik "seslendirme".
out = os.path.abspath(sys.argv[1])
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
FIX = os.path.join(os.path.dirname(__file__), '..', 'fixtures')
VIDEO = os.path.join(FIX, 'ramp-timecode.mp4'); VOICE = os.path.join(FIX, 'voice-test.wav')
S = "window.__slotolog.getState()"

def ok(cond, msg):
    print(('✓ ' if cond else '✗ ') + msg)
    assert cond, msg

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1512, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    pg.click('button:has-text("Yeni")'); time.sleep(0.8)
    pg.evaluate(f"{S}.setDuration(300)")
    pg.click('button:has-text("Medya")')
    pg.set_input_files('[data-testid=upload]', [VIDEO, VOICE])
    pg.wait_for_function("document.querySelectorAll('[data-testid=user-asset]').length===2", timeout=20000); time.sleep(0.6)
    vid = pg.evaluate(f"{S}.project.assets.find(a=>a.kind==='video').id")
    aud = pg.evaluate(f"{S}.project.assets.find(a=>a.kind==='audio').id")
    add = lambda a: pg.evaluate(f"(id) => {{ const st={S}; st.setFrame(0); st.addAssetLayer(id); const ls=window.__slotolog.getState().project.layers; return ls[ls.length-1].id; }}", a)
    rw = add(vid)
    pg.evaluate(f"{S}.fitProjectToVideo('{rw}')")
    # rewind via the inspector
    pg.evaluate(f"{S}.select('{rw}')"); time.sleep(0.3)
    pg.click('[data-testid=rewind-enable]'); time.sleep(0.3)
    pg.evaluate(f"{S}.updateLayer('{rw}', {{ duration: 60, rewind: {{ from: 29, to: 1, vhs: true }} }})")
    L = pg.evaluate(f"{S}.project.layers.find(l=>l.id==='{rw}')")
    ok(L['rewind']['to'] == 1 and L['startSound'] == 'rewind', 'geri sarma katmanı (bant sesiyle) eklendi')
    main = add(vid)
    pg.evaluate(f"(id) => {S}.updateLayer(id, {{ x:196, y:318, width:392, height:636, objectFit:'cover', start: 60, duration: 240, trimStart: 10 }})", main)
    v = add(aud)
    pg.evaluate(f"(id) => {S}.updateLayer(id, {{ start: 150, duration: 150, channel: 'voice' }})", v)
    pg.evaluate(f"{S}.setAudio({{ duckGame: true, sfxMuted: true }})")
    pg.evaluate(f"{S}.select(null)"); time.sleep(0.3)
    ok(pg.locator('text=Seslendirmede oyun (video) sesini kıs').count() == 1, 'Proje ayarlarında “Seslendirmede oyun (video) sesini kıs” seçeneği var')
    pg.click('[data-testid=export]')
    with pg.expect_download(timeout=600000) as dl:
        pg.click('[data-testid=start-export]')
        while not pg.locator('[data-testid=export-done], [data-testid=export-error]').count(): time.sleep(2)
    dl.value.save_as(f'{out}/rewind_duck.mp4'); time.sleep(0.5)
    ok(pg.locator('[data-testid=export-check]').inner_text().startswith('✓'), 'MP4 doğrulandı')
    assert not errs, errs
    b.close()

f = f'{out}/rewind_duck.mp4'
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-vf', 'crop=384:20:0:300,scale=12:1:flags=area', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
g = np.frombuffer(raw, np.uint8).reshape(-1, 12)
src = ((g > 128) * (2 ** np.arange(12))).sum(1) / 60
r = src[:60]
ok(r[0] > 28 and r[-1] < 2 and np.all(np.diff(r) <= 0.02), f'geri sarma: kayıt {r[0]:.1f} sn → {r[-1]:.1f} sn geriye doğru aktı')
ok(abs(src[61] - (10 + 1 / 30)) < 0.1, f'geri sarmadan sonra normal oynatma: {src[61]:.2f} sn')
araw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '22050', '-f', 's16le', '-'], capture_output=True).stdout
x = np.frombuffer(araw, np.int16) / 32768
def beep(t):  # 1 kHz energy in the 40 ms beep of a given output second
    s = x[int(t * 22050):int((t + 0.04) * 22050)]
    k = np.arange(len(s)); c = np.abs(np.dot(s, np.exp(-2j * np.pi * 1000 * k / 22050))) / len(s)
    return 20 * np.log10(c + 1e-9)
# main layer starts at 2 s with trim 10 s → beeps at 2, 3, 4 (no voice) and 6, 7, 8, 9 (voice from 5 s)
before = np.mean([beep(t) for t in (2.0, 3.0, 4.0)]); during = np.mean([beep(t) for t in (6.0, 7.0, 8.0, 9.0)])
ok(before - during > 6, f'seslendirme sırasında oyun sesi kısıldı: {before:.1f} dB → {during:.1f} dB')
print('REWIND+DUCK OK')
