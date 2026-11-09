import os, sys, time, subprocess, json
from playwright.sync_api import sync_playwright
# Toplu Reklam Formatı Oluşturucu: 9:16 + 4:5 bağımsız projeler, yeniden yerleşim (kırpma yok), süre/ses/efektler aynı,
# tekrar oluşturmada kopya çoğalmaz, orijinal değişmez, format bilgili dosya adlarıyla MP4.
out = os.path.abspath(sys.argv[1])
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
S = "window.__slotolog.getState()"
F = "window.__slotologFormat"

def ok(cond, msg):
    print(('✓ ' if cond else '✗ ') + msg)
    assert cond, msg

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1512, 'height': 1000}, accept_downloads=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    downloads = []
    pg.on('download', lambda d: downloads.append(d))
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')

    # 1) yerleşim motoru: dört kreatif tipinde yeni çakışma / kesilen öğe yok
    for tpl in ['premium', 'bombparty2', 'bombparty2music', 'bigwinframe', 'premiumbigwin']:
        pg.click('button:has-text("Şablonlar")'); pg.click(f'[data-testid=template-{tpl}]'); time.sleep(0.8)
        r = pg.evaluate(f"""(() => {{ const s={S}.project; const v={F}.reformatProject(s,'4:5');
            const key = v.layers.filter(l => !['background','particles','camera','audio'].includes(l.type));
            const inside = key.every(l => l.y - l.height/2 >= -2 && l.y + l.height/2 <= 1352 && l.x - l.width/2 >= -2 && l.x + l.width/2 <= 1082);
            const full = v.layers.filter(l => l.type==='background' || l.type==='particles').every(l => l.width===1080 && l.height===1350);
            return {{ issues: {F}.layoutIssues(s, v).length, inside, full, dur: v.durationInFrames===s.durationInFrames,
                     fx: JSON.stringify(v.layers.map(l=>l.effects.length))===JSON.stringify(s.layers.map(l=>l.effects.length)),
                     minFont: Math.min(...v.layers.filter(l=>l.type==='text').map(l=>l.text.fontSize)) }} }})()""")
        ok(r['issues'] == 0 and r['inside'] and r['full'] and r['dur'] and r['fx'] and r['minFont'] >= 28,
           f"{tpl}: 4:5 yerleşim — çakışma yok, öğeler tuvalde, arka plan dolu, süre ve efektler aynı, en küçük yazı {r['minFont']} px")

    # 2) üst çubuktan 4:5 geçişi kırpmadan yeniden yerleştirir
    pg.click('button:has-text("Şablonlar")'); pg.click('[data-testid=template-premium]'); time.sleep(0.8)
    pg.click('button:has-text("4:5")'); time.sleep(0.4)
    logo = pg.evaluate(f"{S}.project.layers.find(l=>l.name==='Slotolog logo')")
    ok(pg.evaluate(f"{S}.project.aspect") == '4:5' and logo['y'] - logo['height'] / 2 > 0, f"üst çubukta 4:5: logo tam görünüyor (y={logo['y']})")
    pg.locator('[data-stage]').screenshot(path=f'{out}/format_4x5_premium.png')

    # 3) Toplu oluşturucu: kaynak projeyi kaydet, iki format oluştur
    pg.click('button:has-text("Şablonlar")'); pg.click('[data-testid=template-bombparty2]'); time.sleep(0.8)
    pg.evaluate(f"(() => {{ const st={S}; st.rename('Format Test Kreatif'); st.setDuration(45); }})()"); time.sleep(1.5)
    src = pg.evaluate(f"{S}.project")
    pg.click('[data-testid=open-format-builder]'); pg.wait_for_selector('[data-testid=fb-project]')
    ok(pg.locator('[data-testid=fb-project][data-name="Format Test Kreatif"]').is_checked(), 'açık proje seçili geliyor')
    pg.click('[data-testid=fb-make]')
    pg.wait_for_function("document.querySelectorAll('[data-testid=fb-row][data-status=tamam]').length===2", timeout=60000)
    files = pg.locator('[data-testid=fb-row] .font-mono').all_inner_texts()
    ok(files == ['Format-Test-Kreatif_9x16_1080x1920.mp4', 'Format-Test-Kreatif_4x5_1080x1350.mp4'], f'dosya adlarında format: {files}')
    ok(all(c == '0' for c in pg.locator('[data-testid=fb-issues]').evaluate_all("e=>e.map(x=>x.dataset.count)")), 'yerleşim kontrolü: yeni çakışma yok')
    # tekrar oluşturunca çoğalmaz
    pg.click('[data-testid=fb-make]'); time.sleep(0.5)
    pg.wait_for_function("document.querySelectorAll('[data-testid=fb-row][data-status=tamam]').length===2", timeout=60000)
    pg.click('[aria-label=Kapat]'); time.sleep(0.3)
    projs = pg.evaluate("""(async () => { const dbs = await new Promise(r => { const q = indexedDB.open('slotolog-projects'); q.onsuccess = () => r(q.result); });
        return await new Promise(r => { const t = dbs.transaction('projects').objectStore('projects').getAll(); t.onsuccess = () => r(t.result); }); })()""")
    names = sorted(x['name'] for x in projs)
    ok(names.count('Format Test Kreatif · 4:5 (1080×1350)') == 1 and names.count('Format Test Kreatif · 9:16 (1080×1920)') == 1, 'iki bağımsız proje kaydedildi, tekrar oluşturmada kopya çoğalmadı')
    orig = next(x for x in projs if x['id'] == src['id'])
    ok(json.dumps(orig['layers'], sort_keys=True) == json.dumps(src['layers'], sort_keys=True) and orig['aspect'] == '9:16', 'orijinal 9:16 proje değişmedi')
    v45 = next(x for x in projs if x['name'].endswith('4:5 (1080×1350)'))
    ok(v45['aspect'] == '4:5' and v45['durationInFrames'] == src['durationInFrames'] and v45['variantOf']['sourceId'] == src['id'], '4:5 proje: 1080×1350, süre aynı, kaynağa bağlı')
    ok(not set(a['id'] for a in v45['assets'] if not a.get('src')) & set(a['id'] for a in src['assets'] if not a.get('src')), 'kopya projenin medyası ayrı (birini silmek diğerini bozmaz)')

    # 4) MP4 toplu dışa aktarma
    pg.click('[data-testid=open-format-builder]'); pg.wait_for_selector('[data-testid=fb-project]')
    pg.click('[data-testid=fb-render]')
    pg.wait_for_function("document.querySelectorAll('[data-testid=fb-row][data-status=tamam]').length===2 && document.querySelectorAll('[data-testid=fb-check]').length===2", timeout=900000)
    checks = pg.locator('[data-testid=fb-check]').all_inner_texts()
    ok(checks[0].startswith('✓ 1080×1920') and checks[1].startswith('✓ 1080×1350'), f'MP4 doğrulandı: {checks}')
    time.sleep(1)
    got = {}
    for d in downloads:
        if d.suggested_filename.endswith('.mp4'):
            d.save_as(f'{out}/{d.suggested_filename}'); got[d.suggested_filename] = f'{out}/{d.suggested_filename}'
    ok(set(got) == {'Format-Test-Kreatif_9x16_1080x1920.mp4', 'Format-Test-Kreatif_4x5_1080x1350.mp4'}, f'iki MP4 indirildi: {sorted(got)}')
    assert not errs, errs
    b.close()

for name, (w, h) in [('Format-Test-Kreatif_9x16_1080x1920.mp4', (1080, 1920)), ('Format-Test-Kreatif_4x5_1080x1350.mp4', (1080, 1350))]:
    info = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_name,width,height:format=duration', '-of', 'json', f'{out}/{name}'], capture_output=True, text=True).stdout
    j = json.loads(info); v = [s for s in j['streams'] if s['codec_name'] == 'h264'][0]
    ok(v['width'] == w and v['height'] == h and abs(float(j['format']['duration']) - 1.5) < 0.1, f'{name}: {w}×{h}, {float(j["format"]["duration"]):.2f} sn')
print('FORMAT BUILDER OK')
