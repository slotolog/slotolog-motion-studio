import os
import sys, time
from playwright.sync_api import sync_playwright
out=sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width':1512,'height':900})
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(os.environ.get('BASE_URL','http://localhost:4173/')); pg.wait_for_selector('[data-testid=play]')
    pg.click('[data-testid=template-bonus]'); time.sleep(1)
    r = pg.locator('[data-testid=ruler]').bounding_box()
    pg.mouse.click(r['x'] + 110*3, r['y']+5); time.sleep(0.8)
    stage = lambda n: pg.locator('[data-stage]').screenshot(path=f'{out}/{n}.png')
    stage('b916')
    pg.click('button:has-text("16:9")'); time.sleep(0.8); stage('b169')
    pg.click('button:has-text("1:1")'); time.sleep(0.8); stage('b11')
    pg.keyboard.press('Control+z'); pg.keyboard.press('Control+z'); time.sleep(0.8)
    print('after 2x undo aspect active:', pg.locator('button.bg-\\[\\#FF8E16\\].text-black').first.inner_text())
    # click on a layer in preview to select it and check selection box
    st = pg.locator('[data-stage]').bounding_box()
    pg.mouse.click(st['x']+st['width']/2, st['y']+st['height']*0.78); time.sleep(0.4)
    print('selected:', pg.locator('[data-testid=inspector] input').first.input_value())
    pg.screenshot(path=f'{out}/bonus_ui.png')
    print('errors:', errs)
    b.close()
