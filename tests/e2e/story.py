import os, sys, time, json, subprocess
import numpy as np
from playwright.sync_api import sync_playwright
# Büyük Kazanç Hikâyesi modülü: kayıt yükleme/işaret, sahneler, veri alanları, senaryo, seslendirme,
# altyazı, çerçeve, kaydet/aç, ana şablon, MP4 (oyun kaydının doğru saniyesi renk kodundan ölçülür)
out = os.path.abspath(sys.argv[1])
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')
FIX = os.path.join(os.path.dirname(__file__), '..', 'fixtures')
VIDEO = os.path.join(FIX, 'game-timecode.mp4')   # 20 sn, yeşil kanal = 12.75 × saniye
VOICE = os.path.join(FIX, 'voice-test.wav')      # 9 sn, 3 ton grubu (sentetik)
S = "window.__slotolog.getState()"

def ok(cond, msg):
    print(('✓ ' if cond else '✗ ') + msg)
    assert cond, msg

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1512, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    pg.click('button:has-text("Şablonlar")'); pg.click('[data-testid=template-bigwinstory]'); time.sleep(1.2)
    st = pg.evaluate(f"{S}.project.story")
    ok(len(st['scenes']) == 6 and [s['kind'] for s in st['scenes']] == ['hook', 'flashback', 'start', 'rising', 'bigwin', 'outro'], '6 bölümlü şablon')
    ok(st['fields']['totalWin'] == '' and st['fields']['betAmount'] == '', 'kazanç alanları boş başlıyor (sistem rakam üretmiyor)')
    ok(st['dramatization']['enabled'], 'canlandırma etiketi varsayılan açık')

    # --- studio: recordings + markers (UI)
    pg.click('button:has-text("Hikâye")'); pg.click('[data-testid=open-story-studio]'); time.sleep(0.6)
    pg.click('[data-testid=story-tab-recordings]'); time.sleep(0.3)
    pg.set_input_files('[data-testid=story-upload-video]', [VIDEO])
    pg.wait_for_selector('[data-testid=rec-player]', timeout=30000); time.sleep(1)
    pg.evaluate("document.querySelector('[data-testid=rec-player]').currentTime = 4.0"); time.sleep(0.5)
    pg.click('[data-testid=add-marker]')
    pg.evaluate("document.querySelector('[data-testid=rec-player]').currentTime = 12.0"); time.sleep(0.5)
    pg.click('[data-testid=add-bigwin]'); time.sleep(0.3)
    mk = pg.evaluate(f"{S}.project.story.markers")
    ok(len(mk) == 2 and abs(mk[1]['time'] - 12.0) < 0.05 and mk[1]['bigWin'], f"işaretler: {[(m['label'], m['time']) for m in mk]}")

    # --- data fields (UI) -> data-bound layers
    pg.click('[data-testid=story-tab-data]'); time.sleep(0.3)
    vals = {'gameName': 'Test Slot', 'betAmount': '20TL', 'totalWin': '84.250TL', 'freeSpinValue': '4TL'}
    for k, v in vals.items():
        pg.fill(f'[data-testid=field-{k}]', v)
    time.sleep(0.5)
    f = pg.evaluate(f"{S}.project.story.fields")
    ok(f['totalWin'] == '84.250TL' and f['gameName'] == 'Test Slot', 'veri alanları kaydedildi')

    # video duration field scales scenes (30 -> 15 s), then back
    pg.fill('[data-testid=story-duration]', '15'); pg.click('[data-testid=story-data] button:has-text("Uygula")'); time.sleep(0.4)
    ok(pg.evaluate(f"{S}.project.durationInFrames") == 450, 'video süresi alanı sahneleri orantılı ölçekledi (15 sn)')
    # --- scenes: clips, marker link, speed, zoom, reorder, durations (store API used by the UI)
    vid = pg.evaluate(f"{S}.project.assets.find(a=>a.kind==='video').id")
    pg.evaluate(f"""(() => {{ const st = {S}; const big = st.project.story.markers.find(m=>m.bigWin).id;
      st.updateStory(s => ({{ ...s, scenes: s.scenes.map((sc,i) => {{
        const d = [2, 1.5, 2, 2, 2, 1.5][i];
        const clip = {{ ...sc.clip, assetId: i < 5 ? '{vid}' : undefined }};
        if (i === 2) {{ clip.in = 2; clip.out = 4; }}
        if (i === 3) {{ clip.in = 5; clip.speed = 2; }}
        if (i === 4) {{ clip.zoom = 1.4; clip.zoomX = 0.5; clip.zoomY = 0.4; }}
        return {{ ...sc, duration: d, clip, markerId: (i === 0 || i === 4) ? big : sc.markerId, hitAt: (i === 0 || i === 4) ? 1.0 : sc.hitAt }};
      }}) }})); }})()""")
    L = pg.evaluate(f"{S}.project.layers.filter(l=>l.storyRole==='scene' && l.type==='video').map(l=>({{n:l.name,start:l.start,dur:l.duration,trim:l.trimStart,rate:l.playbackRate,zoom:l.mediaZoom}}))")
    ok(len(L) == 5, f'5 sahne kaydı katmanı: {[x["n"] for x in L]}')
    ok(abs(L[0]['trim'] - 11.0) < 0.01, f"açılış: işarete göre kayıt 11.0 sn'den başlıyor (büyük kazanç 1.0 sn'de görünür) → {L[0]['trim']}")
    ok(L[3]['rate'] == 2 and abs(L[2]['trim'] - 2) < 0.01, 'hız (2×) ve elle kırpma (2 sn) uygulandı')
    ok(L[4]['zoom']['scale'] == 1.4, 'büyük kazanç sahnesinde yakınlaştırma')
    dur = pg.evaluate(f"{S}.project.durationInFrames")
    ok(dur == 330, f'proje süresi sahnelerin toplamı: {dur/30} sn')
    # reorder: move scene 2 down and back
    pg.evaluate(f"{S}.updateStory(s => {{ const a=[...s.scenes]; [a[1],a[2]]=[a[2],a[1]]; return {{...s, scenes:a}}; }})")
    kinds = pg.evaluate(f"{S}.project.story.scenes.map(s=>s.kind)")
    ok(kinds[1] == 'start' and kinds[2] == 'flashback', 'sahne sırası değişti')
    pg.evaluate(f"{S}.updateStory(s => {{ const a=[...s.scenes]; [a[1],a[2]]=[a[2],a[1]]; return {{...s, scenes:a}}; }})")

    # --- script (UI): split to scenes, estimate, fit
    pg.click('[data-testid=story-tab-script]'); time.sleep(0.3)
    pg.click('summary:has-text("Tüm metni")'); time.sleep(0.2)
    script = 'Bu kazanca kimse inanmadı!\n\nPeki nasıl başladı?\n\nKüçük bir bahisle oyuna girdi.\n\nFree spinler birbirini takip etti.\n\nSon dönüşte büyük kazanç geldi!\n\nSen de hemen katıl.'
    pg.fill('[data-testid=script]', script)
    pg.click('[data-testid=split-script]'); time.sleep(0.3)
    vt = pg.evaluate(f"{S}.project.story.scenes.map(s=>s.voText)")
    ok(vt[4] == 'Son dönüşte büyük kazanç geldi!' and vt[1] == 'Peki nasıl başladı?', 'metin sahnelere bölündü')
    warn = pg.evaluate(f"""(() => {{ const st={S}; st.updateStory(s=>({{...s, scenes: s.scenes.map((x,i)=> i===2 ? {{...x, voText: x.voText + ' ' + 'çok uzun bir açıklama cümlesi daha ekleniyor burada'.repeat(2)}} : x)}})); return true; }})()""")
    ws = pg.evaluate("document.querySelector('[data-testid=story-warnings]')?.textContent || ''")
    ok('tahmini okunma süresi' in ws, 'metin sahneden uzunsa uyarı veriyor')
    pg.evaluate(f"{S}.updateStory(s=>({{...s, scenes: s.scenes.map((x,i)=> i===2 ? {{...x, voText: 'Küçük bir bahisle oyuna girdi.'}} : x)}}))")

    # --- voice file (UI upload) + scene mapping + timeline drag write-back
    pg.set_input_files('[data-testid=story-upload-voice]', [VOICE]); time.sleep(2)
    aid = pg.evaluate(f"{S}.project.assets.find(a=>a.kind==='audio' && !a.src).id")
    pg.evaluate(f"{S}.updateStory(s=>({{...s, scenes: s.scenes.map((x,i)=> i===4 ? {{...x, voice: {{assetId:'{aid}', from: 6.0, to: 7.5, delay: 0.2}}}} : x)}}))")
    vl = pg.evaluate(f"{S}.project.layers.find(l=>l.type==='audio' && l.channel==='voice')")
    ok(vl is not None and abs(vl['trimStart'] - 6.0) < 0.01, 'seslendirme parçası sahneye bağlandı (kanal: seslendirme)')
    pg.evaluate(f"{S}.updateLayer('{vl['id']}', {{ start: {vl['start']} + 6 }})")
    d2 = pg.evaluate(f"{S}.project.story.scenes[4].voice.delay")
    ok(abs(d2 - 0.4) < 0.01, f'zaman çizelgesinde kaydırılan seslendirme sahneye yazıldı (gecikme {d2} sn)')
    pg.evaluate(f"{S}.updateStory(s=>({{...s, scenes: s.scenes.map((x,i)=> i===4 ? {{...x, voice: {{...x.voice, to: 9.0}}}} : x)}}))")
    ws = pg.evaluate("document.querySelector('[data-testid=story-warnings]')?.textContent || ''")
    ok('sahneden uzun' in ws, 'seslendirme sahneden uzun olunca uyarı')
    pg.evaluate(f"{S}.updateStory(s=>({{...s, scenes: s.scenes.map((x,i)=> i===4 ? {{...x, voice: {{...x.voice, to: 7.5}}}} : x)}}))")

    # --- subtitles (UI)
    pg.click('[data-testid=story-tab-subs]'); time.sleep(0.3)
    pg.click('[data-testid=gen-subs]'); time.sleep(0.3)
    cues = pg.evaluate(f"{S}.project.story.subtitles.cues")
    ok(len(cues) >= 6, f'{len(cues)} altyazı oluşturuldu')
    c4 = [c for c in cues if 'büyük kazanç' in c['text']][0]
    ok(abs(c4['start'] - (7.5 + 0.4)) < 0.05, f"büyük kazanç cümlesi seslendirmeyle başlıyor ({c4['start']} sn)")

    # --- frame toggle
    pg.click('[data-testid=story-tab-frame]'); time.sleep(0.3)
    pg.evaluate(f"{S}.updateStory(s=>({{...s, frameEnabled:false}}))")
    vis = pg.evaluate(f"{S}.project.layers.filter(l=>l.storyRole==='frame').map(l=>l.visible)")
    win_off = pg.evaluate(f"{S}.project.layers.find(l=>l.storyRole==='scene'&&l.type==='video').width")
    pg.evaluate(f"{S}.updateStory(s=>({{...s, frameEnabled:true}}))")
    vis2 = pg.evaluate(f"{S}.project.layers.filter(l=>l.storyRole==='frame').map(l=>l.visible)")
    ok(vis and not any(vis) and all(vis2) and win_off == 1080, 'çerçeve kapatılınca kayıt tam ekran, açılınca geri geliyor')

    pg.click('[data-testid=close-story-studio]'); time.sleep(0.5)
    # rendered text check: big win scene shows the entered amount, subtitle shows its sentence
    def seek(sec):
        fr = round(sec * 30); pg.evaluate(f"{S}.setFrame({fr})")
        r = pg.locator('[data-testid=ruler]').bounding_box(); pg.mouse.click(r['x'] + fr * 3 + 1, r['y'] + 5); time.sleep(0.8)
    seek(8.3)
    txt = pg.evaluate("[...document.querySelectorAll('[data-stage] svg text')].map(t=>t.textContent).join(' | ')")
    ok('84.250TL' in txt and 'Son dönüşte' in txt, 'önizlemede kazanç tutarı ve altyazı görünüyor')
    pg.locator('[data-stage]').screenshot(path=f'{out}/story_bigwin.png')

    # --- persistence: reload
    time.sleep(1.5); pg.reload(); pg.wait_for_selector('[data-testid=play]'); time.sleep(1.5)
    st2 = pg.evaluate(f"{S}.project.story")
    ok(st2['fields']['totalWin'] == '84.250TL' and len(st2['markers']) == 2 and len(st2['subtitles']['cues']) == len(cues), 'sayfa yenilenince hikâye geri geldi')

    # --- MP4: correct source seconds on screen + audio
    pg.click('[data-testid=export]')
    with pg.expect_download(timeout=1200000) as dl:
        pg.click('[data-testid=start-export]')
        while not pg.locator('[data-testid=export-done], [data-testid=export-error]').count(): time.sleep(3)
        if pg.locator('[data-testid=export-error]').count(): print(pg.locator('[data-testid=export-error]').inner_text())
    dl.value.save_as(f'{out}/story.mp4'); time.sleep(1)
    chk = pg.locator('[data-testid=export-check]').inner_text(); ok(chk.startswith('✓') and '330 kare' in chk, f'uygulama içi doğrulama: {chk}')

    # --- save as master template, create a new video from it
    pg.locator('button[aria-label=Kapat]').first.click(); time.sleep(0.4)
    pg.click('button:has-text("Şablonlar")'); time.sleep(0.3)
    pg.fill('[data-testid=user-templates] input', 'Ana BK şablonu'); pg.click('[data-testid=save-template]'); time.sleep(1)
    pg.locator('[data-testid=user-templates] div:has-text("Ana BK şablonu") button:has-text("Aç")').first.click(); time.sleep(1.5)
    st3 = pg.evaluate(f"{S}.project.story")
    ok(st3['fields']['totalWin'] == '' and st3['fields']['bonusAmount'] == st['fields']['bonusAmount'] and len(st3['markers']) == 0 and len(st3['scenes']) == 6
       and [s['duration'] for s in st3['scenes']] == [2, 1.5, 2, 2, 2, 1.5],
       'ana şablondan yeni video: düzen/süreler korunur, kayıtlar ve kazanç tutarı temizlenir')
    assert not errs, errs
    b.close()

