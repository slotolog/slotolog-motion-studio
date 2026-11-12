import os, sys, time, json, subprocess, zipfile, glob
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
# Premium Rakamlar V2: yerinde duran Premium Shine animasyonu (kayma/makara yok), turuncu Inter Black görünüm,
# ayrı kategori, eski V1 setleri silinmeden duruyor, dizi önizlemede varsayılan V2, toplu ZIP + gerçek WEBM kontrolleri.
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

def wait_set(pg, anim):
    for _ in range(160):
        P = [x for x in projects(pg) if (x.get('emoji') or {}).get('glyphSet', {}).get('anim') == anim]
        if len(P) == 16: return P
        time.sleep(0.5)
    return P

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1512, 'height': 982}, accept_downloads=True)
    pg = ctx.new_page(); errs = []; dls = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept()); pg.on('download', lambda d: dls.append(d))
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    pg.click('[data-testid=open-emoji-studio]'); pg.wait_for_selector('[data-testid=emoji-studio]'); time.sleep(1)
    # eski V1 seti önce var olsun: V2 onu silmemeli
    pg.click('[data-testid=digits-make-reel]'); reel = wait_set(pg, 'reel'); time.sleep(1)
    pg.click('[data-testid=digits-make-shine]'); v2 = wait_set(pg, 'shine'); time.sleep(1)
    pg.click('[data-testid=digits-make-shine]'); time.sleep(2)
    P = [x for x in projects(pg) if (x.get('emoji') or {}).get('glyphSet')]
    v2 = [x for x in P if x['emoji']['glyphSet']['anim'] == 'shine']
    ok(len(v2) == 16 and sorted(x['emoji']['glyphSet']['char'] for x in v2) == sorted(CHARS) and all(x['emoji']['category'] == 'Premium Rakamlar V2' for x in v2),
       '16 karakterlik V2 seti “Premium Rakamlar V2” kategorisinde; ikinci kez oluşturmak kopya üretmedi')
    ok(len([x for x in P if x['emoji']['glyphSet']['anim'] == 'reel']) == 16 and all(x['emoji']['category'] == 'Premium Rakamlar' for x in P if x['emoji']['glyphSet']['anim'] == 'reel'),
       'eski Slot Reel seti silinmedi, kendi kategorisinde duruyor')
    L = [l for x in v2 for l in x['layers'] if l.get('glyph')]
    ok(len(L) == 16 and all(l['glyph']['anim'] == 'shine' and l['glyph']['look'] == 'orange' and not l.get('reel') for l in L)
       and len({(l['text']['fontSize'], l['width'], l['height'], l['x'], l['y'], l['glyph']['depth']) for l in L}) == 1,
       'V2: makara yok (reel alanı boş), Premium Shine + turuncu görünüm, hepsi aynı yazı boyutu, kutu ve derinlik')
    lib = pg.locator('[data-testid=emoji-library] > div').filter(has_text='Premium Rakamlar V2')
    ok(lib.first.locator('[data-testid=emoji-item]').count() >= 16, 'kütüphanede “Premium Rakamlar V2” kategorisi')
    ok(pg.locator('[data-testid=glyph-style]').count() == 1 and pg.evaluate(f"{S}.project.name") == 'Rakam 0 · Premium V2', 'V2 rakamı düzenleyicide açık (stil paneli)')
    ok(pg.eval_on_selector('[data-testid=sequence-anim]', 'e=>e.value') == 'shine', 'Rakam Dizisi Önizleme varsayılan olarak V2')
    pg.locator('[data-testid=sequence-input]').fill('100.000₺'); time.sleep(2)
    n = pg.locator('[data-testid=sequence-tiles] > div').first.locator(':scope > div').count()
    ok(n == 8, f'“100.000₺” V2 dizisi: {n} emoji yan yana')
    pg.locator('[data-testid=sequence-preview]').screenshot(path=f'{out}/digits_v2_sequence.png')
    pg.click('[data-testid=pick-digits-shine]')
    n0 = len(dls)
    pg.click('[data-testid=emoji-export-zip]')
    pg.wait_for_selector('[data-testid=emoji-zip-link]', timeout=1800000); time.sleep(1.5)
    z = [d for d in dls[n0:] if d.suggested_filename.endswith('.zip')]
    if not z:
        with pg.expect_download() as dl:
            pg.click('[data-testid=emoji-zip-link]')
        z = [dl.value]
    zf = f'{out}/v2_{z[0].suggested_filename}'; z[0].save_as(zf)
    oks = pg.locator('[data-testid=emoji-result]').evaluate_all("e=>e.map(x=>x.dataset.ok)")
    ok(len(oks) == 16 and all(o == '1' for o in oks), 'uygulamanın Telegram kontrolü: 16/16 uyumlu')
    assert not errs, errs
    b.close()

names = zipfile.ZipFile(zf).namelist()
webms = sorted(n for n in names if n.endswith('.webm'))
expect = sorted(f"RakamV2_{FILE.get(c, c)}_PremiumShine_100x100.webm" for c in CHARS)
ok(webms == expect, 'ZIP: 16 ayrı V2 WEBM (RakamV2_…_PremiumShine_100x100.webm)')
d = f'{out}/digits_v2_zip'; os.makedirs(d, exist_ok=True); zipfile.ZipFile(zf).extractall(d)
tops, bots, drift = [], [], []
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
    steps = [np.abs(fr[i + 1] - fr[i]).mean() for i in range(89)]
    assert np.abs(fr[-1] - fr[0]).mean() <= 2.5 * max(0.05, np.mean(steps)), n  # smooth loop
    assert fr[0][:3, :, 3].max() < 30 and fr[0][-3:, :, 3].max() < 30, n
    # yerinde duruyor: her karede gövdenin ağırlık merkezi en fazla ~2 px oynar (yalnız %3 nefes + ışıma) (kayma/düşme yok)
    cs = []
    for a in fr:
        ys, xs = np.nonzero(a[:, :, 3] > 160); cs.append((ys.mean(), xs.mean()))
        assert a[:, :, 3].max() > 200, n  # her karede okunur (hiç kaybolmuyor)
    cs = np.array(cs); drift.append(float(np.abs(cs - cs[0]).max()))
    if n.split('_')[1].isdigit():
        ys = np.nonzero(fr[0][:, :, 3] > 128)[0]; tops.append(ys.min()); bots.append(ys.max())
ok(max(drift) <= 3, f'kayma yok: ağırlık merkezi en fazla {max(drift):.2f} px oynuyor (makara/düşme efekti yok)')
ok(True, '16/16 ffprobe + libvpx: VP9, 100×100, alfa, 30 FPS, 90 kare, ≤3 sn, ≤64 KB, ses yok, yumuşak döngü')
ok(max(tops) - min(tops) <= 3 and max(bots) - min(bots) <= 3, f'0–9 hiza: üst {min(tops)}–{max(tops)} px, alt {min(bots)}–{max(bots)} px')
print('EMOJI DIGITS V2 OK')
