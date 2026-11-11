import os, sys, time, json, subprocess, zipfile, glob
import numpy as np
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright
# Telegram Emoji Studio: arayüz, emoji paketi, kategoriler, Slot Reel Assemble, parçalara ayırma, hız, döngü,
# gerçek şeffaf VP9 WEBM (100×100, ≤3 sn, ≤256 KB, sessiz) — uygulamanın raporu + ffprobe/libvpx ile bağımsız doğrulama, ZIP.
out = os.path.abspath(sys.argv[1])
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
S = "window.__slotolog.getState()"

def ok(cond, msg):
    print(('✓ ' if cond else '✗ ') + msg)
    assert cond, msg

# PNG fixture (özgün, şeffaf): yükleme + makara uygulama testi için
png = f'{out}/emoji-test-logo.png'
im = Image.new('RGBA', (600, 200), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
for i, c in enumerate([(255, 142, 22), (255, 255, 255), (255, 142, 22), (255, 255, 255)]):
    d.rounded_rectangle([20 + i * 145, 30, 140 + i * 145, 170], 30, fill=c + (255,))
im.save(png)

def probe(f):
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate:stream_tags=alpha_mode:format=duration,size', '-of', 'json', f], capture_output=True, text=True).stdout)
    return j

def frames_rgba(f):
    d = f + '_frames'; os.makedirs(d, exist_ok=True); [os.remove(x) for x in glob.glob(d + '/*')]
    subprocess.run(['ffmpeg', '-v', 'error', '-c:v', 'libvpx-vp9', '-i', f, '-pix_fmt', 'rgba', d + '/%03d.png'], check=True)
    return [np.array(Image.open(x)) for x in sorted(glob.glob(d + '/*.png'))]

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1512, 'height': 982}, accept_downloads=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda dl: dl.accept())
    downloads = []
    pg.on('download', lambda dl: downloads.append(dl))
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    video_layers = pg.evaluate(f"{S}.project.layers.length")
    pg.click('[data-testid=open-emoji-studio]'); pg.wait_for_selector('[data-testid=emoji-studio]'); time.sleep(1)
    P = pg.evaluate(f"{S}.project")
    ok(P['emoji']['category'] == 'Logo' and P['size'] == {'width': 512, 'height': 512} and P['durationInFrames'] == 90 and P['fps'] == 30, 'Emoji Studio açıldı: Slotolog Logo Assemble (512 tasarım → 100×100, 90 kare, 30 FPS)')
    logo = next(l for l in P['layers'] if l.get('reel'))
    ok(logo['assetId'] == 'brand-logo-white' and len(logo['reel']['cuts']) == 3, 'Logo Assemble gerçek Slotolog PNG’sini 4 makaraya bölüyor')
    pg.click('[data-testid=emoji-make-pack]'); time.sleep(2.5)
    names = pg.locator('[data-testid=emoji-item]').evaluate_all("e=>e.map(x=>x.dataset.name)")
    for n in ['Slotolog Logo Assemble', 'Slotolog Logo Spin', 'BONUS', '1000X Bomb', 'JACKPOT', 'FREE SPIN', 'Slotolog Logo Assemble · İşaret', 'Slotolog Logo Assemble · Şerit 1/3']:
        assert n in names, n
    ok(names.count('Slotolog Logo Assemble') == 1, f'İlk paket: {len(names)} emoji projesi, tekrar oluşturmada kopya yok')
    pg.click('[data-testid=emoji-make-pack]'); time.sleep(2)
    ok(pg.locator('[data-testid=emoji-item]').count() == len(names), 'paketi ikinci kez oluşturmak kütüphaneyi çoğaltmıyor')
    cats = pg.locator('[data-testid=emoji-library] > div > div:first-child').all_inner_texts()
    ok(any(c.startswith('Logo') for c in cats) and any(c.startswith('Bonus') for c in cats) and any(c.startswith('Çarpan') for c in cats), f'kategoriler: {[c.split(chr(10))[0] for c in cats]}')
    pg.locator('[data-testid=emoji-library] [data-testid=emoji-item][data-name="BONUS"] button').first.click(); time.sleep(1)
    pg.select_option('[data-testid=emoji-category]', 'Duyurular'); time.sleep(0.6)
    ok(pg.evaluate(f"{S}.project.emoji.category") == 'Duyurular', 'kategori değiştirilebiliyor')
    pg.select_option('[data-testid=emoji-category]', 'Bonus'); time.sleep(0.4)
    ok(pg.locator('[data-testid=emoji-loop-preview] canvas, [data-testid=emoji-loop-preview] svg').count() > 0, 'döngü önizleme (100 px + mesaj içi) çalışıyor')

    # PNG yükle → makara uygula, ayarla, parçalara ayır, hız, döngü
    pg.set_input_files('[data-testid=emoji-upload]', [png]); time.sleep(2)
    P = pg.evaluate(f"{S}.project")
    img = P['layers'][-1]
    ok(P['emoji']['category'] == 'Sağlayıcı logoları' and img['type'] == 'image' and abs(img['width'] / img['height'] - 3) < 0.05, 'PNG’den yeni emoji (Sağlayıcı logoları), oran korunuyor')
    pg.evaluate(f"{S}.select('{img['id']}')"); time.sleep(0.3)
    pg.click('[data-testid=reel-apply]'); time.sleep(0.3)
    pg.locator('[data-testid=reel-columns]').fill('4'); time.sleep(0.3)
    r = pg.evaluate(f"{S}.project.layers.find(l=>l.id==='{img['id']}').reel")
    ok(r and len(r['cuts']) == 3, 'Slot Reel Assemble yüklenen logoya uygulandı (4 makara)')
    pg.locator('[data-testid=reel-cuts]').fill('0.25, 0.5, 0.75'); pg.locator('[data-testid=reel-cuts]').blur(); time.sleep(0.3)
    pg.click('[data-testid=emoji-fit-loop]'); time.sleep(0.3)
    pg.click('[data-testid="emoji-speed-1.25"]'); time.sleep(0.3)
    P = pg.evaluate(f"{S}.project")
    ok(P['durationInFrames'] == 72 and P['layers'][-1]['reel']['firstLand'] < r['firstLand'], f"hız ×1.25: döngü {P['durationInFrames']} kare, makara zamanlaması ölçeklendi")
    pg.click('[data-testid="emoji-speed-0.75"]'); time.sleep(0.3)
    ok(pg.evaluate(f"{S}.project.durationInFrames") == 90, 'yavaşlatma en fazla 3 sn (90 kare) ile sınırlı')
    n0 = pg.evaluate(f"{S}.project.layers.length")
    pg.click('[data-testid=split-layer]'); time.sleep(0.3)
    parts = pg.evaluate(f"{S}.project.layers.filter(l=>l.name.includes('parça')).map(l=>[l.mediaCrop.left,l.mediaCrop.right,l.width])")
    ok(len(parts) == 4 and pg.evaluate(f"{S}.project.layers.length") == n0 + 3 and abs(sum(w for _, _, w in parts) - img['width']) < 4, 'katman 4 parçaya ayrıldı (her biri aynı PNG’den kırpılmış, ayrı düzenlenebilir)')
    pg.locator('[data-stage]').screenshot(path=f'{out}/emoji_split.png')

    # Logo Assemble'ı aç ve WEBM indir
    pg.locator('[data-testid=emoji-library] [data-testid=emoji-item][data-name="Slotolog Logo Assemble"] button').first.click(); time.sleep(1)
    pg.screenshot(path=f'{out}/emoji_studio.png')
    pg.click('[data-testid=emoji-export-one]')
    pg.wait_for_function("document.querySelectorAll('[data-testid=emoji-result][data-ok]').length===1 && document.querySelector('[data-testid=emoji-checks]')", timeout=180000)
    time.sleep(1)
    checks = pg.locator('[data-testid=emoji-checks] li').evaluate_all("e=>e.map(x=>[x.dataset.key,x.dataset.ok,x.textContent])")
    for k, o, t in checks: print('   ', t)
    ok(all(o == '1' for _, o, _ in checks) and len(checks) >= 10, 'uygulamanın Telegram uyumluluk raporu: tüm kontroller geçti')
    ok(pg.locator('[data-testid=emoji-result] img').count() == 2, 'şeffaf PNG ve GIF önizlemeleri oluştu')
    webm = [d for d in downloads if d.suggested_filename.endswith('.webm')]
    ok(len(webm) == 1 and webm[0].suggested_filename == 'Slotolog-Logo-Assemble_100x100.webm', f'WEBM indirildi: {webm[0].suggested_filename}')
    f = f'{out}/{webm[0].suggested_filename}'; webm[0].save_as(f)

    # ZIP: iki emoji
    for n in ['BONUS', '1000X Bomb']:
        pg.locator(f'[data-testid=emoji-pick][data-name="{n}"]').check()
    pg.click('[data-testid=emoji-export-zip]')
    try:
        pg.wait_for_function("[...document.querySelectorAll('[data-testid=emoji-result]')].length===2 && [...document.querySelectorAll('[data-testid=emoji-result]')].every(e=>e.dataset.ok==='1')", timeout=300000)
    except Exception:
        print(pg.locator('[data-testid=emoji-export]').inner_text()); pg.screenshot(path=f'{out}/emoji_zip_fail.png'); raise
    pg.wait_for_selector('[data-testid=emoji-zip-link]', timeout=60000); time.sleep(1)
    z = [d for d in downloads if d.suggested_filename.endswith('.zip')]
    if not z:  # Chrome held back the automatic second download → the link works
        with pg.expect_download() as dl:
            pg.click('[data-testid=emoji-zip-link]')
        z = [dl.value]
    ok(len(z) == 1, f'ZIP indirildi: {z[0].suggested_filename}')
    zf = f'{out}/{z[0].suggested_filename}'; z[0].save_as(zf)
    assert not errs, errs
    b.close()