# MP4 checks outside the browser
info = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,width,height,nb_read_frames:format=duration', '-of', 'compact', f'{out}/story.mp4'], capture_output=True, text=True).stdout
print(info.strip()); assert '1080' in info and 'audio' in info
def src_sec(t, x=540, y=820):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(t), '-i', f'{out}/story.mp4', '-frames:v', '1', '-vf', f'crop=24:24:{x-12}:{y-12},scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    r, g, bl = raw[0], raw[1], raw[2]
    # blue = 255 - 12.75 × second in the test recording (green is tinted by the warm frame light)
    return (255 - bl) / 12.75, (r, g, bl)
# scene starts: 0, 2, 3.5, 5.5, 7.5, 9.5 ; hook shows marker (12 s) at 1.0 s; start shows 2 s + t; rising 5 s + 2×t
checks = [(1.0, 12.0, 'açılış: işaretli büyük kazanç anı (12 sn) 1. saniyede'), (3.5 + 1.0, 3.0, 'başlangıç: kayıt 2 sn’den + 1 sn'), (5.5 + 1.0, 7.0, 'yükseliş: 5 sn’den 2× hızla (+2 sn)')]
for t, want, label in checks:
    got, rgb = src_sec(t, 150, 1100)
    print(f'{label}: MP4 {t:.1f} sn → kayıt {got:.2f} sn (renk {rgb})')
    assert abs(got - want) < 0.4, label
# audio: the voice-over part (scene 5, +0.4 s) is the only sound; game audio of the clips is muted
raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', f'{out}/story.mp4', '-ac', '1', '-ar', '22050', '-f', 's16le', '-'], capture_output=True).stdout
x = np.frombuffer(raw, np.int16) / 32768
rms = lambda t0, t1: 20 * np.log10(np.sqrt((x[int(t0 * 22050):int(t1 * 22050)] ** 2).mean()) + 1e-12)
env = np.array([np.sqrt((x[i:i + 220] ** 2).mean()) for i in range(0, len(x) - 220, 220)])
onset = np.argmax(env > 0.02) * 220 / 22050
print(f'seslendirme: {rms(8.0, 9.2):.1f} dBFS, öncesi {rms(1, 7.5):.1f} dBFS, başlangıç {onset:.2f} sn (beklenen 7.90)')
assert rms(8.0, 9.2) > -30 and rms(1, 7.5) < -80 and abs(onset - 7.9) < 0.06, 'seslendirme zamanı/seviyesi yanlış'
print('STORY OK')
