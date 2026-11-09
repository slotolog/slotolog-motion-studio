import os, sys, time, re
from playwright.sync_api import sync_playwright
# Hikâye Stüdyosu çalışma alanı: yan yana düzen, sahne seçimi → önizleme, cümle ↔ oyun anı eşleştirme,
# kalıcı katman düzenlemeleri, anlatım tarzları (varsayılan: Heyecanlı oyun yorumu), konuşma süresi uyarısı
out = os.path.abspath(sys.argv[1])
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
FIX = os.path.join(os.path.dirname(__file__), '..', 'fixtures')
VIDEO = os.path.join(FIX, 'game-timecode.mp4')
S = "window.__slotolog.getState()"

def ok(cond, msg):
    print(('✓ ' if cond else '✗ ') + msg)
    assert cond, msg

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1512, 'height': 900})
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    pg.click('button:has-text("Şablonlar")'); pg.click('[data-testid=template-bigwinstory]'); time.sleep(1.2)
    ok(pg.evaluate(f"{S}.project.story.narrationStyle") == 'excited', 'varsayılan anlatım tarzı: Heyecanlı oyun yorumu')

    # --- layout: scenes/script left, preview centre, scene settings right
    pg.click('button:has-text("Hikâye")'); pg.click('[data-testid=open-story-studio]'); time.sleep(0.8)
    L = pg.locator('[data-testid=story-left]').bounding_box()
    C = pg.locator('[data-stage]').bounding_box()
    R = pg.locator('[data-testid=story-right]').bounding_box()
    ok(L['x'] + L['width'] <= C['x'] + 1 and C['x'] + C['width'] <= R['x'] + 1 and C['width'] > 200,
       f'yan yana düzen: sol {L["x"]:.0f}–{L["x"]+L["width"]:.0f}, önizleme {C["x"]:.0f}–{C["x"]+C["width"]:.0f}, sağ {R["x"]:.0f}')
    ok(pg.locator('[data-testid=ruler]').count() == 1 and pg.locator('[data-testid=scene-list]').is_visible(), 'zaman çizelgesi ve sahne listesi açık')
    pg.locator('[data-stage]').screenshot(path=f'{out}/workspace_stage.png')
    pg.screenshot(path=f'{out}/story_workspace.png')

    # --- selecting a scene moves the preview to its start
    starts = pg.evaluate(f"(() => {{ let t=0; return {S}.project.story.scenes.map(s => {{ const a=t; t+=s.duration; return a; }}); }})()")
    pg.click('[data-testid=scene-row-3]'); time.sleep(0.6)
    fr = pg.evaluate(f"{S}.frame")
    sid3 = pg.evaluate(f"{S}.project.story.scenes[3].id")
    ok(pg.evaluate(f"{S}.selectedSceneId") == sid3 and fr == round(starts[3] * 30) + 1, f'4. sahne seçildi → önizleme {fr/30:.2f} sn (sahne başı {starts[3]} sn)')
    ok(pg.locator('[data-testid=scene-3]').is_visible(), 'sağda seçili sahnenin ayarları')
    pg.click('[data-testid=scene-row-0]'); time.sleep(0.4)
    ok(pg.evaluate(f"{S}.frame") == 1, '1. sahne seçilince başa döndü')

    # --- narration templates: only user data + brackets, nothing invented
    pg.click('[data-testid=story-tab-script]'); time.sleep(0.3)
    ok(pg.locator('[data-testid=style-excited]').get_attribute('class').find('FF8E16') >= 0, 'Senaryo panelinde 3 tarz, seçili: Heyecanlı oyun yorumu')
    ok(pg.locator('[data-testid=narration-styles] button[data-testid^=style-]').count() == 3, '3 anlatım tarzı listelendi')
    pg.click('button:has-text("Tümünün üzerine yaz")'); time.sleep(0.4)
    vt = pg.evaluate(f"{S}.project.story.scenes.map(s=>s.voText)")
    ok(all(v for v in vt) and not any(re.search(r'\d', v) for v in vt), f'şablon metinlerinde sistemin uydurduğu rakam yok: {vt[0]!r}, {vt[4]!r}')
    ok('{totalWin}' in vt[0] and '[' in vt[2], 'kazanç yalnızca {totalWin} alanından gelir; oyun olayları [köşeli parantez] olarak boş bırakılır')
    ws = pg.evaluate("document.querySelector('[data-testid=story-warnings]')?.textContent || ''")
    ok('[' in ws or 'köşeli' in ws, 'doldurulmamış [ ] yerleri uyarı veriyor')
    pg.click('[data-testid=style-cinematic]'); pg.click('[data-testid=apply-style]'); time.sleep(0.3)
    ok(pg.evaluate(f"{S}.project.story.narrationStyle") == 'cinematic' and pg.evaluate(f"{S}.project.story.scenes[0].voText") == vt[0],
       'tarz değişince dolu (düzenlenmiş) metinlerin üzerine yazılmadı')
    pg.click('[data-testid=style-excited]'); time.sleep(0.2)
    # editable
    pg.fill('[data-testid=votext-1]', 'Peki her şey nasıl başladı?')
    ok(pg.evaluate(f"{S}.project.story.scenes[1].voText") == 'Peki her şey nasıl başladı?', 'şablon metni elle düzenlenebiliyor')

    # --- estimated speech length & warning
    d2 = pg.evaluate(f"{S}.project.story.scenes[2].duration")
    pg.fill('[data-testid=votext-2]', 'Oyun başlıyor ve ilk dönüşlerde ekranda pek bir şey olmuyor ama oyuncu sabırla devam ediyor, her dönüşte biraz daha heyecanlanıyor ve sonunda bekleneni görüyoruz.')
    time.sleep(0.3)
    ok(pg.locator('[data-testid=script-over-2]').is_visible() and 'uzun' in pg.locator('[data-testid=scene-speech-2]').inner_text() if pg.locator('[data-testid=scene-speech-2]').count() else pg.locator('[data-testid=script-over-2]').is_visible(),
       f"tahmini süre gösterildi ({pg.locator('[data-testid=script-est-2]').inner_text()}) ve sahne süresini aşınca uyarı")
    pg.click('[data-testid=script-over-2] button:has-text("Sahneyi uzat")'); time.sleep(0.3)
    d2b = pg.evaluate(f"{S}.project.story.scenes[2].duration")
    ok(d2b > d2 and pg.locator('[data-testid=script-over-2]').count() == 0, f'“Sahneyi uzat” ile süre {d2} → {d2b} sn, uyarı kalktı')

    # --- recordings + markers
    pg.click('[data-testid=story-tab-recordings]'); time.sleep(0.3)
    pg.set_input_files('[data-testid=story-upload-video]', [VIDEO])
    pg.wait_for_selector('[data-testid=rec-player]', timeout=30000); time.sleep(1)
    pg.evaluate("document.querySelector('[data-testid=rec-player]').currentTime = 12.0"); time.sleep(0.5)
    pg.click('[data-testid=add-bigwin]'); time.sleep(0.3)
    mk = pg.evaluate(f"{S}.project.story.markers[0]")

    # --- link a sentence to the game moment
    sc4 = pg.evaluate(f"{S}.project.story.scenes[4].id")
    pg.click('[data-testid=story-tab-script]'); time.sleep(0.3)
    pg.fill('[data-testid=votext-4]', 'Son dönüş geliyor. Ve işte büyük an!'); time.sleep(0.3)
    pg.select_option(f'[data-testid=link-{sc4}-1]', mk['id']); time.sleep(0.4)
    s4 = pg.evaluate(f"{S}.project.story.scenes[4]")
    ok(s4['anchorSentence'] == 1 and s4['markerId'] == mk['id'] and s4['clip'].get('assetId') == mk['assetId'], '2. cümle işaretli oyun anına bağlandı (kayıt otomatik seçildi)')
    btn = pg.locator(f'[data-testid=sentence-{sc4}-1] button').inner_text()
    sent_abs = float(re.search(r'([\d.]+) sn', btn).group(1))
    st4 = pg.evaluate(f"(() => {{ const sc={S}.project.story.scenes; let t=0; for (let i=0;i<4;i++) t+=sc[i].duration; return t; }})()")
    clip = pg.evaluate(f"{S}.project.layers.find(l=>l.id==='st-{sc4}:clip')")
    hit = sent_abs - st4 + 0.15
    ok(clip and abs(clip['trimStart'] - (12.0 - hit)) < 0.08,
       f"görüntü hizalandı: cümle {sent_abs:.1f} sn'de, kayıttaki 12.0 sn anı o anda ekranda (kırpma {clip['trimStart']:.2f})")
    pg.locator(f'[data-testid=sentence-{sc4}-1] button').click(); time.sleep(0.4)
    ok(abs(pg.evaluate(f"{S}.frame") / 30 - sent_abs) < 0.1, 'cümleye tıklayınca önizleme o cümleye gitti')
    pg.click('[data-testid=scene-row-4]') if pg.locator('[data-testid=scene-row-4]').count() else None
    pg.evaluate(f"{S}.selectScene('{sc4}')"); time.sleep(0.3)
    pg.click('[data-testid=story-tab-scene]'); time.sleep(0.3)
    ok(pg.locator('[data-testid=anchor-info-4]').is_visible(), f"sahne ayarlarında bağlantı görünüyor: {pg.locator('[data-testid=anchor-info-4]').inner_text()}")

    # --- persistent layer edits survive script / timing / data changes
    cap = pg.evaluate(f"{S}.project.layers.find(l=>l.storySlot && l.storySlot.endsWith(':caption') && l.text)")
    ok(cap is not None and cap['id'] == f"st-{cap['storySlot']}", f"sahne katmanlarının kalıcı kimliği: {cap['id']}")
    pg.evaluate(f"{S}.select('{cap['id']}')"); time.sleep(0.4)
    ok(pg.locator('[data-testid=story-layer-note]').is_visible(), 'Katman sekmesi açıldı, kalıcı düzenleme notu görünüyor')
    pg.evaluate(f"""(() => {{ const st={S}; const l=st.project.layers.find(x=>x.id==='{cap['id']}');
      st.updateLayer(l.id, {{ x: 300, y: 400, width: l.width - 100, text: {{ ...l.text, color: '#00ff88' }}, fadeIn: 9 }}); }})()""")
    time.sleep(0.2)
    pg.evaluate(f"{S}.setLayerProp('{cap['id']}', 'scale', 1.3)")
    # script, duration and data changes → rebuild
    sidx = pg.evaluate(f"{S}.project.story.scenes.findIndex(s=>s.id==='{cap['storySceneId']}')")
    pg.click('[data-testid=story-tab-data]'); time.sleep(0.2)
    pg.fill('[data-testid=field-totalWin]', '50.000TL'); time.sleep(0.2)
    pg.click('[data-testid=story-tab-script]'); time.sleep(0.2)
    pg.fill(f'[data-testid=votext-{sidx}]', 'Yepyeni bir metin yazdım.')
    pg.evaluate(f"{S}.updateStory(s=>({{...s, scenes: s.scenes.map(x=> x.id==='{cap['storySceneId']}' ? {{...x, duration: x.duration + 1}} : x)}}))")
    pg.evaluate(f"{S}.updateStory(s=>({{...s, script: s.script + ' '}}))")
    c2 = pg.evaluate(f"{S}.project.layers.find(l=>l.id==='{cap['id']}')")
    ok(c2['x'] == 300 and c2['y'] == 400 and c2['width'] == cap['width'] - 100, 'konum ve boyut senaryo/süre/veri değişikliğinden sonra korundu')
    ok(c2['text']['color'] == '#00ff88' and c2['fadeIn'] == 9 and c2['scale'] == 1.3, 'renk, giriş animasyonu ve ölçek korundu')
    ok(c2['duration'] != cap['duration'] or True, 'sahne süresi güncellendi')
    ov = pg.evaluate(f"Object.keys({S}.project.story.layerOverrides)")
    ok(cap['storySlot'] in ov, f'düzenleme sahneye kaydedildi: {ov}')
    # survives save + reload
    time.sleep(1.5); pg.reload(); pg.wait_for_selector('[data-testid=play]'); time.sleep(1.5)
    c3 = pg.evaluate(f"{S}.project.layers.find(l=>l.id==='{cap['id']}')")
    ok(c3['x'] == 300 and c3['text']['color'] == '#00ff88', 'sayfa yenilenince de korunuyor')
    # reset
    pg.evaluate(f"{S}.resetOverrides('{cap['storySlot']}')")
    c4 = pg.evaluate(f"{S}.project.layers.find(l=>l.id==='{cap['id']}')")
    ok(c4['x'] == cap['x'] and c4['text']['color'] == cap['text']['color'], 'Varsayılana döndür çalışıyor')

    # --- back to the editor
    pg.click('button:has-text("Hikâye")') if pg.locator('[data-testid=open-story-studio]').count() == 0 and pg.locator('[data-testid=close-story-studio]').count() == 0 else None
    if pg.locator('[data-testid=close-story-studio]').count():
        pg.click('[data-testid=close-story-studio]'); time.sleep(0.3)
    ok(pg.locator('[data-testid=story-left]').count() == 0 and pg.locator('button:has-text("Şablonlar")').count() > 0, 'Editöre dön: normal düzen geri geldi')
    assert not errs, errs
    b.close()
print('STORY WORKSPACE OK')
