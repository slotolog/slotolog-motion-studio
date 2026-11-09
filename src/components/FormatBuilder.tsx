import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { assetUrlsFor, downloadBlob, listProjects, loadProject, missingAssets, saveFormatVariant, saveProject, type ProjectSummary } from '../lib/storage';
import { exportMp4, verifyMp4 } from '../lib/export';
import { AD_FORMATS, layoutIssues, reformatProject, variantFileName, variantName, type LayoutIssue } from '../lib/reformat';
import { brandUrl } from '../lib/brand';
import { projectSize, type Aspect, type Project } from '../types';
import { Btn, Modal } from './ui';

interface Row {
  key: string;
  source: string;
  aspect: Aspect;
  name?: string;
  file?: string;
  status: 'bekliyor' | 'proje' | 'render' | 'tamam' | 'hata';
  progress?: number;
  issues?: LayoutIssue[];
  missing?: string[];
  check?: string;
  ok?: boolean;
  message?: string;
}

/**
 * Toplu Reklam Formatı Oluşturucu: seçili projelerin 9:16 ve 4:5 kopyalarını bağımsız, düzenlenebilir projeler olarak kaydeder,
 * 4:5'te katmanları yeniden yerleştirir, istenirse her birini dosya adında formatı olan MP4 olarak dışa aktarır.
 */
