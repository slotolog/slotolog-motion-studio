import os, sys, time, json
from playwright.sync_api import sync_playwright
# Music Edition şablonu + elle ritim ızgarası + normalleştirme + Beat Jump/Turn (telifsiz test müziğiyle)
out = os.path.abspath(sys.argv[1])
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
SONG = os.path.join(os.path.dirname(__file__), '..', 'fixtures', 'test-song-128bpm.mp3')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_page(viewport={'width': 1512, 'height': 900})
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    pg.click('[data-testid=template-bombparty2music]'); time.sleep(1.2)
    assert pg.locator('input').first.input_value() == 'Slotolog Bomb Party 2.0 — Music Edition'
    # works without music (no errors, bombs present)
    assert pg.locator('text=/^1000X bomba \\d$/').count() == 10
    kinds = pg.evaluate("[...new Set(window.__slotolog.getState().project.layers.flatMap(l=>l.effects.map(e=>e.type)))]")
    assert 'beatJump' in kinds and 'beatTurn' in kinds, kinds
    pg.evaluate("window.__slotolog.getState().setFrame(0)")
    pg.click('button:has-text("Medya")'); pg.set_input_files('[data-testid=upload]', [SONG])
    pg.wait_for_selector('[data-testid=user-asset]')
    pg.locator('[data-testid=user-asset] button:has-text("Ekle")').first.click()
    pg.wait_for_function("window.__slotolog.getState().project.assets.some(a => a.analysis)", timeout=60000)
    # manual grid via the editor UI: halve the tempo, then check
    pg.click('[data-testid=beat-grid] summary')
    pg.locator('[data-testid=beat-grid] button:has-text("÷2")').click(); time.sleep(0.5)
    an = pg.evaluate("window.__slotolog.getState().project.assets.find(a=>a.analysis).analysis")
    print('elle ızgara:', an['bpm'], 'BPM, manual =', an.get('manual'), ', vuruş', len(an['beats']))
    assert an.get('manual') and abs(an['bpm'] - 64) < 0.6
    pg.locator('[data-testid=beat-grid] button:has-text("×2")').click(); time.sleep(0.5)
    # normalize
    pg.locator('button:has-text("Normalleştir")').click(); time.sleep(2)
    gain = pg.evaluate("window.__slotolog.getState().project.layers.find(l=>l.type==='audio').volume")
    peak = pg.evaluate("window.__slotolog.getState().project.assets.find(a=>a.analysis).analysis.peak")
    print('normalleştirme: tepe', peak, '→ kazanç', gain); assert peak and abs(gain - min(8, 10**(-1.5/20)/peak)) < 0.02
    # beat jump visibly moves a bomb right after a strong beat
    strong = pg.evaluate("""(()=>{const p=window.__slotolog.getState().project; const a=p.assets.find(a=>a.analysis).analysis; return a.beats.filter((b,i)=>a.strengths[i]>=1 && b>3 && b<8)})()""")
    t = strong[0]
    def bomb_top(frame):
        pg.evaluate(f"window.__slotolog.getState().setFrame({frame})")
        r = pg.locator('[data-testid=ruler]').bounding_box(); pg.mouse.click(r['x'] + frame * 3 + 1, r['y'] + 5); time.sleep(0.5)
        return pg.evaluate("""(()=>{const c=[...document.querySelectorAll('[data-stage] canvas')].filter(c=>c.width===390); const r=c[0].getBoundingClientRect(); return r.top + r.height / 2})()""")
    before = bomb_top(round(t * 30) - 3); peakf = bomb_top(round((t + 0.2) * 30))
    print(f'güçlü vuruş {t:.2f}s: bomba merkezi {before:.1f}px → {peakf:.1f}px'); assert peakf < before - 3, 'Beat Jump yok'
    assert not errs, errs
    print('MUSIC EDITION OK')
    b.close()
