import os, sys, time
from playwright.sync_api import sync_playwright
# Bomb Party 2.0: 5 bağımsız bomba, kamera katmanı, ses efektleri, kareler
out = sys.argv[1]
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
TIMES = [0.3, 0.9, 1.4, 2.0, 3.0, 5.2, 7.2, 10.6, 12.8, 14.0, 17.5]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(viewport={'width': 1512, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    pg.click('[data-testid=template-bombparty2]'); time.sleep(1.5)
    assert pg.locator('input').first.input_value() == 'Slotolog 1000X Bomb Party 2.0'
    n = pg.locator('text=/^1000X bomba \\d$/').count()
    print('bomb layer labels (etiket+çubuk):', n); assert n == 10
    assert pg.locator('text=Kamera').count() >= 1
    r = pg.locator('[data-testid=ruler]').bounding_box()
    for sec in TIMES:
        pg.mouse.click(r['x'] + sec * 30 * 3, r['y'] + 5); time.sleep(0.8)
        pg.locator('[data-stage]').screenshot(path=f'{out}/bp2_{sec}.png')
    # sound library visible and sfx files reachable
    pg.click('button:has-text("Medya")'); time.sleep(0.3)
    assert pg.locator('[data-testid=sfx-library] button:has-text("Ekle")').count() == 7  # whoosh, bounce, coins, sparkle, riser, button, rewind
    codes = pg.evaluate("Promise.all(['whoosh','bounce','coins','sparkle','riser','button','rewind'].map(k=>fetch('sfx/'+k+'.wav').then(r=>r.status)))")
    print('sfx http:', codes); assert all(c == 200 for c in codes)
    assert not errs, errs
    print('BOMB PARTY 2 OK')
    b.close()
