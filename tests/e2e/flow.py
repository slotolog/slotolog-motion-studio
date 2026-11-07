import sys, time, os
from playwright.sync_api import sync_playwright
out = os.path.abspath(sys.argv[1])
def val(pg, label):
    return pg.locator(f'[data-testid=inspector] label:has-text("{label}") input').first.input_value()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--enable-unsafe-swiftshader'])
    ctx = b.new_context(viewport={'width':1512,'height':900}, accept_downloads=True)
    pg = ctx.new_page()
    logs=[]
    pg.on('pageerror', lambda e: logs.append(f'PAGEERROR: {e}'))
    pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}') if m.type=='error' and 'TUNNEL' not in m.text and '404' not in m.text else None)
    pg.goto(os.environ.get('BASE_URL','http://localhost:4173/')); pg.wait_for_selector('[data-testid=play]')
    pg.click('[data-testid=template-game]'); time.sleep(1)
    pg.click('button:has-text("Medya")')
    pg.set_input_files('[data-testid=upload]', [f'{out}/game.mp4', f'{out}/icon.png', f'{out}/music.mp3'])
    pg.wait_for_function("document.querySelectorAll('[data-testid=user-asset]').length===3", timeout=20000)
    print('assets uploaded: 3')
    # select placeholder via timeline label and replace with video
    pg.click('text=Oyun videosu (değiştir) >> nth=0'); time.sleep(0.3)
    pg.locator('[data-testid=user-asset]').nth(0).locator('button[title="Seçili katmana uygula"]').click(); time.sleep(1)
    print('video layer name:', pg.locator('[data-testid=inspector] input').first.input_value())
    # add icon as layer
    pg.locator('[data-testid=user-asset]').nth(1).locator('button:has-text("Ekle")').click(); time.sleep(0.5)
    x0 = val(pg,'X konumu'); print('icon x before drag', x0)
    # drag in preview: icon is centred on the stage
    st = pg.locator('[data-stage]').bounding_box()
    cx, cy = st['x']+st['width']/2, st['y']+st['height']/2
    pg.mouse.move(cx, cy); pg.mouse.down(); pg.mouse.move(cx-60, cy-40, steps=8); pg.mouse.up(); time.sleep(0.3)
    print('icon x/y after drag', val(pg,'X konumu'), val(pg,'Y konumu'))
    # keyframes: at frame 0 toggle X keyframe, then seek 2s and set X
    pg.locator('[data-testid=inspector] label:has-text("X konumu") button').click()
    r = pg.locator('[data-testid=ruler]').bounding_box()
    pg.mouse.click(r['x'] + 60*3, r['y']+5); time.sleep(0.4)
    inp = pg.locator('[data-testid=inspector] label:has-text("X konumu") input')
    inp.fill('900'); inp.press('Tab'); time.sleep(0.3)
    pg.mouse.click(r['x'] + 30*3, r['y']+5); time.sleep(0.4)
    print('X at 1s (interpolated):', val(pg,'X konumu'))
    # effect
    pg.click('button:has-text("Efektler") >> nth=0'); pg.click('button:has-text("Zıplama")'); time.sleep(0.3)
    print('effects on icon:', pg.locator('[data-testid=inspector] >> text=Zıplama').count())
    # audio
    pg.click('button:has-text("Medya")'); pg.locator('[data-testid=user-asset]').nth(2).locator('button:has-text("Ekle")').click()
    # shorten project to 3s
    d = pg.locator('text=Süre (sn) >> xpath=following-sibling::div//input').first
    d.fill('3'); d.press('Tab'); time.sleep(1.5)
    pg.screenshot(path=f'{out}/flow.png')
    nlayers = pg.locator('text=/KATMANLAR \\(\\d+\\)/').inner_text(); print(nlayers, pg.locator('[data-testid=save-state]').inner_text())
    # reload -> persisted?
    pg.reload(); pg.wait_for_selector('[data-testid=play]'); time.sleep(1)
    print('after reload:', pg.locator('text=/KATMANLAR \\(\\d+\\)/').inner_text(), '| title:', pg.locator('input').first.input_value())
    pg.click('button:has-text("Medya")'); print('assets after reload:', pg.locator('[data-testid=user-asset] img, [data-testid=user-asset] video').count(), 'thumbs')
    pg.click('[data-testid=open-projects]'); time.sleep(0.5)
    print('saved projects:', pg.locator('[data-testid=project-list] > div').count())
    pg.keyboard.press('Escape'); pg.mouse.click(5,5)
    pg.locator('button:has-text("✕")').first.click() if pg.locator('text=Projelerim >> nth=1').count() else None
    time.sleep(0.3)
    pg.click('[data-testid=export]')
    with pg.expect_download(timeout=300000) as dl:
        pg.click('[data-testid=start-export]')
        while not pg.locator('[data-testid=export-done], [data-testid=export-error]').count(): time.sleep(2)
        if pg.locator('[data-testid=export-error]').count(): print(pg.locator('[data-testid=export-error]').inner_text())
    dl.value.save_as(f'{out}/flow.mp4'); print('exported flow.mp4')
    print('\n'.join(logs[:20]))
    b.close()
