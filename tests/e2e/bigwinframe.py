import os, sys, time, subprocess
import numpy as np
from playwright.sync_api import sync_playwright
# Slotolog Big Win Frame şablonu: logo, çerçeve, bonus alanı, oyun videosu değiştirme, kaynak kırpma,
# vurgulu altyazı katmanı, müzik ses eğrisi; 1080×1920 MP4.
out = os.path.abspath(sys.argv[1])
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
FIX = os.path.join(os.path.dirname(__file__), '..', 'fixtures')
VIDEO = os.path.join(FIX, 'ramp-timecode.mp4'); MUSIC = os.path.join(FIX, 'test-song-128bpm.mp3')
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
    pg.click('button:has-text("Şablonlar")'); pg.click('[data-testid=template-bigwinframe]'); time.sleep(1.5)
    names = pg.evaluate(f"{S}.project.layers.map(l=>l.name)")
    need = ['Slotolog logo', 'Slotolog çerçevesi', 'Oyun videosu (değiştir)', 'Bonus tutarı', 'Buton: BONUSU AL', 'Yasal not (18+ / sorumlu oyun)', 'Altyazı (örnek)']
    ok(all(n in names for n in need), f'şablon katmanları: {", ".join(need)}')
    logo = pg.evaluate(f"(() => {{ const st={S}; const l=st.project.layers.find(x=>x.name==='Slotolog logo'); return {{ asset: l.assetId, url: st.assetUrls[l.assetId] || '' }}; }})()")
    ok(logo['asset'] == 'brand-logo-white' and 'slotolog-logo-white.png' in logo['url'] and 'bulunamad' not in pg.locator('[data-stage]').inner_text(), 'orijinal Slotolog PNG logosu yüklü')
    texts = pg.evaluate("[...document.querySelectorAll('[data-stage] svg text')].map(t=>t.textContent).join('|')")
    ok('100.000 TL + 450 FS' in texts and 'HOŞ GELDİN BONUSU' in texts and '18+' in texts, 'bonus alanı ve 18+ notu görünüyor')
    pg.locator('[data-stage]').screenshot(path=f'{out}/bigwinframe.png')
    # bonus amount is editable
    lid = pg.evaluate(f"{S}.project.layers.find(l=>l.name==='Bonus tutarı').id")
    pg.evaluate(f"(id) => {{ const st={S}; const l=st.project.layers.find(x=>x.id===id); st.updateLayer(id, {{ text: {{ ...l.text, text: '50.000 TL + 200 FS' }} }}); }}", lid)
    time.sleep(0.4)
    ok('50.000 TL + 200 FS' in pg.evaluate("[...document.querySelectorAll('[data-stage] svg text')].map(t=>t.textContent).join('|')"), 'bonus tutarı değiştirilebiliyor')
    # replace the game video and crop the phone bars
    pg.click('button:has-text("Medya")')
    pg.set_input_files('[data-testid=upload]', [VIDEO, MUSIC])
    pg.wait_for_function("document.querySelectorAll('[data-testid=user-asset]').length===2", timeout=30000); time.sleep(0.8)
    vid = pg.evaluate(f"{S}.project.assets.find(a=>a.kind==='video').id")
    gid = pg.evaluate(f"{S}.project.layers.find(l=>l.name==='Oyun videosu (değiştir)').id")
    pg.evaluate(f"{S}.applyAssetToLayer('{gid}', '{vid}')"); time.sleep(0.5)
    g = pg.evaluate(f"{S}.project.layers.find(l=>l.id==='{gid}')")
    win = pg.evaluate(f"{S}.project.layers.find(l=>l.type==='frame').frame.window")
    ok(g['type'] == 'video' and g['x'] == win['x'] and g['width'] == win['w'], 'oyun videosu çerçeve penceresine yerleşti')
    pg.evaluate(f"{S}.select('{gid}')"); time.sleep(0.4)
    ok(pg.locator('[data-testid=crop-editor]').count() == 1, 'Inspector’da kaynak kırpma alanı')
    pg.evaluate(f"{S}.updateLayer('{gid}', {{ mediaCrop: {{ top: 0.25, bottom: 0.25, left: 0, right: 0 }} }})")
    # subtitle line with a highlighted word, edited in the inspector
    sid = pg.evaluate(f"{S}.project.layers.find(l=>l.type==='subtitles').id")
    pg.evaluate(f"{S}.select('{sid}')"); time.sleep(0.4)
    pg.fill('[data-testid=cue-text-0]', "Tam *533.862 TL* geldi, *Slotolog*'da"); time.sleep(0.3)
    pg.evaluate(f"{S}.setFrame(30)")
    r = pg.locator('[data-testid=ruler]').bounding_box(); pg.mouse.click(r['x'] + 30 * 3 + 1, r['y'] + 5); time.sleep(0.8)
    fills = pg.evaluate("[...document.querySelectorAll('[data-testid=subtitle] tspan')].map(t=>t.getAttribute('fill')+':'+t.textContent)")
    ok(any(f.startswith('#FF8E16') and '533.862' in f for f in fills) and any(f.startswith('#FFFFFF') and 'geldi' in f for f in fills), f'altyazıda vurgulu kelime turuncu: {[f for f in fills if f.startswith("#")]}')
    sub_txt = pg.evaluate("[...document.querySelectorAll('[data-testid=subtitle] text')].slice(-3).map(t=>t.textContent).join(' ')")
    ok("Slotolog'da" in sub_txt and "Slotolog 'da" not in sub_txt, f'vurgulu kelimeye bitişik ek boşluksuz: {sub_txt!r}')
    # music with a volume curve
    mid = pg.evaluate(f"{S}.project.assets.find(a=>a.kind==='audio').id")
    pg.evaluate(f"(id) => {{ const st={S}; st.setFrame(0); st.addAssetLayer(id); }}", mid)
    ml = pg.evaluate(f"{S}.project.layers[{S}.project.layers.length-1].id")
    pg.evaluate(f"{S}.updateLayer('{ml}', {{ start: 0, duration: 150, channel: 'music', fadeIn: 0, fadeOut: 0, volumeKeys: [{{t:0,v:1}},{{t:2,v:1}},{{t:2.5,v:0.2}},{{t:5,v:0.2}}] }})")
    pg.evaluate(f"{S}.select('{ml}')"); time.sleep(0.3)
    ok(pg.locator('[data-testid=volume-keys]').count() == 1, 'müzik katmanında ses seviyesi eğrisi düzenleyicisi')
    pg.evaluate(f"{S}.updateLayer('{gid}', {{ muted: true }})")
    pg.evaluate(f"{S}.setDuration(150)")
    pg.click('[data-testid=export]')
    with pg.expect_download(timeout=900000) as dl:
        pg.click('[data-testid=start-export]')
        while not pg.locator('[data-testid=export-done], [data-testid=export-error]').count(): time.sleep(2)
    dl.value.save_as(f'{out}/bigwinframe.mp4'); time.sleep(0.5)
    ok(pg.locator('[data-testid=export-check]').inner_text().startswith('✓'), 'MP4 doğrulandı')
    assert not errs, errs
    b.close()

