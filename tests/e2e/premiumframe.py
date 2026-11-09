import os, sys, time, subprocess
import numpy as np
from playwright.sync_api import sync_playwright
# Slotolog Premium Big Win Frame: katmanlar, dekorların açılıp kapanması, oyun videosunun otomatik sığması,
# kırpmadan sonra yeniden sığdırma, düzenlenebilir metinler, 1080×1920 MP4 (SVG dekorlar dahil).
out = os.path.abspath(sys.argv[1])
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
VIDEO = os.path.join(os.path.dirname(__file__), '..', 'fixtures', 'ramp-timecode.mp4')  # 392×636
S = "window.__slotolog.getState()"

def ok(cond, msg):
    print(('✓ ' if cond else '✗ ') + msg)
    assert cond, msg

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1512, 'height': 1000}, accept_downloads=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    pg.click('button:has-text("Şablonlar")'); pg.click('[data-testid=template-premiumbigwin]'); time.sleep(1.5)
    P = pg.evaluate(f"{S}.project")
    names = [l['name'] for l in P['layers']]
    ok(P['name'] == 'Slotolog Premium Big Win Frame' and P['aspect'] == '9:16' and P['fps'] == 30, 'şablon: 1080×1920, 30 fps')
    for n in ['Slotolog logo', 'Slogan (değiştir)', 'Premium çerçeve (altın-turuncu)', 'Oyun videosu (değiştir)', 'Bonus başlığı (değiştir)',
              'Bonus tutarı (değiştir)', 'Free spin teklifi (değiştir)', 'Buton: BONUSU AL (değiştir)', 'Yasal not (değiştir)']:
        assert n in names, n
    decor = [n for n in names if n.startswith('Dekor') or n.startswith('Işık')]
    ok(len(decor) >= 10, f'{len(decor)} ayrı dekor / ışık katmanı (coin, kiraz, mücevher, çan, 7, ışıklar)')
    urls = pg.evaluate(f"Object.entries({S}.assetUrls).filter(([k])=>k.startsWith('decor-')).map(([k,v])=>v)")
    ok(len(urls) >= 8 and all(u.endswith('.svg') for u in urls), 'dekorlar uygulamayla gelen özgün SVG çizimler')
    texts = pg.evaluate("[...document.querySelectorAll('[data-stage] svg text')].map(t=>t.textContent).join('|')")
    ok(all(t in texts for t in ['BÜYÜK KAZANÇ BURADA', 'HOŞ GELDİN BONUSU', '100.000 TL', '+450 FS', '18+']), 'slogan, bonus, FS ve yasal metin görünüyor')
    pg.locator('[data-stage]').screenshot(path=f'{out}/premiumframe.png')
    # texts editable separately
    def set_text(name, t):
        pg.evaluate(f"(a) => {{ const st={S}; const l=st.project.layers.find(x=>x.name===a.n); st.updateLayer(l.id, {{ text: {{ ...l.text, text: a.t }} }}); }}", {'n': name, 't': t})
    set_text('Bonus tutarı (değiştir)', '250.000 TL'); set_text('Free spin teklifi (değiştir)', '+1000 FS'); set_text('Slogan (değiştir)', 'SLOT KEYFİ SLOTOLOG’DA')
    time.sleep(0.4)
    texts = pg.evaluate("[...document.querySelectorAll('[data-stage] svg text')].map(t=>t.textContent).join('|')")
    ok('250.000 TL' in texts and '+1000 FS' in texts and 'SLOTOLOG’DA' in texts, 'bonus tutarı, FS ve slogan ayrı ayrı değiştirilebiliyor')
    # decorations can be turned off
    cid = pg.evaluate(f"{S}.project.layers.find(l=>l.name==='Dekor · 7 (sağ alt)').id")
    pg.evaluate(f"{S}.updateLayer('{cid}', {{ visible: false }})")
    ok(not pg.evaluate(f"{S}.project.layers.find(l=>l.id==='{cid}').visible"), 'dekor katmanı kapatılabiliyor')
    pg.evaluate(f"{S}.updateLayer('{cid}', {{ visible: true }})")
    # frame brightness
    fid = pg.evaluate(f"{S}.project.layers.find(l=>l.type==='frame').id")
    pg.evaluate(f"{S}.select('{fid}')"); time.sleep(0.3)
    ok(pg.locator('text=Çerçeve parlaklığı').count() == 1 and pg.locator('[data-testid=fit-game-to-frame]').count() == 1, 'Çerçeve panelinde parlaklık ve “oyun videosuna uydur”')
    # put a game video in: the frame fits it automatically
    pg.click('button:has-text("Medya")')
    pg.set_input_files('[data-testid=upload]', [VIDEO])
    pg.wait_for_function("document.querySelectorAll('[data-testid=user-asset]').length===1", timeout=30000); time.sleep(0.6)
    vid = pg.evaluate(f"{S}.project.assets.find(a=>a.kind==='video').id")
    gid = pg.evaluate(f"{S}.project.layers.find(l=>l.gameSlot).id")
    pg.evaluate(f"{S}.applyAssetToLayer('{gid}', '{vid}')"); time.sleep(0.4)
    W = pg.evaluate(f"{S}.project.layers.find(l=>l.type==='frame').frame.window")
    G = pg.evaluate(f"{S}.project.layers.find(l=>l.id==='{gid}')")
    ok(W['h'] == 1020 and abs(W['w'] / W['h'] - 392 / 636) < 0.01 and W['x'] == 540 and G['width'] == W['w'] and G['type'] == 'video',
       f"oyun videosu otomatik sığdı ve ortalandı: pencere {W['w']}×{W['h']} (video oranı korunuyor)")
    pg.evaluate(f"{S}.updateLayer('{gid}', {{ mediaCrop: {{ top: 0.2, bottom: 0.2, left: 0, right: 0 }} }})")
    pg.evaluate(f"{S}.select('{gid}')"); time.sleep(0.3)
    pg.click('[data-testid=crop-fit]'); time.sleep(0.3)
    W2 = pg.evaluate(f"{S}.project.layers.find(l=>l.type==='frame').frame.window")
    ok(W2['w'] == 960 and abs(W2['h'] - 960 / (392 / (636 * 0.6))) < 2, f"kırpmadan sonra yeniden sığdı: {W2['w']}×{W2['h']} (genişlik sınırı 960)")
    pg.evaluate(f"{S}.setDuration(90)")
    pg.click('[data-testid=export]')
    with pg.expect_download(timeout=900000) as dl:
        pg.click('[data-testid=start-export]')
        while not pg.locator('[data-testid=export-done], [data-testid=export-error]').count(): time.sleep(2)
    dl.value.save_as(f'{out}/premiumframe.mp4'); time.sleep(0.5)
    ok(pg.locator('[data-testid=export-check]').inner_text().startswith('✓'), 'MP4 doğrulandı')
    assert not errs, errs
    b.close()

f = f'{out}/premiumframe.mp4'
info = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate', '-of', 'compact', f], capture_output=True, text=True).stdout
ok('h264' in info and 'width=1080|height=1920' in info and 'r_frame_rate=30/1' in info, '1080×1920, 30 fps, H.264')
fr = subprocess.run(['ffmpeg', '-v', 'error', '-ss', '1', '-i', f, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
img = np.frombuffer(fr, np.uint8).reshape(1920, 1080, 3).astype(int)
def gold(x0, y0, r=24):
    a = img[y0 - r:y0 + r, x0 - r:x0 + r].reshape(-1, 3)
    return ((a[:, 0] > 200) & (a[:, 1] > 120) & (a[:, 2] < 120)).mean()
ok(gold(96, 1606) > 0.2 and gold(990, 1604, 20) > 0.05, 'SVG dekorlar (çan, 7) MP4’te çiziliyor')
ok(gold(540, 1792, 40) > 0.3, 'BONUSU AL butonu altın-turuncu')
print('PREMIUM FRAME OK')
