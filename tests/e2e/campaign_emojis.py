import os, sys, time, json, subprocess, base64, glob
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright
# Slotolog Bonus Emojileri: 9 kampanya × (3D tekli emoji + yazılı başlık şeridi parçaları), düzenlenebilir stil,
# gerçek WEBM çıktısı (VP9 / alfa / 100×100 / ≤3 sn / ≤64 KB), kesintisiz döngü. WebGL için SwiftShader kullanılır.
out = os.path.abspath(sys.argv[1])
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
S = "window.__slotolog.getState()"
IDS = ['welcome', 'weekend', 'night', 'refund', 'spin', 'multi', 'birthday', 'friend', 'daily']
TILES = {'welcome': 3, 'weekend': 3, 'night': 2, 'refund': 2, 'spin': 2, 'multi': 4, 'birthday': 3, 'friend': 4, 'daily': 4}

def ok(cond, msg):
    print(('✓ ' if cond else '✗ ') + msg)
    assert cond, msg

def projects(pg):
    return pg.evaluate("""(async () => { const dbs = await new Promise(r => { const q = indexedDB.open('slotolog-projects'); q.onsuccess = () => r(q.result); });
        return await new Promise(r => { const t = dbs.transaction('projects').objectStore('projects').getAll(); t.onsuccess = () => r(t.result); }); })()""")

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 1512, 'height': 982})
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    pg.click('[data-testid=open-emoji-studio]'); pg.wait_for_selector('[data-testid=emoji-studio]'); time.sleep(1)
    before = len(projects(pg))
    pg.click('[data-testid=campaign-make-all]'); pg.wait_for_selector('[data-testid=campaign-msg]')
    for _ in range(120):
        C = [x for x in projects(pg) if (x.get('emoji') or {}).get('campaign')]
        if len(C) == 36: break
        time.sleep(0.5)
    pg.click('[data-testid=campaign-make-all]')
    pg.wait_for_function("document.querySelector('[data-testid=campaign-msg]')?.textContent.includes('36 yenilendi')", timeout=300000); time.sleep(1)
    C = [x for x in projects(pg) if (x.get('emoji') or {}).get('campaign')]
    singles = sorted(x['emoji']['campaign']['id'] for x in C if x['emoji']['campaign']['part'] == 'single')
    strips = [x for x in C if x['emoji']['campaign']['part'] == 'strip']
    ok(len(C) == 36 and singles == sorted(IDS) and all(x['emoji']['category'] == 'Slotolog Bonus Emojileri' for x in C),
       '9 kampanya emojisi + 27 şerit parçası “Slotolog Bonus Emojileri” kategorisinde; ikinci kez oluşturmak kopya üretmedi')
    ok(all(sum(1 for x in strips if x['emoji']['campaign']['id'] == i) == TILES[i] for i in IDS), 'her kampanyanın şeridi doğru sayıda parçadan oluşuyor (2–4)')
    ok(len(projects(pg)) == before + 36, 'mevcut emoji koleksiyonları ve projeler silinmedi (yalnız 36 yeni proje)')
    L = [l for x in C for l in x['layers'] if l.get('campaign')]
    ok(len(L) == 36 and all(x['durationInFrames'] == 90 and x['fps'] == 30 for x in C) and not any(l.get('reel') for l in L), 'her emoji 90 kare @30 FPS, makara (reel) yok')
    ok(pg.evaluate(f"{S}.project.name") == '01 · Hoş Geldin Bonusu' and pg.locator('[data-testid=campaign-style]').count() == 1, 'Hoş Geldin düzenleyicide açık, stil paneli görünür')
    pg.locator('[data-testid=campaign-brightness]').fill('1.2'); pg.locator('[data-testid=campaign-shine]').fill('0.7'); time.sleep(0.4)
    c = pg.evaluate(f"{S}.project.layers.find(l=>l.campaign).campaign")
    ok(abs(c['brightness'] - 1.2) < 1e-6 and abs(c['shine'] - 0.7) < 1e-6, 'parlaklık ve parıltı düzenlenebiliyor')
    pg.locator('[data-testid=campaign-brightness]').fill('1'); pg.locator('[data-testid=campaign-shine]').fill('1'); time.sleep(1)
    pg.locator('[data-testid=emoji-library] [data-testid=emoji-item]').filter(has_text='09 · Günlük Bonus · şerit 2/4').first.locator('button').first.click(); time.sleep(1.5)
    ok(pg.locator('[data-testid=campaign-text]').input_value() == 'GÜNLÜK BONUS', 'şerit parçasında yazı düzenlenebilir alan (GÜNLÜK BONUS, parça 2/4)')
    pg.screenshot(path=f'{out}/campaign_studio.png')
    # real exports (same code path as the ZIP button): one single + one strip part
    res = pg.evaluate("""(async () => {
      const E = window.__slotologEmoji; await E.ensureCampaignFont(); const r = [];
      try {
      for (const P of [E.campaignSingle('night'), E.campaignStrip('daily')[1]]) {
        const o = await E.exportEmojiWebm(P, {});
        const buf = new Uint8Array(await o.blob.arrayBuffer()); const blob = new Blob([buf], { type: 'video/webm' });
        const c = await E.checkTelegramWebm(blob, P); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
        r.push({ name: E.emojiFileName(P), ok: c.ok, size: blob.size, b64: btoa(s) });
      }
      } catch (e) { return { err: e.name + ': ' + e.message, stack: String(e.stack).slice(0, 1500), done: r.map((x) => x.name) }; }
      return r; })()""")
    if isinstance(res, dict): print(res); raise SystemExit(1)
    ok([r['name'] for r in res] == ['Kampanya_03_Gece50_100x100.webm', 'Kampanya_09_GunlukBonus_Serit_2of4_100x100.webm'] and all(r['ok'] for r in res), f"uygulamanın Telegram kontrolü: {[(r['name'], r['size']) for r in res]}")
    assert not errs, errs
    b.close()

