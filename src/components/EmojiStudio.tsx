import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player } from '@remotion/player';
import { useStore } from '../store';
import { MainComposition } from '../remotion/Main';
import { deleteProject, listProjects, loadProject, saveProject, assetUrlsFor, downloadBlob, type ProjectSummary } from '../lib/storage';
import { brandUrl } from '../lib/brand';
import { EMOJI_PRESETS, emojiProject } from '../lib/emojiTemplates';
import { fitReel, fitToLoop, reelFor, setEmojiSpeed, splitLayer, emojiProblems } from '../lib/emojiOps';
import { exportEmojiWebm, gifPreview, pngPreview, zipFiles, emojiFileName, TG, type TgReport } from '../lib/emoji';
import { DEFAULT_REEL, reelColumns, reelMinFrames } from '../lib/reel';
import { EMOJI_CATEGORIES, projectSize, type Project, type ReelAssemble } from '../types';
import { Btn } from './ui';

const SYMBOLS = [
  { src: 'decor/seven.svg', label: '7' },
  { src: 'decor/cherry.svg', label: 'Kiraz' },
  { src: 'decor/bell.svg', label: 'Çan' },
  { src: 'decor/gem.svg', label: 'Mücevher' },
  { src: 'decor/coin.svg', label: 'Coin' },
];

