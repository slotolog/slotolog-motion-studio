import os, sys, time
from playwright.sync_api import sync_playwright
# Premium şablon + marka varlıkları: logo ve 1000X görselleri gerçekten yükleniyor mu, katmanlar çakışıyor mu?
out = sys.argv[1]
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1512, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    pg.click('[data-testid=template-premium]'); time.sleep(1.5)
    assert pg.locator('input').first.input_value() == 'Slotolog Premium Bonus'
    r = pg.locator('[data-testid=ruler]').bounding_box()
    ppf = 3
    for sec in [0.3, 1.2, 2.2, 3.4, 4.6, 5.4, 6.5, 8.5, 12]:
        pg.mouse.click(r['x'] + sec * 30 * ppf, r['y'] + 5); time.sleep(0.7)
        pg.locator('[data-stage]').screenshot(path=f'{out}/premium_{sec}.png')
    imgs = pg.evaluate("[...document.querySelectorAll('[data-stage] img')].map(i=>[i.src.split('/').pop(), i.naturalWidth])")
    print('stage images:', imgs)
    assert any('slotolog-logo-white' in s and w == 1050 for s, w in imgs), 'logo yüklenmedi'
    assert any('multiplier-1000x' in s and w == 408 for s, w in imgs), '1000X yüklenmedi'
    pg.click('button:has-text("Medya")'); time.sleep(0.3)
    print('brand items:', pg.locator('[data-testid=brand-assets] img').count())
    assert not errs, errs
    print('PREMIUM OK')
    b.close()
