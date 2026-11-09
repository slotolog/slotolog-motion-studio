import os, sys, time, subprocess
import numpy as np
from playwright.sync_api import sync_playwright
# Değişken hız (hız rampası): hiçbir kare atlanmadan sıra korunur, 1× bölümler gerçek hızda ve sesli,
# hızlı bölümler sessiz, sınırlar zaman çizelgesinde sürüklenebilir, proje kaynak videonun oranını korur.
# ramp-timecode.mp4: 392×636, 60 fps, 30 sn; görüntüde 12 bitlik kare numarası (siyah/beyaz kutular); her tam saniyede 40 ms bip
out = os.path.abspath(sys.argv[1])
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
VIDEO = os.path.join(os.path.dirname(__file__), '..', 'fixtures', 'ramp-timecode.mp4')
S = "window.__slotolog.getState()"
R = "window.__slotologRamp"
SEGS = [{'from': 0, 'speed': 8}, {'from': 10, 'speed': 1, 'note': 'önemli an'}, {'from': 14, 'speed': 4}, {'from': 22, 'speed': 1}]

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
    pg.click('button:has-text("Medya")')
    pg.set_input_files('[data-testid=upload]', [VIDEO])
    pg.wait_for_function("document.querySelectorAll('[data-testid=user-asset]').length===1", timeout=20000); time.sleep(0.5)
    pg.locator('[data-testid=user-asset]').first.locator('button:has-text("Ekle")').click(); time.sleep(0.6)
    lid = pg.evaluate(f"{S}.project.layers.find(l=>l.type==='video').id")
    pg.evaluate(f"{S}.select('{lid}')"); time.sleep(0.3)

    # original ratio
    pg.click('[data-testid=fit-project-to-video]'); time.sleep(0.4)
    size = pg.evaluate(f"{S}.project.size")
    ok(size == {'width': 392, 'height': 636} and pg.locator('[data-testid=custom-size]').inner_text() == '392×636', f'proje kaynak videonun oranında: {size}')

    # enable ramp via UI, then set the parts
    pg.click('[data-testid=ramp-enable]'); time.sleep(0.3)
    r0 = pg.evaluate(f"{S}.project.layers.find(l=>l.id==='{lid}').speedRamp")
    ok(r0 and abs(r0['end'] - 30) < 0.1 and len(r0['segments']) == 1, 'değişken hız açıldı (tek bölüm, kaynak 30 sn)')
    pg.evaluate(f"(() => {{ const l={S}.project.layers.find(l=>l.id==='{lid}'); {S}.setSpeedRamp(l.id, {{ ...l.speedRamp, segments: {SEGS} }}); }})()")
    L = pg.evaluate(f"{S}.project.layers.find(l=>l.id==='{lid}')")
    exp = (10 / 8 + 4 + 8 / 4 + 8)  # 15.25 s without transitions
    ok(abs(L['duration'] / 30 - exp) < 1.2, f"çıktı süresi {L['duration']/30:.2f} sn (geçişsiz {exp} sn)")
    ok(pg.locator('[data-testid^=ramp-seg-]').count() == 4, 'Inspector’da 4 hız bölümü listeleniyor')
    pg.click('[data-testid=ramp-fit-project]'); time.sleep(0.3)
    ok(pg.evaluate(f"{S}.project.durationInFrames") == L['duration'], 'proje süresi videoya eşitlendi')

    # 1× parts keep their full length; transitions only take footage from the faster side
    o10 = pg.evaluate(f"{R}.srcToOut({S}.project.layers.find(l=>l.id==='{lid}').speedRamp, 30, 10)")
    o14 = pg.evaluate(f"{R}.srcToOut({S}.project.layers.find(l=>l.id==='{lid}').speedRamp, 30, 14)")
    ok(abs((o14 - o10) - 4) < 0.05, f'1× bölüm (kaynak 10–14 sn) çıktıda tam 4 sn sürüyor: {o10:.2f} → {o14:.2f}')
    pieces = pg.evaluate(f"{R}.expandRamp({S}.project.layers.find(l=>l.id==='{lid}').speedRamp, 30)")
    cont = all(abs(pieces[i]['out0'] + pieces[i]['len'] - pieces[i + 1]['out0']) == 0 for i in range(len(pieces) - 1))
    gaps = max(abs(pieces[i]['src0'] + pieces[i]['len'] / 30 * pieces[i]['speed'] - pieces[i + 1]['src0']) for i in range(len(pieces) - 1))
    ok(cont and gaps < 0.15, f'{len(pieces)} parça, boşluksuz ve sıralı (en büyük kaynak sıçraması {gaps*1000:.0f} ms)')
    sp = [round(x['speed'], 2) for x in pieces]
    ok(any(1 < s < 8 for s in sp[:8]), f'hız geçişleri kademeli: {sp[:9]}')

    # timeline: drag the 1× boundary
    pg.evaluate(f"{S}.checkpoint()")
    h = pg.locator('[data-testid=ramp-handle-2]').bounding_box()
    pg.mouse.move(h['x'] + h['width'] / 2, h['y'] + 8); pg.mouse.down(); pg.mouse.move(h['x'] + h['width'] / 2 + 60, h['y'] + 8, steps=6); pg.mouse.up(); time.sleep(0.3)
    f2 = pg.evaluate(f"{S}.project.layers.find(l=>l.id==='{lid}').speedRamp.segments[2].from")
    ok(f2 > 14.3, f'zaman çizelgesinde hız sınırı sürüklendi: 14.00 → {f2:.2f} sn')
    pg.evaluate(f"{S}.undo()"); time.sleep(0.2)
    ok(pg.evaluate(f"{S}.project.layers.find(l=>l.id==='{lid}').speedRamp.segments[2].from") == 14, 'Geri al çalışıyor')
    pg.screenshot(path=f'{out}/speedramp_editor.png')

    # survives reload (saved in the project)
    time.sleep(1.5); pg.reload(); pg.wait_for_selector('[data-testid=play]'); time.sleep(1.5)
    ok(len(pg.evaluate(f"{S}.project.layers.find(l=>l.id==='{lid}').speedRamp.segments")) == 4, 'sayfa yenilenince rampa korunuyor')

    # export
    pg.click('[data-testid=export]')
    with pg.expect_download(timeout=1200000) as dl:
        pg.click('[data-testid=start-export]')
        while not pg.locator('[data-testid=export-done], [data-testid=export-error]').count(): time.sleep(2)
        if pg.locator('[data-testid=export-error]').count(): print(pg.locator('[data-testid=export-error]').inner_text())
    dl.value.save_as(f'{out}/speedramp.mp4'); time.sleep(1)
    chk = pg.locator('[data-testid=export-check]').inner_text(); print('uygulama içi doğrulama:', chk)
    ok(chk.startswith('✓'), 'MP4 uygulama içi doğrulamadan geçti')
    ramp = pg.evaluate(f"{S}.project.layers.find(l=>l.id==='{lid}').speedRamp")
    probe = list(range(0, L['duration'], 5))   # every 5th output frame
    want = pg.evaluate(f"(a) => a.fs.map(f => {R}.outToSrc(a.r, 30, f))", {'fs': probe, 'r': ramp})
    beeps = pg.evaluate(f"(a) => a.ss.map(s => {R}.srcToOut(a.r, 30, s))", {'ss': [11, 12, 13, 23, 24, 25, 26, 27, 28, 29], 'r': ramp})
    slow = pg.evaluate(f"(a) => a.ss.map(s => {R}.srcToOut(a.r, 30, s))", {'ss': [10, 11, 12, 13, 22, 23, 24, 25, 26, 27, 28, 29], 'r': ramp})
    assert not errs, errs
    b.close()

