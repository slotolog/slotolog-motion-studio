import os, sys, time, json, subprocess, zipfile, glob
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
# Premium Rakamlar: 16 karakterlik set (Slot Reel + Golden Pulse), düzenlenebilir glyph katmanı (karakter, renk, parlaklık, derinlik,
# animasyon), tüm sete uygulama, hız, Rakam Dizisi Önizleme, toplu ZIP; gerçek WEBM: VP9 100×100 alfa ≤64 KB, hiza ve döngü.
out = os.path.abspath(sys.argv[1])
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
S = "window.__slotolog.getState()"
CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '%', '+', '×', '₺', '.', 'FS']
FILE = {'%': 'yuzde', '+': 'arti', '×': 'carpi', '₺': 'TL', '.': 'nokta'}

def ok(cond, msg):
    print(('✓ ' if cond else '✗ ') + msg)
    assert cond, msg

def projects(pg):
    return pg.evaluate("""(async () => { const dbs = await new Promise(r => { const q = indexedDB.open('slotolog-projects'); q.onsuccess = () => r(q.result); });
        return await new Promise(r => { const t = dbs.transaction('projects').objectStore('projects').getAll(); t.onsuccess = () => r(t.result); }); })()""")

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1512, 'height': 982}, accept_downloads=True)
    pg = ctx.new_page(); errs = []; dls = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept()); pg.on('download', lambda d: dls.append(d))
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    pg.click('[data-testid=open-emoji-studio]'); pg.wait_for_selector('[data-testid=emoji-studio]'); time.sleep(1)
    pg.click('[data-testid=digits-make-reel]'); pg.wait_for_selector('[data-testid=digit-msg]'); time.sleep(1.5)
    pg.click('[data-testid=digits-make-reel]'); time.sleep(2)
    P = [x for x in projects(pg) if (x.get('emoji') or {}).get('glyphSet')]
    reel = [x for x in P if x['emoji']['glyphSet']['anim'] == 'reel']
    ok(len(reel) == 16 and sorted(x['emoji']['glyphSet']['char'] for x in reel) == sorted(CHARS) and all(x['emoji']['category'] == 'Premium Rakamlar' for x in reel),
       '16 karakterlik Slot Reel seti “Premium Rakamlar” kategorisinde; ikinci kez oluşturmak kopya üretmedi')
    L = [l for x in reel for l in x['layers'] if l.get('glyph')]
    ok(len(L) == 16 and len({(l['text']['fontSize'], l['width'], l['height'], l['y'], l['x']) for l in L}) == 1 and len({json.dumps(l['reel'], sort_keys=True) for l in L}) == 1 and len({x['durationInFrames'] for x in reel}) == 1,
       'hepsi aynı yazı boyutu, kutu, hiza ve aynı makara zamanlamasıyla (düzenlenebilir yazı katmanı)')
    cat = pg.locator('[data-testid=emoji-library] > div').filter(has_text='Premium Rakamlar')
    ok(cat.locator('[data-testid=emoji-item]').count() == 16, 'kütüphanede Premium Rakamlar altında 16 ayrı seçilebilir emoji')
    # stil paneli: açık olan "Rakam 0"
    ok(pg.locator('[data-testid=glyph-style]').count() == 1, 'rakam stili paneli açık')
    pg.select_option('[data-testid=glyph-char]', '7'); time.sleep(0.3)
    cur = pg.evaluate(f"{S}.project")
    ok(cur['name'] == 'Rakam 7 · Slot Reel' and cur['layers'][0]['text']['text'] == '7', 'karakter değiştirilebiliyor (katman metni + proje adı)')
    pg.select_option('[data-testid=glyph-char]', '0'); time.sleep(0.3)
    pg.locator('[data-testid=glyph-accent]').fill('#ffaa00'); time.sleep(0.2)
    pg.locator('[data-testid=glyph-brightness]').fill('1.2'); time.sleep(0.3)
    g = pg.evaluate(f"{S}.project.layers[0].glyph")
    ok(g['accent'] == '#ffaa00' and abs(g['brightness'] - 1.2) < 1e-6, 'vurgu rengi ve parlaklık ayarlanabiliyor')
    pg.click('[data-testid=glyph-apply-set]')
    pg.wait_for_function("document.querySelector('[data-testid=digit-msg]')?.textContent.includes('15 rakama')", timeout=60000)
    P = [x for x in projects(pg) if (x.get('emoji') or {}).get('glyphSet', {}).get('anim') == 'reel']
    ok(all(l['glyph']['accent'] == '#ffaa00' and abs(l['glyph']['brightness'] - 1.2) < 1e-6 for x in P for l in x['layers'] if l.get('glyph')), 'stil tüm Slot Reel setine uygulandı (16/16)')
    pg.locator('[data-testid=glyph-accent]').fill('#ff8e16'); pg.locator('[data-testid=glyph-brightness]').fill('1'); time.sleep(0.3)
    pg.click('[data-testid=glyph-apply-set]')
    for _ in range(120):
        if all(l['glyph']['accent'] == '#ff8e16' for x in projects(pg) if (x.get('emoji') or {}).get('glyphSet') for l in x['layers'] if l.get('glyph')): break
        time.sleep(0.5)
    # hız
    pg.click('[data-testid="emoji-speed-1.25"]'); time.sleep(0.3)
    cur = pg.evaluate(f"{S}.project")
    ok(cur['durationInFrames'] == 72 and cur['layers'][0]['reel']['firstLand'] == 32, 'animasyon hızı değiştirilebiliyor (döngü ve makara zamanlaması birlikte ölçeklenir)')
    pg.click('[data-testid="emoji-speed-0.75"]'); time.sleep(0.3)
    ok(pg.evaluate(f"{S}.project.durationInFrames") == 90, 'yavaşlatma 3 sn ile sınırlı')
    # Rakam Dizisi Önizleme
    pg.locator('[data-testid=sequence-input]').fill('100.000₺'); time.sleep(1.5)
    n = pg.locator('[data-testid=sequence-tiles] > div').first.locator(':scope > div').count()
    ok(n == 8, f'“100.000₺” dizisi: {n} emoji yan yana önizleniyor')
    pg.locator('[data-testid=sequence-input]').fill('+450 FS'); time.sleep(1)
    n2 = pg.locator('[data-testid=sequence-tiles] > div').first.locator(':scope > div').count()
    ok(n2 == 5, f'“+450 FS” dizisi: FS tek emoji ({n2} emoji)')
    pg.locator('[data-testid=sequence-input]').fill('%150 1000×'); time.sleep(1.5)
    pg.locator('[data-testid=sequence-preview]').screenshot(path=f'{out}/digits_sequence.png')
    # Golden Pulse seti
    pg.click('[data-testid=digits-make-pulse]')
    for _ in range(120):
        P = [x for x in projects(pg) if (x.get('emoji') or {}).get('glyphSet')]
        if sum(x['emoji']['glyphSet']['anim'] == 'pulse' for x in P) == 16: break
        time.sleep(0.5)
    time.sleep(1)
    pulse = [x for x in P if x['emoji']['glyphSet']['anim'] == 'pulse']
    ok(len(pulse) == 16 and all(not l.get('reel') and l['glyph']['anim'] == 'pulse' for x in pulse for l in x['layers'] if l.get('glyph')) and len([x for x in P if x['emoji']['glyphSet']['anim'] == 'reel']) == 16,
       'Golden Pulse seti ayrı 16 emoji; Slot Reel seti duruyor')
    pg.screenshot(path=f'{out}/digits_studio.png')
    # toplu ZIP: Slot Reel rakamları
    pg.click('[data-testid=pick-digits-reel]')
    n0 = len(dls)
    pg.click('[data-testid=emoji-export-zip]')
    pg.wait_for_selector('[data-testid=emoji-zip-link]', timeout=900000); time.sleep(1.5)
    z = [d for d in dls[n0:] if d.suggested_filename.endswith('.zip')]
    if not z:
        with pg.expect_download() as dl:
            pg.click('[data-testid=emoji-zip-link]')
        z = [dl.value]
    zf = f'{out}/{z[0].suggested_filename}'; z[0].save_as(zf)
    oks = pg.locator('[data-testid=emoji-result]').evaluate_all("e=>e.map(x=>x.dataset.ok)")
    ok(len(oks) == 16 and all(o == '1' for o in oks), 'uygulamanın Telegram kontrolü: 16/16 uyumlu')
    assert not errs, errs
    b.close()