f = f'{out}/bigwinframe.mp4'
info = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate', '-of', 'compact', f], capture_output=True, text=True).stdout
ok('h264' in info and 'width=1080|height=1920' in info and 'r_frame_rate=30/1' in info and 'aac' in info, '1080×1920, 30 fps, H.264/AAC')
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-ac', '1', '-ar', '22050', '-f', 's16le', '-'], capture_output=True).stdout
x = np.frombuffer(raw, np.int16) / 32768
db = lambda a, b: 20 * np.log10(np.sqrt((x[int(a * 22050):int(b * 22050)] ** 2).mean()) + 1e-9)
ok(db(0.3, 1.9) - db(2.7, 4.8) > 10, f'müzik ses eğrisine uyuyor: {db(0.3, 1.9):.1f} dB → {db(2.7, 4.8):.1f} dB')
# crop: the frame-number boxes (source y≈300–320 of 636) stay inside the window after a 25 % top/bottom crop
fr = subprocess.run(['ffmpeg', '-v', 'error', '-ss', '1', '-i', f, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True).stdout
img = np.frombuffer(fr, np.uint8).reshape(1920, 1080)
row = img[855, 300:780]
ok(row.max() > 200 and row.min() < 60, 'kırpılmış kaynak pencerenin ortasında (kare kodu kutuları görünüyor)')
print('BIG WIN FRAME OK')
