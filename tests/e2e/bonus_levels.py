import os, sys, time, json, subprocess, zipfile, glob
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
# Bonus Seviyeleri: 3 seri (Taç / Rozet / Chip) × 5 seviye; yerinde animasyon, düzenlenebilir stil, toplu ZIP + gerçek WEBM kontrolleri.
out = os.path.abspath(sys.argv[1])
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
S = "window.__slotolog.getState()"
SER = {'crown': 'Tac', 'badge': 'Rozet', 'chip': 'Chip'}
LV = ['1_Bronz', '2_Gumus', '3_Altin', '4_Platin', '5_Elmas']

def ok(cond, msg):
    print(('✓ ' if cond else '✗ ') + msg)
    assert cond, msg

def projects(pg):
    return pg.evaluate("""(async () => { const dbs = await new Promise(r => { const q = indexedDB.open('slotolog-projects'); q.onsuccess = () => r(q.result); });
        return await new Promise(r => { const t = dbs.transaction('projects').objectStore('projects').getAll(); t.onsuccess = () => r(t.result); }); })()""")

def bonus(pg):
    return [x for x in projects(pg) if (x.get('emoji') or {}).get('bonus')]

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1512, 'height': 982}, accept_downloads=True)
    pg = ctx.new_page(); errs = []; dls = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept()); pg.on('download', lambda d: dls.append(d))
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    pg.click('[data-testid=open-emoji-studio]'); pg.wait_for_selector('[data-testid=emoji-studio]'); time.sleep(1)
    before = len(projects(pg))
    pg.click('[data-testid=bonus-make-all]'); pg.wait_for_selector('[data-testid=bonus-msg]')
    for _ in range(120):
        B = bonus(pg)
        if len(B) == 15: break
        time.sleep(0.5)
    pg.click('[data-testid=bonus-make-all]')
    pg.wait_for_function("document.querySelector('[data-testid=bonus-msg]')?.textContent.includes('15 yenilendi')", timeout=60000); time.sleep(1)
    B = bonus(pg)
    keys = sorted((x['emoji']['bonus']['series'], x['emoji']['bonus']['level']) for x in B)
    ok(len(B) == 15 and keys == sorted((s, l) for s in SER for l in range(5)) and all(x['emoji']['category'] == 'Bonus Seviyeleri' for x in B),
       '15 emoji: 3 seri × 5 seviye “Bonus Seviyeleri” kategorisinde; ikinci kez oluşturmak kopya üretmedi')
    L = [l for x in B for l in x['layers'] if l.get('bonus')]
    ok(len(L) == 15 and all(x['durationInFrames'] == 90 and x['fps'] == 30 for x in B) and all(not l.get('reel') for l in L), 'her emoji 90 kare @30 FPS, makara (reel) yok')
    heads = pg.locator('[data-testid=bonus-series-head]').all_text_contents()
    ok(heads == ['Premium Taçlar', 'Premium Rozetler', 'Premium Casino Chips'], f'kütüphanede 3 seri başlığı sırayla: {heads}')
    ok(pg.evaluate(f"{S}.project.name") == 'A · Taç · 5 Elmas' and pg.locator('[data-testid=bonus-style]').count() == 1, 'Elmas taç düzenleyicide açık, stil paneli görünür')
    # editable: accent, shine, scale, level
    pg.fill('[data-testid=bonus-accent]', '#ff7a00'); time.sleep(0.3)
    pg.locator('[data-testid=bonus-shine]').fill('1.3'); pg.locator('[data-testid=bonus-scale]').fill('0.9'); time.sleep(0.3)
    bl = pg.evaluate(f"{S}.project.layers.find(l=>l.bonus).bonus")
    ok(bl['accent'].lower() == '#ff7a00' and abs(bl['shine'] - 1.3) < 1e-6 and abs(bl['scale'] - 0.9) < 1e-6, 'renk, parlama ve ölçek düzenlenebiliyor')
    pg.select_option('[data-testid=bonus-level]', '2'); time.sleep(0.4)
    ok(pg.evaluate(f"{S}.project.emoji.bonus.level") == 2 and pg.evaluate(f"{S}.project.name") == 'A · Taç · 3 Altın', 'seviye değiştirilebiliyor (proje adı ve bilgisi güncelleniyor)')
    pg.select_option('[data-testid=bonus-level]', '4'); pg.fill('[data-testid=bonus-accent]', '#ff8e16'); pg.locator('[data-testid=bonus-shine]').fill('1'); pg.locator('[data-testid=bonus-scale]').fill('1'); time.sleep(1.5)
    pg.screenshot(path=f'{out}/bonus_studio.png')
    pg.click('[data-testid=pick-bonus]')
    n0 = len(dls)
    pg.click('[data-testid=emoji-export-zip]')
    pg.wait_for_selector('[data-testid=emoji-zip-link]', timeout=1800000); time.sleep(1.5)
    z = [d for d in dls[n0:] if d.suggested_filename.endswith('.zip')]
    if not z:
        with pg.expect_download() as dl:
            pg.click('[data-testid=emoji-zip-link]')
        z = [dl.value]
    zf = f'{out}/bonus_{z[0].suggested_filename}'; z[0].save_as(zf)
    oks = pg.locator('[data-testid=emoji-result]').evaluate_all("e=>e.map(x=>x.dataset.ok)")
    ok(len(oks) == 15 and all(o == '1' for o in oks), 'uygulamanın Telegram kontrolü: 15/15 uyumlu')
    ok(len(projects(pg)) == before + 15, 'mevcut emoji ve projeler silinmedi (yalnız 15 yeni proje eklendi)')
    assert not errs, errs
    b.close()