const H4: React.FC<{ children: React.ReactNode }> = ({ children }) => <h4 className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-wider text-[#FF8E16]">{children}</h4>;

const Num: React.FC<{ label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; testid?: string }> = ({ label, value, min, max, step = 1, onChange, testid }) => (
  <label className="flex items-center gap-2 text-[11px] text-neutral-300">
    <span className="w-28 shrink-0">{label}</span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="min-w-0 flex-1 accent-[#FF8E16]" data-testid={testid} />
    <span className="w-9 text-right font-mono text-neutral-400">{step < 1 ? value.toFixed(2) : value}</span>
  </label>
);

/** opens an emoji project (saves the current one first) */
export async function openEmoji(p: Project) {
  const st = useStore.getState();
  await saveProject(st.project);
  await st.loadIntoEditor(p);
}

/** Emoji Studio entry: create the first pack (all presets) or open the last emoji project */
export async function enterEmojiStudio() {
  const list = await listProjects();
  const em = list.find((x) => x.emoji);
  if (em) {
    const p = await loadProject(em.id);
    if (p) return openEmoji(p);
  }
  const made = EMOJI_PRESETS.find((x) => x.id === 'logo-assemble')!.make() as Project;
  await openEmoji(made);
}

/* ---------------- left panel ---------------- */

export const EmojiLeft: React.FC = () => {
  const project = useStore((s) => s.project);
  const selectedId = useStore((s) => s.selectedId);
  const [list, setList] = useState<ProjectSummary[]>([]);
  const [msg, setMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = async () => setList((await listProjects()).filter((x) => x.emoji));
  useEffect(() => {
    void refresh();
  }, [project.id, project.name, project.emoji?.category]);
  const st = useStore.getState();
  const sel = project.layers.find((l) => l.id === selectedId);
  const problems = emojiProblems(project);

  const create = async (id: string) => {
    const pr = EMOJI_PRESETS.find((x) => x.id === id)!;
    const made = pr.make();
    const arr = Array.isArray(made) ? made : [made];
    for (const p of arr.slice(1)) await saveProject(p);
    await openEmoji(arr[0]);
    void refresh();
  };
  const makePack = async () => {
    const all: Project[] = [];
    for (const pr of EMOJI_PRESETS) {
      const m = pr.make();
      all.push(...(Array.isArray(m) ? m : [m]));
    }
    // same name already in the library → that project is renewed, not duplicated
    const existing = await listProjects();
    let renewed = 0;
    for (const p of all) {
      const old = existing.find((x) => x.emoji && x.name === p.name);
      if (old) {
        p.id = old.id;
        renewed++;
      }
    }
    for (const p of all.slice(1)) await saveProject(p);
    await openEmoji(all[0]);
    setMsg(`✓ ${all.length} emoji projesi hazır${renewed ? ` (${renewed} tanesi yenilendi, kopya oluşmadı)` : ''}`);
    void refresh();
  };
  const fromImage = async (files: FileList) => {
    const f = files[0];
    if (!f) return;
    const p = emojiProject(f.name.replace(/\.[^.]+$/, ''), { category: 'Sağlayıcı logoları' });
    await openEmoji(p);
    const asset = await useStore.getState().addAssetFromFile(f);
    if (!asset) return;
    const s2 = useStore.getState();
    s2.addAssetLayer(asset.id);
    const l = s2.project.layers.at(-1);
    if (l) {
      const W = projectSize(s2.project).width;
      const k = Math.min((W * 0.92) / l.width, (W * 0.92) / l.height);
      s2.updateLayer(l.id, { width: Math.round(l.width * k), height: Math.round(l.height * k), x: W / 2, y: W / 2, objectFit: 'contain' });
    }
  };

  const setReel = (patch: Partial<ReelAssemble> | null) => {
    if (!sel) return;
    if (patch === null) return st.updateLayer(sel.id, { reel: undefined });
    st.updateLayer(sel.id, { reel: fitReel({ ...(sel.reel ?? DEFAULT_REEL), ...patch }, sel.duration) });
  };

  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'tr', { numeric: true }));
  const grouped = EMOJI_CATEGORIES.map((c) => ({ c, items: sorted.filter((x) => x.emoji?.category === c) }));
  const other = sorted.filter((x) => !EMOJI_CATEGORIES.includes(x.emoji?.category as (typeof EMOJI_CATEGORIES)[number]));

  return (
    <div className="h-full overflow-y-auto p-3 text-xs text-neutral-300" data-testid="emoji-left">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">Telegram Emoji Studio</h3>
        <span className="rounded bg-[#FF8E16]/15 px-1.5 py-0.5 text-[10px] text-[#FF8E16]">100×100 · WEBM VP9 · ≤3 sn</span>
      </div>

      <H4>Bu emoji</H4>
      <div className="space-y-1.5">
        <label className="flex items-center gap-2">
          <span className="w-20">Kategori</span>
          <select
            data-testid="emoji-category"
            className="min-w-0 flex-1 rounded border border-white/10 bg-[#121212] px-1 py-1"
            value={project.emoji?.category ?? 'Logo'}
            onChange={(e) => st.update((p) => ({ ...p, emoji: { ...(p.emoji ?? { category: 'Logo' }), category: e.target.value } }))}
          >
            {EMOJI_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <span className="w-20">Hız</span>
          {[0.75, 0.9, 1.1, 1.25].map((f) => (
            <Btn key={f} small onClick={() => st.update((p) => setEmojiSpeed(p, f))} data-testid={`emoji-speed-${f}`} title={f > 1 ? 'Daha hızlı (döngü kısalır)' : 'Daha yavaş (en fazla 3 sn)'}>
              {f > 1 ? '⏩' : '⏪'} ×{f}
            </Btn>
          ))}
        </div>
        <div className="text-[10px] text-neutral-500">
          Döngü: {project.durationInFrames} kare = {(project.durationInFrames / project.fps).toFixed(2)} sn @ {project.fps} FPS
        </div>
        <Btn
          small
          data-testid="emoji-fit-loop"
          onClick={() => {
            const r = fitToLoop(useStore.getState().project);
            st.update(() => r.project);
            setMsg(r.changed.length || r.warnings.length ? [...r.changed, ...r.warnings].join(' · ') : '✓ Tüm efektler zaten tam döngü');
          }}
        >
          ⟲ Döngüye uydur (kesintisiz)
        </Btn>
        {problems.length > 0 && (
          <div className="rounded border border-yellow-500/30 bg-yellow-500/10 p-1.5 text-[10px] text-yellow-300" data-testid="emoji-problems">
            {problems.map((x) => (
              <div key={x}>⚠ {x}</div>
            ))}
          </div>
        )}
        {msg && <p className="text-[10px] text-neutral-400" data-testid="emoji-msg">{msg}</p>}
      </div>

      <H4>Seçili katman</H4>
      {!sel || sel.type !== 'image' ? (
        <p className="text-[10px] text-neutral-500">Bir görsel katmanı seç: Slot Reel Assemble, parçalara ayırma. Konum, boyut, dönme, zıplama, sallanma, parlama ve keyframe’ler sağ panelde / zaman çizelgesinde.</p>
      ) : (
        <div className="space-y-1.5" data-testid="reel-panel">
          <div className="truncate text-neutral-100">{sel.name}</div>
          {!sel.reel ? (
            <Btn small variant="primary" data-testid="reel-apply" onClick={() => st.updateLayer(sel.id, { reel: reelFor(project, 4) })}>
              🎰 Slot Reel Assemble uygula
            </Btn>
          ) : (
            <>
              <div className="flex gap-1">
                <Btn small data-testid="reel-remove" onClick={() => setReel(null)}>
                  Makarayı kaldır
                </Btn>
                <span className="self-center text-[10px] text-neutral-500">
                  {reelColumns(sel.reel).length} makara · {reelMinFrames(sel.reel)}/{sel.duration} kare
                </span>
              </div>
              <Num label="Makara sayısı" value={reelColumns(sel.reel).length} min={2} max={10} testid="reel-columns" onChange={(n) => setReel({ cuts: Array.from({ length: n - 1 }, (_, i) => (i + 1) / n) })} />
              <label className="flex items-center gap-2 text-[11px]">
                <span className="w-28 shrink-0">Kesim noktaları</span>
                <input
                  data-testid="reel-cuts"
                  className="min-w-0 flex-1 rounded border border-white/10 bg-[#121212] px-1 py-0.5 font-mono text-[10px]"
                  defaultValue={sel.reel.cuts.map((c) => c.toFixed(3)).join(', ')}
                  key={sel.reel.cuts.join(',')}
                  onBlur={(e) => {
                    const cuts = e.target.value
                      .split(/[,; ]+/)
                      .map(Number)
                      .filter((v) => v > 0 && v < 1);
                    if (cuts.length) setReel({ cuts });
                  }}
                />
              </label>
              <Num label="Ayrılma" value={sel.reel.scatter} min={0} max={1} step={0.05} onChange={(v) => setReel({ scatter: v })} />
              <Num label="Yaylanma" value={sel.reel.bounce} min={0} max={1.5} step={0.05} onChange={(v) => setReel({ bounce: v })} />
              <Num label="İlk oturma (kare)" value={sel.reel.firstLand} min={12} max={70} onChange={(v) => setReel({ firstLand: v })} />
              <Num label="Makara arası (kare)" value={sel.reel.stagger} min={1} max={14} onChange={(v) => setReel({ stagger: v })} />
              <Num label="Sembol sayısı" value={sel.reel.spins} min={1} max={10} onChange={(v) => setReel({ spins: v })} />
              <label className="flex items-center gap-2 text-[11px]">
                <span className="w-28 shrink-0">Işıma rengi</span>
                <input type="color" value={sel.reel.glowColor} onChange={(e) => setReel({ glowColor: e.target.value })} />
                <label className="ml-2 flex items-center gap-1">
                  <input type="checkbox" checked={sel.reel.shine} onChange={(e) => setReel({ shine: e.target.checked })} /> ışık yansıması
                </label>
              </label>
              <div className="flex flex-wrap gap-1">
                {SYMBOLS.map((s) => {
                  const on = sel.reel!.symbols.includes(s.src);
                  return (
                    <button
                      key={s.src}
                      className={`flex items-center gap-1 rounded border px-1 py-0.5 text-[10px] ${on ? 'border-[#FF8E16] bg-[#FF8E16]/15' : 'border-white/10'}`}
                      onClick={() => setReel({ symbols: on ? sel.reel!.symbols.filter((x) => x !== s.src) : [...sel.reel!.symbols, s.src] })}
                    >
                      <img src={brandUrl(s.src)} className="h-4 w-4" alt="" /> {s.label}
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="flex gap-1">
            <Btn small data-testid="split-layer" onClick={() => st.update((p) => splitLayer(p, sel.id, sel.reel?.cuts ?? [0.25, 0.5, 0.75]))} title="Görseli dikey parçalara böler; her parça ayrı katman olur">
              ✂ Parçalara ayır
            </Btn>
            <Btn small onClick={() => st.addEffect(sel.id, 'coinFlip')}>◐ Coin flip</Btn>
          </div>
        </div>
      )}

      <H4>Yeni emoji</H4>
      <div className="grid grid-cols-2 gap-1">
        {EMOJI_PRESETS.map((pr) => (
          <Btn key={pr.id} small onClick={() => create(pr.id)} data-testid={`emoji-new-${pr.id}`}>
            {pr.name}
          </Btn>
        ))}
        <Btn
          small
          onClick={async () => {
            await openEmoji(emojiProject('Boş emoji', { category: 'Duyurular' }));
          }}
        >
          + Boş emoji
        </Btn>
        <Btn small onClick={() => fileRef.current?.click()} data-testid="emoji-from-image">
          ⬆ PNG / SVG’den
        </Btn>
        <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/webp" className="hidden" data-testid="emoji-upload" onChange={(e) => e.target.files && fromImage(e.target.files)} />
      </div>
      <Btn small variant="primary" onClick={makePack} data-testid="emoji-make-pack">
        ★ İlk paketi oluştur (tüm emojiler)
      </Btn>

      <H4>Emoji kütüphanesi</H4>
      <div className="space-y-1.5" data-testid="emoji-library">
        {[...grouped, { c: 'Diğer', items: other }]
          .filter((g) => g.items.length)
          .map((g) => (
            <div key={g.c} className="rounded border border-white/10 bg-[#141414]">
              <div className="flex justify-between px-2 py-1 font-semibold text-neutral-200">
                {g.c} <span className="text-neutral-500">{g.items.length}</span>
              </div>
              {g.items.map((x) => (
                <div key={x.id} className={`flex items-center gap-1 px-2 py-0.5 ${x.id === project.id ? 'bg-[#FF8E16]/15' : ''}`} data-testid="emoji-item" data-name={x.name}>
                  <button className="min-w-0 flex-1 truncate text-left hover:text-white" onClick={async () => openEmoji((await loadProject(x.id))!)}>
                    {x.name}
                  </button>
                  {x.id !== project.id && (
                    <button
                      className="text-neutral-500 hover:text-red-400"
                      title="Sil"
                      onClick={async () => {
                        if (confirm(`"${x.name}" silinsin mi?`)) {
                          await deleteProject(x.id);
                          void refresh();
                        }
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
          ))}
      </div>
      <ExportPanel list={list} />
    </div>
  );
};

/* ---------------- export ---------------- */

interface Out {
  id: string;
  name: string;
  file: string;
  report?: TgReport;
  bitrate?: number;
  attempts?: number;
  png?: string;
  gif?: string;
  blob?: Blob;
  pngBlob?: Blob;
  gifBlob?: Blob;
  status: string;
}

export function reportText(rows: { name: string; file: string; report?: TgReport; bitrate?: number; attempts?: number }[]) {
  const lines = ['SLOTOLOG · TELEGRAM ÖZEL EMOJİ UYUMLULUK RAPORU', `Kurallar: ${TG.size}×${TG.size} · WEBM/VP9 · alfa (şeffaf) · ≤${TG.maxSeconds} sn · ≤${TG.maxFps} FPS · ≤${Math.round(TG.maxBytes / 1024)} KB · ses yok · döngü`, ''];
  for (const r of rows) {
    lines.push(`${r.file}  —  ${r.report?.ok ? 'UYUMLU' : 'SORUNLU'}`);
    for (const c of r.report?.checks ?? []) lines.push(`   ${c.ok ? '✓' : '✗'} ${c.label}: ${c.value}`);
    if (r.bitrate) lines.push(`   kodlama: VP9 ${Math.round(r.bitrate / 1000)} kbps${r.attempts && r.attempts > 1 ? ` (${r.attempts}. denemede ${Math.round(TG.maxBytes / 1024)} KB altına indi)` : ''}`);
    lines.push('');
  }
  return lines.join('\n');
}

const WebmLink: React.FC<{ blob: Blob; name: string }> = ({ blob, name }) => {
  const url = useMemo(() => URL.createObjectURL(blob), [blob]);
  return (
    <a href={url} download={name} className="font-semibold text-[#FF8E16]" data-testid="emoji-webm-link">
      WEBM
    </a>
  );
};

const ExportPanel: React.FC<{ list: ProjectSummary[] }> = ({ list }) => {
  const project = useStore((s) => s.project);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [rows, setRows] = useState<Out[]>([]);
  const [busy, setBusy] = useState(false);
  const [zipLink, setZipLink] = useState<{ url: string; name: string } | null>(null);
  const patch = (id: string, p: Partial<Out>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));

  const run = async (ids: string[], zip: boolean) => {
    setBusy(true);
    const st = useStore.getState();
    await saveProject(st.project);
    const projects: Project[] = [];
    for (const id of ids) {
      const p = id === st.project.id ? st.project : await loadProject(id);
      if (p) projects.push(p);
    }
    const init: Out[] = projects.map((p) => ({ id: p.id, name: p.name, file: emojiFileName(p), status: 'bekliyor' }));
    setRows(init);
    setZipLink(null);
    const done: Out[] = [];
    for (const p of projects) {
      try {
        patch(p.id, { status: 'kodlanıyor' });
        const urls = p.id === st.project.id ? st.assetUrls : await assetUrlsFor(p, brandUrl);
        const res = await exportEmojiWebm(p, urls, { onProgress: (x, note) => patch(p.id, { status: `${note} %${Math.round(x * 100)}` }) });
        const pngBlob = await pngPreview(res.blob, 0.75);
        const gifBlob = await gifPreview(res.blob, p.fps, 100);
        const out: Out = { id: p.id, name: p.name, file: emojiFileName(p), report: res.report, bitrate: res.bitrate, attempts: res.attempts, blob: res.blob, pngBlob, gifBlob, png: URL.createObjectURL(pngBlob), gif: URL.createObjectURL(gifBlob), status: res.report.ok ? 'uyumlu' : 'sorunlu' };
        patch(p.id, out);
        done.push(out);
        if (!zip) downloadBlob(res.blob, out.file);
      } catch (e) {
        patch(p.id, { status: 'hata: ' + (e as Error).message });
      }
    }
    if (zip && done.length) {
      const files = done.flatMap((d) => [
        { name: d.file, blob: d.blob! },
        { name: `onizleme/${d.file.replace('.webm', '.png')}`, blob: d.pngBlob! },
        { name: `onizleme/${d.file.replace('.webm', '.gif')}`, blob: d.gifBlob! },
      ]);
      files.push({ name: 'TELEGRAM_UYUMLULUK_RAPORU.txt', blob: new Blob([reportText(done)], { type: 'text/plain' }) });
      const zipBlob = await zipFiles(files);
      const name = `Slotolog_Telegram_Emoji_Paketi_${done.length}.zip`;
      // a link too: Chrome may hold back a second automatic download after a long job
      setZipLink({ url: URL.createObjectURL(zipBlob), name });
      downloadBlob(zipBlob, name);
    }
    setBusy(false);
  };

  return (
    <div className="mt-3 space-y-1.5" data-testid="emoji-export">
      <H4>Telegram’a aktar</H4>
      <Btn small variant="primary" disabled={busy} onClick={() => run([project.id], false)} data-testid="emoji-export-one">
        ⬇ Bu emojiyi WEBM indir
      </Btn>
      <div className="max-h-40 space-y-0.5 overflow-y-auto rounded border border-white/10 p-1">
        {list.map((x) => (
          <label key={x.id} className="flex items-center gap-1.5 text-[11px]">
            <input type="checkbox" data-testid="emoji-pick" data-name={x.name} checked={!!picked[x.id]} onChange={(e) => setPicked({ ...picked, [x.id]: e.target.checked })} />
            <span className="truncate">{x.name}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-1">
        <Btn small onClick={() => setPicked(Object.fromEntries(list.map((x) => [x.id, true])))}>Tümünü seç</Btn>
        <Btn small variant="primary" disabled={busy || !Object.values(picked).some(Boolean)} onClick={() => run(Object.keys(picked).filter((k) => picked[k]), true)} data-testid="emoji-export-zip">
          ⬇ Seçilenleri ZIP
        </Btn>
      </div>
      {zipLink && (
        <a href={zipLink.url} download={zipLink.name} data-testid="emoji-zip-link" className="block rounded bg-[#FF8E16] px-2 py-1 text-center font-semibold text-black">
          ⬇ {zipLink.name}
        </a>
      )}
      {rows.map((r) => (
        <div key={r.id} className="rounded border border-white/10 bg-[#141414] p-1.5" data-testid="emoji-result" data-ok={r.report?.ok ? '1' : '0'}>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-mono text-[10px] text-neutral-200">{r.file}</span>
            <span className={r.status === 'uyumlu' ? 'text-green-400' : r.status === 'sorunlu' || r.status.startsWith('hata') ? 'text-red-400' : 'text-neutral-400'}>{r.status}</span>
          </div>
          {(r.png || r.gif) && (
            <div className="mt-1 flex gap-2">
              {r.png && <img src={r.png} alt="PNG" title="Şeffaf PNG önizleme" className="h-[50px] w-[50px] bg-[repeating-conic-gradient(#3a3a3a_0_25%,#262626_0_50%)] bg-[length:10px_10px]" />}
              {r.gif && <img src={r.gif} alt="GIF" title="GIF önizleme" className="h-[50px] w-[50px] bg-[#17212b]" />}
              <div className="flex flex-col gap-0.5 text-[10px]">
                {r.blob && <WebmLink blob={r.blob} name={r.file} />}
                {r.png && <a href={r.png} download={r.file.replace('.webm', '.png')} className="text-[#FF8E16]">PNG</a>}
                {r.gif && <a href={r.gif} download={r.file.replace('.webm', '.gif')} className="text-[#FF8E16]">GIF</a>}
              </div>
            </div>
          )}
          {r.report && (
            <ul className="mt-1 space-y-0.5 text-[10px]" data-testid="emoji-checks">
              {r.report.checks.map((c) => (
                <li key={c.key} className={c.ok ? 'text-green-300/90' : 'text-red-300'} data-key={c.key} data-ok={c.ok ? '1' : '0'}>
                  {c.ok ? '✓' : '✗'} {c.label}: {c.value}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

/* ---------------- loop previews ---------------- */

/** live 100 px loops: as Telegram will show them (transparent, dark / light chat, inline in text) */
export const EmojiLoopPreview: React.FC = () => {
  const project = useStore((s) => s.project);
  const assetUrls = useStore((s) => s.assetUrls);
  const [bg, setBg] = useState<'checker' | 'dark' | 'light'>('checker');
  const { width, height } = projectSize(project);
  const props = useMemo(() => ({ project, assetUrls }), [project, assetUrls]);
  const tile = (size: number, key: string) => (
    <Player
      key={key}
      component={MainComposition as unknown as React.FC<Record<string, unknown>>}
      inputProps={props}
      durationInFrames={Math.max(1, project.durationInFrames)}
      fps={project.fps}
      compositionWidth={width}
      compositionHeight={height}
      style={{ width: size, height: size }}
      autoPlay
      loop
      controls={false}
      acknowledgeRemotionLicense
    />
  );
  const bgCls = bg === 'checker' ? 'bg-[repeating-conic-gradient(#3a3a3a_0_25%,#262626_0_50%)] bg-[length:16px_16px]' : bg === 'dark' ? 'bg-[#0e1621]' : 'bg-[#e6ebee]';
  return (
    <div className="flex items-center gap-4 border-t border-white/10 bg-[#161616] px-3 py-2" data-testid="emoji-loop-preview">
      <div className="text-[11px] text-neutral-400">
        <div className="font-semibold text-neutral-200">Döngü önizleme</div>
        <div className="mt-1 flex gap-1">
          {(['checker', 'dark', 'light'] as const).map((b) => (
            <button key={b} onClick={() => setBg(b)} className={`rounded px-1.5 py-0.5 text-[10px] ${bg === b ? 'bg-[#FF8E16] text-black' : 'bg-white/10'}`} data-testid={`emoji-bg-${b}`}>
              {b === 'checker' ? 'Şeffaf' : b === 'dark' ? 'Koyu sohbet' : 'Açık sohbet'}
            </button>
          ))}
        </div>
      </div>
      <div className={`flex h-[116px] w-[116px] items-center justify-center rounded ${bgCls}`} title="100×100 (Telegram boyutu)">
        {tile(100, 'big')}
      </div>
      <div className={`flex items-center gap-1 rounded-xl px-3 py-2 text-[13px] ${bg === 'light' ? 'bg-white text-black' : 'bg-[#182533] text-white'}`} title="Mesaj içinde ~22 px">
        <span>Bugün</span>
        {tile(22, 'inline')}
        <span>büyük kazanç seni bekliyor</span>
        {tile(22, 'inline2')}
      </div>
    </div>
  );
};

/** back to the video editor: the most recently edited non-emoji project */
export async function leaveEmojiStudio() {
  const st = useStore.getState();
  await saveProject(st.project);
  const list = await listProjects();
  const v = list.find((x) => !x.emoji);
  const p = v ? await loadProject(v.id) : undefined;
  const { multiplierTemplate } = await import('../lib/templates');
  await st.loadIntoEditor(p ?? multiplierTemplate());
}
