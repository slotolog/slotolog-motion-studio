import os, sys, time
from playwright.sync_api import sync_playwright
# 1000X Bomb Party şablonu: 5 ayrı bomba katmanı, görseller, ışık yansıması kanvası ve kareler
out = sys.argv[1]
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1512, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    pg.click('[data-testid=template-bombparty]'); time.sleep(1.5)
    assert pg.locator('input').first.input_value() == 'Slotolog 1000X Bomb Party'
    names = pg.locator('text=/^1000X bomba \\d$/').count()
    print('bomb layers in timeline (etiket + çubuk):', names); assert names == 10
    r = pg.locator('[data-testid=ruler]').bounding_box()
    for sec in [0.2, 0.8, 1.6, 2.4, 3.2, 5, 7.1, 9.6, 12, 17.5]:
        pg.mouse.click(r['x'] + sec * 30 * 3, r['y'] + 5); time.sleep(0.8)
        pg.locator('[data-stage]').screenshot(path=f'{out}/bomb_{sec}.png')
    canv = pg.evaluate("document.querySelectorAll('[data-stage] canvas').length")
    print('stage canvases (bg+particles+5 shine bombs):', canv); assert canv >= 5 + 5
    # select a bomb from the timeline and replace the image is possible
    pg.locator('text=1000X bomba 3').first.click(); time.sleep(0.3)
    assert pg.locator('[data-testid=inspector] input').first.input_value() == '1000X bomba 3'
    assert pg.locator('[data-testid=inspector] >> text=Işık yansıması').count() >= 1
    assert not errs, errs
    print('BOMB PARTY OK')
    b.close()