names = zipfile.ZipFile(zf).namelist()
webms = sorted(n for n in names if n.endswith('.webm'))
ok(webms == sorted(f'Bonus_{SER[s]}_{l}_100x100.webm' for s in SER for l in LV), 'ZIP: 15 ayrı WEBM (Bonus_<Seri>_<Seviye>_100x100.webm)')
d = f'{out}/bonus_zip'; os.makedirs(d, exist_ok=True); zipfile.ZipFile(zf).extractall(d)
rep = []
for n in webms:
    f = f'{d}/{n}'
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate:stream_tags=alpha_mode:format=duration,size', '-of', 'json', f], capture_output=True, text=True).stdout)
    v = j['streams'][0]
    assert len(j['streams']) == 1 and v['codec_type'] == 'video' and v['codec_name'] == 'vp9' and v['width'] == 100 and v['height'] == 100 and v.get('tags', {}).get('alpha_mode') == '1', n
    assert float(j['format']['duration']) <= 3.0 and int(j['format']['size']) <= 64000 and v['r_frame_rate'] == '30/1', n
    fd = f + '_fr'; os.makedirs(fd, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-c:v', 'libvpx-vp9', '-i', f, '-pix_fmt', 'rgba', fd + '/%03d.png'], check=True)
    fr = [np.array(Image.open(x)).astype(int) for x in sorted(glob.glob(fd + '/*.png'))]
    assert len(fr) == 90, n
    steps = [np.abs(fr[i + 1] - fr[i]).mean() for i in range(89)]
    seam = np.abs(fr[-1] - fr[0]).mean() / max(0.05, np.mean(steps))
    assert seam <= 2.5, (n, seam)
    a0 = fr[0][:, :, 3]
    edge = np.concatenate([a0[:2].ravel(), a0[-2:].ravel(), a0[:, :2].ravel(), a0[:, -2:].ravel()])
    assert (edge > 40).mean() <= 0.01, n
    assert 0.05 < (a0 == 0).mean() < 0.9, n  # real transparency around the object
    cs = np.array([(lambda ys, xs: (ys.mean(), xs.mean()))(*np.nonzero(a[:, :, 3] > 160)) for a in fr])
    rep.append((n, int(j['format']['size']), round(float(seam), 2), round(float(np.abs(cs - cs[0]).max()), 2)))
for r in rep: print('  ', *r)
ok(max(r[3] for r in rep if 'Chip' not in r[0]) <= 2.5 and max(r[3] for r in rep if 'Chip' in r[0]) <= 5, 'yerinde duruyor: aşağı kayma / makara yok (taç ve rozet ≤2,5 px, chip eğimi ≤5 px)')
ok(True, '15/15 ffprobe + libvpx: VP9, 100×100, alfa, 30 FPS, 90 kare, ≤3 sn, ≤64 KB, tek video akışı (ses yok), kesintisiz döngü, kenarlar şeffaf')
json.dump(rep, open(f'{out}/bonus_report.json', 'w'))
print('BONUS LEVELS OK')
