import sys, time, os
from playwright.sync_api import sync_playwright
out=os.path.abspath(sys.argv[1])
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1512,'height':900}, accept_downloads=True); pg=ctx.new_page()
    pg.goto(os.environ.get('BASE_URL','http://localhost:4173/')); pg.wait_for_selector('[data-testid=play]')
    pg.click('[data-testid=template-game]'); time.sleep(0.5)
    pg.click('button:has-text("Medya")'); pg.set_input_files('[data-testid=upload]', [f'{out}/icon.png'])
    pg.wait_for_selector('[draggable=true]'); pg.locator('button:has-text("Ekle")').first.click(); time.sleep(1)
    with pg.expect_download() as dl: pg.click('button:has-text("Proje dosyası indir")')
    f=f'{out}/roundtrip.slotolog.json'; dl.value.save_as(f); print('file KB', os.path.getsize(f)//1024)
    pg.click('[data-testid=template-bonus]') if pg.locator('[data-testid=template-bonus]').count() else (pg.click('button:has-text("Şablonlar")'), pg.click('[data-testid=template-bonus]'))
    time.sleep(0.5); print('now:', pg.locator('input').first.input_value())
    with pg.expect_file_chooser() as fc: pg.click('button:has-text("Dosya aç")')
    fc.value.set_files(f); time.sleep(1.5)
    print('imported:', pg.locator('input').first.input_value(), pg.locator('text=/KATMANLAR \\(\\d+\\)/').inner_text())
    pg.click('button:has-text("Medya")'); print('image thumbs:', pg.locator('[draggable=true] img').count())
    b.close()