export const FormatBuilderModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const current = useStore((s) => s.project);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [formats, setFormats] = useState<Record<string, boolean>>({ '9:16': true, '4:5': true });
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    void (async () => {
      await saveProject(useStore.getState().project);
      const list = await listProjects();
      const full = await Promise.all(list.map((s) => loadProject(s.id)));
      // only originals: format copies are made from their source
      setProjects(list.filter((_, i) => !full[i]?.variantOf));
      setPicked({ [current.variantOf?.sourceId ?? current.id]: true });
    })();
  }, []);

  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const run = async (render: boolean) => {
    setBusy(true);
    const ctl = new AbortController();
    abort.current = ctl;
    const ids = Object.keys(picked).filter((k) => picked[k]);
    const fmts = AD_FORMATS.filter((f) => formats[f.aspect]).map((f) => f.aspect);
    const plan: Row[] = [];
    const sources: Record<string, Project> = {};
    for (const id of ids) {
      const p = await loadProject(id);
      if (!p) continue;
      sources[id] = p;
      for (const a of fmts) plan.push({ key: `${id}:${a}`, source: p.name, aspect: a, status: 'bekliyor' });
    }
    setRows(plan);
    for (const r of plan) {
      if (ctl.signal.aborted) break;
      const src = sources[r.key.split(':')[0]];
      try {
        patch(r.key, { status: 'proje' });
        const miss = (await missingAssets(src)).map((a) => a.name);
        const laid = reformatProject(src, r.aspect);
        laid.name = variantName(src.name, r.aspect);
        const saved = await saveFormatVariant(src, laid);
        const issues = projectSize(src).height !== projectSize(saved).height ? layoutIssues(src, saved) : [];
        patch(r.key, { name: saved.name, file: variantFileName(saved), issues, missing: miss, status: render ? 'render' : 'tamam' });
        if (!render) continue;
        const urls = await assetUrlsFor(saved, brandUrl);
        const blob = await exportMp4(saved, urls, { quality: 'high', signal: ctl.signal, onProgress: (p) => patch(r.key, { progress: p }) });
        const check = await verifyMp4(blob, saved).catch(() => null);
        Object.values(urls).forEach((u) => u.startsWith('blob:') && URL.revokeObjectURL(u));
        downloadBlob(blob, variantFileName(saved));
        patch(r.key, {
          status: 'tamam',
          ok: !!check?.ok,
          check: check ? `${check.width}×${check.height} · ${check.frames} kare · ${check.duration.toFixed(2)} sn · ${check.hasAudio ? 'sesli' : 'sessiz'}${check.ok ? '' : ' · ' + check.problems.join(', ')}` : 'doğrulanamadı',
        });
      } catch (e) {
        if (ctl.signal.aborted) patch(r.key, { status: 'hata', message: 'İptal edildi' });
        else patch(r.key, { status: 'hata', message: (e as Error).message });
      }
    }
    setBusy(false);
  };

  return (
    <Modal title="Toplu Reklam Formatı Oluşturucu" onClose={() => !busy && onClose()} wide>
      <div className="space-y-3 text-xs text-neutral-300" data-testid="format-builder">
        <p className="text-neutral-400">
          Seçtiğin projelerin her formatı ayrı, düzenlenebilir bir proje olarak kaydedilir (“Ad · 4:5 (1080×1350)”). 4:5’te video kırpılmaz: logo, oyun alanı, bonus, buton ve
          yasal not yeniden yerleştirilir. Süre, animasyonlar, müzik, seslendirme ve ses kısma ayarları aynen kalır. Orijinal projeler değişmez; aynı formatı tekrar oluşturmak
          önceki kopyanın yerine geçer.
        </p>
        <div className="flex gap-4">
          {AD_FORMATS.map((f) => (
            <label key={f.aspect} className="flex items-center gap-1.5">
              <input type="checkbox" data-testid={`fmt-${f.tag}`} checked={!!formats[f.aspect]} onChange={(e) => setFormats({ ...formats, [f.aspect]: e.target.checked })} />
              {f.label}
            </label>
          ))}
        </div>
        <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-white/10 p-2" data-testid="fb-projects">
          {!projects && <p className="text-neutral-500">Yükleniyor…</p>}
          {projects?.map((p) => (
            <label key={p.id} className="flex items-center gap-2 rounded px-1 py-0.5 hover:bg-white/5">
              <input type="checkbox" data-testid="fb-project" data-name={p.name} checked={!!picked[p.id]} onChange={(e) => setPicked({ ...picked, [p.id]: e.target.checked })} />
              <span className="min-w-0 flex-1 truncate text-neutral-100">{p.name}</span>
              <span className="text-neutral-500">{p.aspect}</span>
            </label>
          ))}
        </div>
        {rows.length > 0 && (
          <div className="space-y-1" data-testid="fb-results">
            {rows.map((r) => (
              <div key={r.key} data-testid="fb-row" data-status={r.status} className="rounded border border-white/10 bg-[#141414] px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-[#FF8E16] px-1.5 font-bold text-black">{r.aspect}</span>
                  <span className="min-w-0 flex-1 truncate text-neutral-100">{r.name ?? r.source}</span>
                  <span className={r.status === 'hata' ? 'text-red-400' : r.status === 'tamam' ? 'text-green-400' : 'text-neutral-400'}>
                    {r.status === 'render' ? `MP4 %${Math.round((r.progress ?? 0) * 100)}` : r.status}
                  </span>
                </div>
                {r.file && <div className="font-mono text-[10px] text-neutral-500">{r.file}</div>}
                {r.check && <div className={`font-mono text-[10px] ${r.ok ? 'text-green-300' : 'text-red-300'}`} data-testid="fb-check">{(r.ok ? '✓ ' : '⚠ ') + r.check}</div>}
                {r.missing && r.missing.length > 0 && <div className="text-[10px] text-red-300">Eksik medya (yerine bir şey konmadı): {r.missing.join(', ')}</div>}
                {r.issues && (
                  <div className={`text-[10px] ${r.issues.length ? 'text-yellow-400' : 'text-green-400/80'}`} data-testid="fb-issues" data-count={r.issues.length}>
                    {r.issues.length === 0
                      ? '✓ Yerleşim: yeni çakışma ya da kesilen öğe yok'
                      : '⚠ ' + r.issues.slice(0, 4).map((i) => `${i.t.toFixed(1)} sn: ${i.kind === 'overlap' ? `“${i.a}” ↔ “${i.b}” çakışıyor` : `“${i.a}” kenardan taşıyor`}`).join(' · ')}
                  </div>
                )}
                {r.message && <div className="text-[10px] text-red-300">{r.message}</div>}
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          {busy ? (
            <Btn variant="danger" onClick={() => abort.current?.abort()}>
              İptal
            </Btn>
          ) : (
            <>
              <Btn onClick={() => run(false)} data-testid="fb-make" disabled={!Object.values(picked).some(Boolean) || !Object.values(formats).some(Boolean)}>
                Projeleri oluştur
              </Btn>
              <Btn variant="primary" onClick={() => run(true)} data-testid="fb-render" disabled={!Object.values(picked).some(Boolean) || !Object.values(formats).some(Boolean)}>
                Oluştur + MP4 dışa aktar
              </Btn>
            </>
          )}
        </div>
        <p className="text-[10px] text-neutral-500">Oluşan projeler “Projelerim”de; MP4’ler sırayla indirilir. Render sırasında sekmeyi açık ve önde tut.</p>
      </div>
    </Modal>
  );
};
