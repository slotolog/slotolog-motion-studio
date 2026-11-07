import os
import sys, time
from playwright.sync_api import sync_playwright
out = sys.argv[1]; template = sys.argv[2] if len(sys.argv)>2 else None
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width':1512,'height':900}, accept_downloads=True)
    pg = ctx.new_page()
    logs=[]
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type in ('error','warning') else None)
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    pg.goto(os.environ.get('BASE_URL','http://localhost:4173/'))
    pg.wait_for_selector('[data-testid=play]', timeout=20000)
    if template:
        pg.click(f'[data-testid=template-{template}]'); time.sleep(1)
    pg.click('[data-testid=export]')
    t0=time.time()
    with pg.expect_download(timeout=600000) as dl:
        pg.click('[data-testid=start-export]')
        while True:
            time.sleep(5)
            if pg.locator('[data-testid=export-error]').count():
                print('ERROR', pg.locator('[data-testid=export-error]').inner_text()); break
            if pg.locator('[data-testid=export-done]').count(): break
            if pg.locator('[data-testid=export-progress]').count():
                print(round(time.time()-t0), pg.locator('[data-testid=export-progress]').inner_text().replace('\n',' '), flush=True)
    d = dl.value
    path = f'{out}/{template or "default"}.mp4'
    d.save_as(path)
    print('saved', path, 'in', round(time.time()-t0),'s')
    print('\n'.join(logs[:30]))
    b.close()
