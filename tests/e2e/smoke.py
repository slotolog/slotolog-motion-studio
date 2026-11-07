import os
import sys, time
from playwright.sync_api import sync_playwright
out = sys.argv[1]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--enable-unsafe-swiftshader'])
    pg = b.new_page(viewport={'width':1512,'height':900}, accept_downloads=True)
    logs=[]
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    pg.goto(os.environ.get('BASE_URL','http://localhost:4173/'))
    pg.wait_for_selector('[data-testid=play]', timeout=20000)
    time.sleep(1)
    pg.evaluate("window.__s = 1")
    # seek to 6s via ruler click
    r = pg.locator('[data-testid=ruler]').bounding_box()
    pg.mouse.click(r['x'] + 6*30*3, r['y']+5)
    time.sleep(1)
    pg.screenshot(path=f'{out}/editor.png')
    print(pg.locator('[data-testid=time]').inner_text())
    print('\n'.join(logs[:40]))
    b.close()