for r in res:
    f = f"{out}/{r['name']}"; open(f, 'wb').write(base64.b64decode(r['b64']))
    j = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate:stream_tags=alpha_mode:format=duration,size', '-of', 'json', f], capture_output=True, text=True).stdout)
    v = j['streams'][0]
    assert len(j['streams']) == 1 and v['codec_name'] == 'vp9' and v['width'] == 100 and v['height'] == 100 and v.get('tags', {}).get('alpha_mode') == '1', f
    assert float(j['format']['duration']) <= 3.0 and int(j['format']['size']) <= 64000 and v['r_frame_rate'] == '30/1', f
    fd = f + '_fr'; os.makedirs(fd, exist_ok=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-c:v', 'libvpx-vp9', '-i', f, '-pix_fmt', 'rgba', fd + '/%03d.png'], check=True)
    fr = [np.array(Image.open(x)).astype(int) for x in sorted(glob.glob(fd + '/*.png'))]
    assert len(fr) == 90, f
    steps = [np.abs(fr[i + 1] - fr[i]).mean() for i in range(89)]
    seam = np.abs(fr[-1] - fr[0]).mean() / max(0.05, np.mean(steps))
    assert seam <= 2.5, (f, seam)
    a0 = fr[0][:, :, 3]
    assert 0.05 < (a0 == 0).mean() < 0.95 and a0.max() > 200, f  # real transparency + visible object
    if 'Serit' not in f:
        edge = np.concatenate([a0[:2].ravel(), a0[-2:].ravel(), a0[:, :2].ravel(), a0[:, -2:].ravel()])
        assert (edge > 40).mean() <= 0.01, f
    print('  ', os.path.basename(f), int(j['format']['size']), 'B', 'döngü', round(float(seam), 2))
ok(True, 'ffprobe + libvpx: VP9, 100×100, alfa, 30 FPS, 90 kare, ≤3 sn, ≤64 KB, tek video akışı (ses yok), kesintisiz döngü')
print('CAMPAIGN EMOJIS OK')
