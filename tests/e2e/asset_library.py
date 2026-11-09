import os, sys, time, io, zipfile, subprocess, json
import numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
# Varlık Kütüphanesi: ZIP ile 20 şeffaf PNG → "Slot Sembolleri"; kalıcılık (yeniden yükleme, yeni proje),
# tekrar eklemede çoğaltmama, oran/şeffaflık korunması, + ile ve sürükle-bırak ile ekleme, boyut + animasyon, MP4.
out = os.path.abspath(sys.argv[1])
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
S = "window.__slotolog.getState()"

def ok(cond, msg):
    print(('✓ ' if cond else '✗ ') + msg)
    assert cond, msg

# test paketi: 20 farklı oranlı, şeffaf zeminli özgün PNG + OKU_BENI.txt + manifest.json (Slotolog paketinin yapısı)
SIZES = [(735, 666), (526, 536), (736, 763), (367, 320), (735, 1206), (1200, 1200), (736, 535), (378, 384), (700, 561), (736, 1269)] * 2
zpath = f'{out}/test-icon-pack.zip'
with zipfile.ZipFile(zpath, 'w') as z:
    for i, (w, h) in enumerate(SIZES, 1):
        im = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        d.ellipse([w * 0.2, h * 0.2, w * 0.8, h * 0.8], fill=(230, 20, 30, 255))
        b = io.BytesIO(); im.save(b, 'PNG')
        z.writestr(f'Test_Slot_Icon_{i:02d}.png', b.getvalue())
    z.writestr('OKU_BENI.txt', 'test')
    z.writestr('manifest.json', json.dumps([]))

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1512, 'height': 1000}, accept_downloads=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    pg.click('button:has-text("Medya")')
    ok(pg.locator('[data-testid=lib-category]').input_value() == 'Slot Sembolleri', 'varsayılan kategori: Slot Sembolleri')
    pg.set_input_files('[data-testid=lib-upload]', [zpath])
    pg.wait_for_selector('[data-testid=lib-msg]', timeout=30000)
    msg = pg.inner_text('[data-testid=lib-msg]')
    ok(msg.startswith('✓ 20 görsel “Slot Sembolleri”') and '2 dosya atlandı' in msg, f'ZIP açıldı: {msg}')
    cat = pg.locator('[data-testid="lib-cat-Slot Sembolleri"]')
    ok(cat.locator('[data-testid=lib-item]').count() == 20, '20 ikon ayrı ayrı seçilebilir öğe olarak listelendi')
    pg.wait_for_function("[...document.querySelectorAll('[data-testid=lib-item] img')].every(i=>i.complete&&i.naturalWidth>0)", timeout=15000)
    nat = pg.evaluate("[...document.querySelectorAll('[data-testid=lib-item] img')].map(i=>[i.naturalWidth,i.naturalHeight])")
    ok(sorted(map(tuple, nat)) == sorted(SIZES), '20 önizlemenin tamamı yüklendi, orijinal piksel boyutları korunuyor')
    pg.locator('[data-testid=asset-library]').screenshot(path=f'{out}/asset_library.png')
    # tekrar yükleme çoğaltmaz
    pg.set_input_files('[data-testid=lib-upload]', [zpath]); time.sleep(1.5)
    ok(pg.inner_text('[data-testid=lib-msg]').startswith('✓ 0 görsel') and cat.locator('[data-testid=lib-item]').count() == 20, 'aynı paket ikinci kez eklenmiyor (çoğaltma yok)')
    # kalıcılık: sayfa yenileme + yeni proje
    pg.reload(); pg.wait_for_selector('[data-testid=play]')
    pg.evaluate("window.__slotolog.getState().loadIntoEditor(window.__slotolog.getState().project)")
    pg.click('button:has-text("Medya")'); time.sleep(0.8)
    ok(pg.locator('[data-testid="lib-cat-Slot Sembolleri"] [data-testid=lib-item]').count() == 20, 'sayfa yenilendikten sonra 20 ikon hâlâ kütüphanede (kalıcı)')
    # + ile ekle → oran korunur
    item = pg.locator('[data-testid=lib-item]').nth(4)  # 735×1206
    name = item.get_attribute('title').split(' · ')[0]
    item.hover(); item.locator('[data-testid=lib-add]').click(); time.sleep(0.4)
    L = pg.evaluate(f"{S}.project.layers.at(-1)")
    A = pg.evaluate(f"{S}.project.assets.find(a=>a.id==='{L['assetId']}')")
    ok(L['type'] == 'image' and A['libId'] and abs(L['width'] / L['height'] - A['width'] / A['height']) < 0.01 and L['objectFit'] == 'contain',
       f"+ ile eklendi: {name} {L['width']}×{L['height']} (oran {A['width']}×{A['height']} ile aynı)")
    item.hover(); item.locator('[data-testid=lib-add]').click(); time.sleep(0.3)
    ok(pg.evaluate(f"{S}.project.assets.filter(a=>a.libId==='{A['libId']}').length") == 1, 'aynı ikon iki kez eklenince projeye tek kopya alınıyor')
    # sürükle-bırak
    n0 = pg.evaluate(f"{S}.project.layers.length")
    pg.locator('[data-testid=lib-item]').nth(0).drag_to(pg.locator('[data-stage]'), target_position={'x': 80, 'y': 120}); time.sleep(0.5)
    ok(pg.evaluate(f"{S}.project.layers.length") == n0 + 1 and pg.evaluate(f"{S}.project.layers.at(-1).type") == 'image', 'sahneye sürükle-bırak ile eklendi')
    # boyutlandırma + animasyon
    lid = L['id']
    pg.evaluate(f"{S}.updateLayer('{lid}', {{ width: {L['width'] * 2}, height: {L['height'] * 2} }})")
    pg.evaluate(f"{S}.select('{lid}')")
    pg.click('button:has-text("Efektler")'); time.sleep(0.3)
    pg.locator('button:has-text("Yukarı aşağı zıplar")').click(); time.sleep(0.3)
    E = pg.evaluate(f"{S}.project.layers.find(l=>l.id==='{lid}')")
    ok(E['width'] == L['width'] * 2 and len(E['effects']) >= 1, f"boyutlandırma ve animasyon efekti ({E['effects'][0]['type']}) uygulanıyor")
    # şeffaflık MP4'te korunuyor: tek ikon, bilinen arka plan üzerinde
    pg.evaluate(f"""(() => {{ const st={S}; const keep=st.project.layers.find(l=>l.id==='{lid}');
       st.update(p => ({{ ...p, layers: [{{...keep, effects: [], x: 540, y: 960, width: 600, height: 984, rotation: 0, opacity: 1}}] }})); st.setDuration(30); }})()""")
    pg.click('[data-testid=export]')
    with pg.expect_download(timeout=600000) as dl:
        pg.click('[data-testid=start-export]')
        while not pg.locator('[data-testid=export-done], [data-testid=export-error]').count(): time.sleep(1)
    dl.value.save_as(f'{out}/asset_library.mp4')
    ok(pg.locator('[data-testid=export-check]').inner_text().startswith('✓'), 'MP4 doğrulandı')
    assert not errs, errs
    b.close()

f = f'{out}/asset_library.mp4'
fr = subprocess.run(['ffmpeg', '-v', 'error', '-ss', '0.5', '-i', f, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
img = np.frombuffer(fr, np.uint8).reshape(-1, 1080, 3).astype(int)
c = img[960, 540]; corner = img[960 - 470, 540 - 280]
ok(c[0] > 180 and c[1] < 80, f'ikon merkezi kırmızı {tuple(c)}')
ok(not (corner[0] > 180 and corner[1] < 80) and corner.sum() < 200, f'ikonun şeffaf köşesinden arka plan görünüyor {tuple(corner)}')
print('ASSET LIBRARY OK')