# bağımsız doğrulama (ffprobe + libvpx çözücü)
j = probe(f)
v = j['streams'][0]
ok(len(j['streams']) == 1 and v['codec_name'] == 'vp9' and v['width'] == 100 and v['height'] == 100 and v['r_frame_rate'] == '30/1', 'ffprobe: tek iz, VP9, 100×100, 30 FPS, ses yok')
ok(v.get('tags', {}).get('alpha_mode') == '1', 'ffprobe: alpha_mode=1 (şeffaf WEBM)')
ok(float(j['format']['duration']) <= 3.0 and int(j['format']['size']) <= 256 * 1024, f"süre {float(j['format']['duration']):.2f} sn ≤ 3, boyut {int(j['format']['size']) / 1024:.1f} KB ≤ 256")
fr = frames_rgba(f)
corner = np.mean([fm[:6, :6, 3].mean() for fm in fr])
center_max = max(fm[30:70, 10:90, 3].max() for fm in fr)
ok(len(fr) == 90 and corner < 2 and center_max > 240, f'libvpx ile çözüldü: 90 kare, köşeler şeffaf (ort. alfa {corner:.1f}), logo opak')
steps = [np.abs(fr[i].astype(int) - fr[i - 1].astype(int)).mean() for i in range(1, len(fr))]
seam = np.abs(fr[-1].astype(int) - fr[0].astype(int)).mean()
ok(seam <= 2.5 * np.mean(steps), f'kesintisiz döngü: son→ilk kare farkı {seam:.2f} (ortalama adım {np.mean(steps):.2f})')
names = zipfile.ZipFile(zf).namelist()
ok(sorted(names) == sorted(['BONUS_100x100.webm', '1000X-Bomb_100x100.webm', 'onizleme/BONUS_100x100.png', 'onizleme/BONUS_100x100.gif', 'onizleme/1000X-Bomb_100x100.png', 'onizleme/1000X-Bomb_100x100.gif', 'TELEGRAM_UYUMLULUK_RAPORU.txt']), f'ZIP içeriği: {names}')
rep = zipfile.ZipFile(zf).read('TELEGRAM_UYUMLULUK_RAPORU.txt').decode()
ok(rep.count('—  UYUMLU') == 2 and 'SORUNLU' not in rep, 'ZIP’teki uyumluluk raporu: 2/2 uyumlu')
for n in ['BONUS_100x100.webm', '1000X-Bomb_100x100.webm']:
    zipfile.ZipFile(zf).extract(n, out)
    jj = probe(f'{out}/{n}'); vv = jj['streams'][0]
    ok(vv['codec_name'] == 'vp9' and vv['width'] == 100 and vv.get('tags', {}).get('alpha_mode') == '1' and int(jj['format']['size']) <= 262144, f'{n}: VP9 100×100 alfa, {int(jj["format"]["size"]) / 1024:.0f} KB')
print('EMOJI STUDIO OK')
