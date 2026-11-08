"""
Bir şablonu + kullanıcının kendi müziğini birleştirip düzenlenebilir proje (.slotolog.json) ve MP4 üretir.
Müzik dosyası ve şarkıya özel ayarlar (config) repoya GİRMEZ; yalnızca yerel olarak kullanılır.

Kullanım: python3 tools/build_music_project.py <config.json> <çıktı klasörü> [--render]
config örneği:
{
  "template": "bombparty2music", "song": "/yol/sarki.mp3", "name": "Proje adı",
  "trimStart": 159.634, "fadeOut": 1.5, "grid": {"bpm": 97.02, "firstBeat": 0.105, "beatsPerBar": 4},
  "sections": [{"label": "Nakarat", "start": 0, "end": 18, "boost": 1.2}],
  "mix": {"musicVolume": 0.85, "sfxVolume": 0.45},
  "layerStarts": {"1000X bomba 1": 0.018},
  "script": "JS: (st, P, L, fx, s) => { ... }  // isteğe bağlı ek düzenlemeler"
}
"""
import json, os, sys, time
from playwright.sync_api import sync_playwright

cfg = json.load(open(sys.argv[1]))
out = os.path.abspath(sys.argv[2]); os.makedirs(out, exist_ok=True)
render = '--render' in sys.argv
URL = os.environ.get('BASE_URL', 'http://localhost:4173/')

with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1512, 'height': 900}, accept_downloads=True)
    pg = ctx.new_page()
    errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_selector('[data-testid=play]')
    pg.click(f"[data-testid=template-{cfg['template']}]"); time.sleep(1.2)
    pg.evaluate("window.__slotolog.getState().setFrame(0)")
    pg.click('button:has-text("Medya")')
    pg.set_input_files('[data-testid=upload]', [cfg['song']])
    pg.wait_for_selector('[data-testid=user-asset]', timeout=60000)
    pg.locator('[data-testid=user-asset] button:has-text("Ekle")').first.click()
    pg.wait_for_function("window.__slotolog.getState().project.assets.some(a => a.kind==='audio' && a.analysis)", timeout=120000)
    auto = pg.evaluate("(()=>{const a=window.__slotolog.getState().project.assets.find(a=>a.kind==='audio'); return {bpm:a.analysis.bpm, beats:a.analysis.beats.length}})()")
    print('otomatik algılama:', auto)
    result = pg.evaluate("""async (cfg) => {
      const st = window.__slotolog.getState;
      const P = st().project; const fps = P.fps; const s = (sec) => Math.round(sec * fps);
      const asset = P.assets.find(a => a.kind === 'audio');
      if (cfg.grid) st().setBeatGrid(asset.id, cfg.grid);
      const music = st().project.layers.find(l => l.type === 'audio' && l.assetId === asset.id);
      st().updateLayer(music.id, { name: 'Müzik: ' + asset.name, start: 0, duration: st().project.durationInFrames,
        trimStart: cfg.trimStart || 0, fadeIn: cfg.fadeIn || 0, fadeOut: cfg.fadeOut || 0, volume: 1, channel: 'music' });
      if (cfg.normalizeDb !== undefined) await st().normalizeLayer(music.id, cfg.normalizeDb);
      st().setAudio({ ...(cfg.mix || {}), sections: (cfg.sections || []).map((x, i) => ({ id: 'sec' + i, ...x })) });
      for (const [name, sec] of Object.entries(cfg.layerStarts || {})) {
        const l = st().project.layers.find(l => l.name === name);
        if (l) st().updateLayer(l.id, { start: s(sec), duration: st().project.durationInFrames - s(sec) });
      }
      if (cfg.script) { const fn = eval(cfg.script); fn(st, st().project, (n) => st().project.layers.find(l => l.name === n), s); }
      st().rename(cfg.name);
      const p = st().project;
      const ml = p.layers.find(l => l.type === 'audio' && l.channel === 'music');
      return { layers: p.layers.length, grid: p.assets.find(a => a.kind === 'audio').analysis.bpm, musicGain: ml.volume, peak: p.assets.find(a => a.kind === 'audio').analysis.peak };
    }""", cfg)
    print('proje:', result)
    time.sleep(1.5)
    with pg.expect_download() as dl:
        pg.click('button:has-text("Proje dosyası indir")')
    pf = os.path.join(out, cfg.get('file', 'project') + '.slotolog.json'); dl.value.save_as(pf)
    print('proje dosyası:', pf, os.path.getsize(pf) // 1024, 'KB')
    sched = pg.evaluate("""(()=>{const p=window.__slotolog.getState().project; const o=[];
      for(const l of p.layers){ if(!l.visible) continue;
        if(l.type==='audio' && l.channel==='sfx'){ const a=p.assets.find(x=>x.id===l.assetId); o.push({t:l.start/p.fps,s:a.src.replace('sfx/','').replace('.wav',''),v:(l.volume??1),who:l.name}); }
        if(l.startSound) o.push({t:l.start/p.fps,s:l.startSound,v:l.startSoundVolume??0.7,who:l.name});
        for(const e of l.effects) if(e.sound) o.push({t:(l.start+Math.max(0,e.start))/p.fps,s:e.sound,v:e.soundVolume??0.7,who:l.name+' / '+e.type}); }
      return {sched:o.sort((a,b)=>a.t-b.t), sfxVol:p.audio.sfxVolume, musicVol:p.audio.musicVolume};})()""")
    json.dump(sched, open(os.path.join(out, 'sfx_schedule.json'), 'w'), ensure_ascii=False, indent=1)
    if render:
        pg.click('[data-testid=export]')
        t0 = time.time()
        with pg.expect_download(timeout=3000000) as dl:
            pg.click('[data-testid=start-export]')
            while not pg.locator('[data-testid=export-done], [data-testid=export-error]').count():
                time.sleep(10)
                pr = pg.locator('[data-testid=export-progress]')
                if pr.count(): print(round(time.time() - t0), pr.inner_text().replace('\n', ' '), flush=True)
            if pg.locator('[data-testid=export-error]').count(): print(pg.locator('[data-testid=export-error]').inner_text())
        mp4 = os.path.join(out, cfg.get('file', 'project') + '.mp4'); dl.value.save_as(mp4)
        time.sleep(1); print('uygulama içi doğrulama:', pg.locator('[data-testid=export-check]').inner_text())
        print('MP4:', mp4)
    assert not errs, errs
    b.close()