names = zipfile.ZipFile(zf).namelist()
webms = sorted(n for n in names if n.endswith('.webm'))
expect = sorted(f"Rakam_{FILE.get(c, c)}_SlotReel_100x100.webm" for c in CHARS)
ok(webms == expect and 'TELEGRAM_UYUMLULUK_RAPORU.txt' in names and sum(n.endswith('.gif') for n in names) == 16, f'ZIP: 16 ayrı WEBM (açık dosya adları) + PNG/GIF önizlemeler + rapor')
d = f'{out}/digits_zip'; os.makedirs(d, exist_ok=True); zipfile.ZipFile(zf).extractall(d)
tops, bots = [], []
for n in webms:
    f = f'{d}/{n}'
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,width,height,r_frame_rate:stream_tags=alpha_mode:format=duration,size', '-of', 'json', f], capture_output=True, text=True).stdout)
    v = j['streams'][0]
    assert len(j['streams']) == 1 and v['codec_name'] == 'vp9' and v['width'] == 100 and v['height'] == 100 and v.get('tags', {}).get('alpha_mode') == '1', n
    assert float(j['format']['duration']) <= 3.0 and int(j['format']['size']) <= 64000 and v['r_frame_rate'] == '30/1', n
    fd = f + '_fr'; os.makedirs(fd, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-c:v', 'libvpx-vp9', '-i', f, '-pix_fmt', 'rgba', fd + '/%03d.png'], check=True)
    fr = [np.array(Image.open(x)).astype(int) for x in sorted(glob.glob(fd + '/*.png'))]
    assert len(fr) == 90, n
    seam = np.abs(fr[-1] - fr[0]).mean()
    assert seam < 2.0, (n, seam)  # Slot Reel: first and last frame are the same sharp digit (only codec noise)
    assert fr[0][:3, :, 3].max() < 30 and fr[0][-3:, :, 3].max() < 30, n  # transparent edges
    if n.split('_')[1].isdigit():
        ys = np.nonzero(fr[-1][:, :, 3] > 128)[0]; tops.append(ys.min()); bots.append(ys.max())
ok(True, '16/16 ffprobe + libvpx: VP9, 100×100, alfa, 30 FPS, 90 kare, ≤3 sn, ≤64 KB, ses yok, ilk ve son kare aynı net rakam')
ok(max(tops) - min(tops) <= 3 and max(bots) - min(bots) <= 3, f'0–9 hiza: üst kenar {min(tops)}–{max(tops)} px, alt kenar {min(bots)}–{max(bots)} px (yan yana tutarlı)')
print('EMOJI DIGITS OK')
