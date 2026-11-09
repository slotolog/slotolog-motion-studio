import React, { useEffect, useRef, useState } from 'react';
import type { WebRendererQuality } from '@remotion/web-renderer';
import { useStore } from '../store';
import { emptyProject } from '../lib/factory';
import { checkExportSupport, exportMp4, getLicenseKey, LICENSE_KEY_STORAGE, verifyMp4, type ExportCheck } from '../lib/export';
import { projectSize } from '../types';
import { deleteProject, downloadBlob, loadProject, exportProjectFile, importProjectFile, listProjects, type ProjectSummary } from '../lib/storage';
import { formatTime } from '../lib/player';
import type { Aspect } from '../types';
import { Btn, Modal, Select } from './ui';
import { FormatBuilderModal } from './FormatBuilder';

const SAVE_LABEL = { saved: '✓ Kaydedildi', saving: 'Kaydediliyor…', unsaved: '● Değişiklik var', error: '⚠ Kaydedilemedi' };

const ProjectsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [items, setItems] = useState<ProjectSummary[] | null>(null);
  const current = useStore((s) => s.project.id);
  const refresh = () => listProjects().then(setItems);
  useEffect(() => {
    refresh();
  }, []);
  const open = async (id: string) => {
    const p = await loadProject(id);
    if (p) await useStore.getState().loadIntoEditor(p);
    onClose();
  };
  return (
    <Modal title="Projelerim" onClose={onClose} wide>
      {!items && <p className="text-sm text-neutral-400">Yükleniyor…</p>}
      {items?.length === 0 && <p className="text-sm text-neutral-400">Kayıtlı proje yok.</p>}
      <div className="space-y-1.5" data-testid="project-list">
        {items?.map((p) => (
          <div key={p.id} className={`flex items-center gap-3 rounded-md border px-3 py-2 ${p.id === current ? 'border-[#FF8E16]' : 'border-white/10'}`}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-white">{p.name}</div>
              <div className="text-[11px] text-neutral-500">
                {p.aspect} · {p.layers} katman · {new Date(p.updatedAt).toLocaleString('tr-TR')}
              </div>
            </div>
            <Btn small variant="primary" onClick={() => open(p.id)}>
              Aç
            </Btn>
            <Btn
              small
              variant="ghost"
              disabled={p.id === current}
              onClick={async () => {
                if (confirm(`"${p.name}" kalıcı olarak silinsin mi?`)) {
                  await deleteProject(p.id);
                  refresh();
                }
              }}
            >
              Sil
            </Btn>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[11px] leading-relaxed text-neutral-500">
        Projeler bu tarayıcıda (IndexedDB) saklanır. Başka bilgisayara taşımak veya yedeklemek için üst menüden “Proje dosyası indir”i kullan.
      </p>
    </Modal>
  );
};

type Phase = { kind: 'idle' } | { kind: 'checking' } | { kind: 'rendering'; progress: number; eta: number } | { kind: 'done'; blob: Blob; ms: number; check: ExportCheck | null } | { kind: 'error'; message: string };

const ExportModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const project = useStore((s) => s.project);
  const assetUrls = useStore((s) => s.assetUrls);
  const [quality, setQuality] = useState<WebRendererQuality>('high');
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [issues, setIssues] = useState<string[]>([]);
  const [license, setLicense] = useState(getLicenseKey());
  const abort = useRef<AbortController | null>(null);
  const size = projectSize(project);
  const fileName = `${project.name.replace(/[^\p{L}\p{N}_-]+/gu, '-') || 'slotolog'}-${size.width}x${size.height}.mp4`;

  useEffect(() => {
    checkExportSupport(project).then((r) => setIssues(r.issues.filter((i) => i.severity === 'error').map((i) => i.message)));
  }, [project]);

  const start = async () => {
    localStorage.setItem(LICENSE_KEY_STORAGE, license.trim() || 'free-license');
    setPhase({ kind: 'checking' });
    const ctl = new AbortController();
    abort.current = ctl;
    const t0 = performance.now();
    try {
      const blob = await exportMp4(project, assetUrls, {
        quality,
        signal: ctl.signal,
        onProgress: (p, eta) => setPhase({ kind: 'rendering', progress: p, eta }),
      });
      const check = await verifyMp4(blob, project).catch((err) => {
        console.warn('MP4 doğrulanamadı', err);
        return null;
      });
      setPhase({ kind: 'done', blob, ms: performance.now() - t0, check });
      downloadBlob(blob, fileName);
    } catch (e) {
      if (ctl.signal.aborted) setPhase({ kind: 'idle' });
      else {
        console.error(e);
        setPhase({ kind: 'error', message: (e as Error).message });
      }
    }
  };

  const busy = phase.kind === 'checking' || phase.kind === 'rendering';
  return (
    <Modal title="MP4 olarak dışa aktar" onClose={() => !busy && onClose()}>
      <div className="space-y-3 text-sm text-neutral-300">
        <div className="rounded-md bg-[#141414] p-3 text-xs">
          <div>
            <b className="text-white">{project.name}</b>
          </div>
          <div className="text-neutral-400">
            {project.aspect} · H.264 MP4 · {project.fps} fps · {formatTime(project.durationInFrames, project.fps)}
          </div>
        </div>
        {issues.length > 0 && (
          <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-300">
            Bu tarayıcı tarayıcı-içi MP4 oluşturmayı desteklemiyor:
            <ul className="mt-1 list-disc pl-4">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            Güncel Google Chrome kullan. Gerekirse README’deki bulut/yerel render seçeneklerine bak.
          </div>
        )}
        <label className="flex items-center gap-2 text-xs">
          <span className="w-20 text-neutral-400">Kalite</span>
          <Select<WebRendererQuality>
            value={quality}
            onChange={setQuality}
            options={[
              { value: 'medium', label: 'Orta (küçük dosya)' },
              { value: 'high', label: 'Yüksek (önerilen)' },
              { value: 'very-high', label: 'Çok yüksek' },
            ]}
          />
        </label>
        <details className="text-xs text-neutral-500">
          <summary className="cursor-pointer">Remotion lisansı</summary>
          <p className="mt-1 leading-relaxed">
            Bireyler ve en fazla 3 çalışanlı şirketler için Remotion ücretsizdir (“free-license”). Daha büyük bir şirket adına kullanıyorsan remotion.pro’dan şirket lisansı alıp anahtarı buraya yaz.
          </p>
          <input value={license} onChange={(e) => setLicense(e.target.value)} className="mt-1 w-full rounded border border-white/10 bg-[#121212] px-2 py-1 font-mono text-[11px]" />
        </details>

        {phase.kind === 'rendering' && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full bg-[#FF8E16] transition-all" style={{ width: `${Math.round(phase.progress * 100)}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[11px] text-neutral-400" data-testid="export-progress">
              <span>%{Math.round(phase.progress * 100)}</span>
              <span>{phase.eta > 0 ? `~${Math.ceil(phase.eta / 1000)} sn kaldı` : ''}</span>
            </div>
            <p className="mt-2 text-[11px] text-yellow-500">Render sırasında bu sekmeyi açık ve önde tut.</p>
          </div>
        )}
        {phase.kind === 'checking' && <p className="text-xs text-neutral-400">Hazırlanıyor…</p>}
        {phase.kind === 'done' && (
          <div className="rounded-md border border-green-500/40 bg-green-500/10 p-3 text-xs text-green-300" data-testid="export-done">
            Hazır! {(phase.blob.size / 1024 / 1024).toFixed(1)} MB · {(phase.ms / 1000).toFixed(0)} sn sürdü. İndirme başladı.
            {phase.check && (
              <div className={`mt-1.5 rounded px-2 py-1 font-mono text-[11px] ${phase.check.ok ? 'bg-green-500/10 text-green-200' : 'bg-red-500/20 text-red-200'}`} data-testid="export-check">
                {phase.check.ok ? '✓ Doğrulandı: ' : '⚠ Sorun: '}
                {phase.check.width}×{phase.check.height} · {phase.check.frames} kare · {phase.check.duration.toFixed(2)} sn · {phase.check.hasAudio ? 'sesli' : 'sessiz'}
                {!phase.check.ok && <div>{phase.check.problems.join(' · ')}</div>}
              </div>
            )}
            <div className="mt-1 text-[10px] text-green-200/70">Dosya: {fileName}</div>
          </div>
        )}
        {phase.kind === 'error' && (
          <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-xs break-words text-red-300" data-testid="export-error">
            Dışa aktarma başarısız: {phase.message}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-1">
          {busy ? (
            <Btn variant="danger" onClick={() => abort.current?.abort()}>
              İptal
            </Btn>
          ) : (
            <>
              {phase.kind === 'done' && <Btn onClick={() => downloadBlob(phase.blob, fileName)}>Tekrar indir</Btn>}
              <Btn variant="primary" onClick={start} disabled={issues.length > 0} data-testid="start-export">
                {phase.kind === 'done' ? 'Yeniden oluştur' : 'MP4 oluştur'}
              </Btn>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export const TopBar: React.FC = () => {
  const project = useStore((s) => s.project);
  const saveState = useStore((s) => s.saveState);
  const canUndo = useStore((s) => s.past.length > 0);
  const canRedo = useStore((s) => s.future.length > 0);
  const [modal, setModal] = useState<'projects' | 'export' | 'formats' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const st = useStore.getState();

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 border-b border-white/10 bg-[#1E1E1E] px-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#FF8E16] text-sm font-black text-[#1E1E1E] italic">S</div>
        <div className="leading-tight">
          <div className="text-xs font-black tracking-wide text-white italic">SLOTOLOG</div>
          <div className="text-[9px] font-bold tracking-[0.2em] text-[#FF8E16]">MOTION STUDIO</div>
        </div>
      </div>
      <input
        value={project.name}
        onChange={(e) => st.rename(e.target.value)}
        className="w-48 rounded border border-transparent bg-transparent px-2 py-1 text-sm text-neutral-100 hover:border-white/10 focus:border-[#FF8E16] focus:outline-none"
      />
      <span className={`text-[11px] ${saveState === 'error' ? 'text-red-400' : 'text-neutral-500'}`} data-testid="save-state">
        {SAVE_LABEL[saveState]}
      </span>

      <div className="mx-auto flex items-center gap-1 rounded-md bg-[#121212] p-0.5">
        {project.size && (
          <span className="rounded bg-[#FF8E16] px-2.5 py-1 text-xs font-semibold text-black" title="Kaynak videonun orijinal oranı" data-testid="custom-size">
            {project.size.width}×{project.size.height}
          </span>
        )}
        {(['9:16', '4:5', '1:1', '16:9'] as Aspect[]).map((a) => (
          <button
            key={a}
            onClick={() => st.setAspect(a)}
            className={`rounded px-2.5 py-1 text-xs font-semibold ${project.aspect === a && !project.size ? 'bg-[#FF8E16] text-black' : 'text-neutral-400 hover:text-white'}`}
          >
            {a}
          </button>
        ))}
      </div>

      <Btn small variant="ghost" disabled={!canUndo} onClick={st.undo} title="Geri al (⌘Z)">
        ↶
      </Btn>
      <Btn small variant="ghost" disabled={!canRedo} onClick={st.redo} title="Yinele (⌘⇧Z)">
        ↷
      </Btn>
      <Btn small onClick={() => confirm('Boş yeni proje açılsın mı? (Mevcut proje kayıtlı)') && st.loadIntoEditor(emptyProject(project.aspect))}>Yeni</Btn>
      <Btn small onClick={() => setModal('formats')} data-testid="open-format-builder" title="Toplu Reklam Formatı Oluşturucu: 9:16 ve 4:5 kopyalar + MP4">
        Formatlar
      </Btn>
      <Btn small onClick={() => setModal('projects')} data-testid="open-projects">
        Projelerim
      </Btn>
      <Btn small title="Projeyi tüm medyasıyla tek dosya olarak indir" onClick={async () => downloadBlob(await exportProjectFile(project), `${project.name}.slotolog.json`)}>
        Proje dosyası indir
      </Btn>
      <Btn small title="Daha önce indirdiğin .slotolog.json dosyasını aç" onClick={() => fileRef.current?.click()}>
        Dosya aç
      </Btn>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try {
            await st.loadIntoEditor(await importProjectFile(f));
          } catch (err) {
            alert((err as Error).message);
          }
          e.target.value = '';
        }}
      />
      <Btn variant="primary" onClick={() => setModal('export')} data-testid="export">
        ⬇ MP4 Dışa Aktar
      </Btn>
      {modal === 'projects' && <ProjectsModal onClose={() => setModal(null)} />}
      {modal === 'export' && <ExportModal onClose={() => setModal(null)} />}
      {modal === 'formats' && <FormatBuilderModal onClose={() => setModal(null)} />}
    </div>
  );
};