f = f'{out}/speedramp.mp4'
info = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'compact', f], capture_output=True, text=True).stdout
print(info.strip()); assert 'width=392|height=636' in info and 'audio' in info
def frame_codes(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', 'crop=384:20:0:300,scale=12:1:flags=area', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
    g = np.frombuffer(raw, np.uint8).reshape(-1, 12)
    return ((g > 128) * (2 ** np.arange(12))).sum(1)
src = frame_codes(f) / 60   # source second of every MP4 frame (binary frame number in the picture)
ok(np.all(np.diff(src) >= 0), f'MP4: kaynak saniyeleri hiç geri gitmiyor (kare sırası korunuyor), {src[0]:.2f} → {src[-1]:.2f} sn')
ok(src[0] < 0.2 and src[-1] > 29.4, 'videonun başı ve sonu dahil: hiçbir bölüm kesilmedi')
err = [abs(src[fr] - w) for fr, w in zip(probe, want) if fr < len(src)]
ok(max(err) < 0.05, f'her 5 karede bir beklenen kaynak karesi gösteriliyor (en büyük sapma {max(err)*1000:.0f} ms)')
# audio: beeps only in the 1× parts, exactly where the picture shows that second
araw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '22050', '-f', 's16le', '-'], capture_output=True).stdout
x = np.frombuffer(araw, np.int16) / 32768
env = np.array([np.sqrt((x[i:i + 110] ** 2).mean()) for i in range(0, len(x) - 110, 110)])
onsets = []
for i in range(1, len(env)):
    if env[i] > 0.05 and env[i - 1] <= 0.05 and (not onsets or i * 110 / 22050 - onsets[-1] > 0.3): onsets.append(i * 110 / 22050)
print('bip başlangıçları (MP4):', [round(o, 2) for o in onsets])
print('beklenen (1× bölümler):', [round(o, 2) for o in beeps])
match = [min(abs(o - e) for o in onsets) if onsets else 9 for e in beeps]
ok(max(match) < 0.06, f'ses görüntüyle senkron (en büyük sapma {max(match)*1000:.0f} ms)')
ok(all(min(abs(o - e) for e in slow) < 0.08 for o in onsets), f'hızlandırılmış bölümlerde oyun sesi kısık ({len(onsets)} bip, hepsi 1× bölümlerde; 8× ve 4× bölümlerdeki 18 bip duyulmuyor)')
print('SPEEDRAMP OK')
