import React from 'react';
import { useStore } from '../store';
import { seek } from '../lib/player';
import { autoVolume, normalizeRamp, outToSrc, segmentStarts, splitAt } from '../lib/speedramp';
import type { Layer, SpeedRamp, SpeedSegment } from '../types';
import { Btn, NumInput, Section } from './ui';

const mmss = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

/** Inspector section: variable speed (speed ramp) of a video layer */
export const SpeedRampEditor: React.FC<{ layer: Layer }> = ({ layer }) => {
  const fps = useStore((s) => s.project.fps);
  const frame = useStore((s) => s.frame);
  const asset = useStore((s) => s.project.assets.find((a) => a.id === layer.assetId));
  const ramp = layer.speedRamp;
  const set = (r: SpeedRamp | undefined) => useStore.getState().setSpeedRamp(layer.id, r);
  if (!ramp) {
    return (
      <Section title="Değişken hız (hız rampası)">
        <p className="text-[11px] text-neutral-500">
          Videoyu bölümlere ayırıp her bölüme ayrı hız ver (örn. sıradan dönüşler 6×, büyük kazanç 1×). Hiçbir kare kesilmez, sıra korunur.
        </p>
        <Btn
          small
          variant="primary"
          data-testid="ramp-enable"
          onClick={() => {
            const end = asset?.duration ?? (layer.trimStart ?? 0) + (layer.duration / fps) * (layer.playbackRate ?? 1);
            set({ segments: [{ from: layer.trimStart ?? 0, speed: layer.playbackRate ?? 1 }], end, smooth: 0.4 });
          }}
        >
          Değişken hızı aç
        </Btn>
      </Section>
    );
  }
  const r = normalizeRamp(ramp);
  const starts = segmentStarts(r, fps);
  const local = frame - layer.start;
  const srcNow = outToSrc(r, fps, Math.max(0, local));
  const updSeg = (i: number, patch: Partial<SpeedSegment>) => set({ ...r, segments: r.segments.map((s, k) => (k === i ? { ...s, ...patch } : s)) });
  const total = layer.duration / fps;
  const srcLen = r.end - r.segments[0].from;
  return (
    <Section title="Değişken hız (hız rampası)">
      <div className="mb-1 text-[11px] text-neutral-300" data-testid="ramp-summary">
        Kaynak {mmss(srcLen)} → çıktı <b className="text-[#FF8E16]">{mmss(total)}</b> · {r.segments.length} bölüm
      </div>
      <div className="space-y-1" data-testid="ramp-list">
        <div className="grid grid-cols-[18px_58px_52px_44px_1fr_16px] gap-1 text-[9px] uppercase text-neutral-500">
          <span>#</span>
          <span>Kaynak</span>
          <span>Hız ×</span>
          <span>Ses %</span>
          <span>Not · yeni videoda</span>
          <span />
        </div>
        {r.segments.map((s, i) => {
          const end = r.segments[i + 1]?.from ?? r.end;
          const active = srcNow >= s.from && srcNow < end;
          return (
            <div key={i} className={`grid grid-cols-[18px_58px_52px_44px_1fr_16px] items-center gap-1 rounded px-0.5 ${active ? 'bg-[#FF8E16]/15' : ''}`} data-testid={`ramp-seg-${i}`}>
              <button className="text-[10px] text-neutral-400 hover:text-white" title="Önizlemede bu bölüme git" onClick={() => seek(layer.start + Math.round(starts[i] * fps))}>
                {i + 1}
              </button>
              {i === 0 ? (
                <span className="font-mono text-[10px] text-neutral-400">{mmss(s.from)}</span>
              ) : (
                <NumInput value={s.from} step={0.1} digits={2} min={r.segments[i - 1].from + 0.05} max={end - 0.05} onChange={(v) => updSeg(i, { from: v })} />
              )}
              <NumInput value={s.speed} step={0.25} digits={2} min={0.1} max={16} onChange={(v) => updSeg(i, { speed: v })} />
              <input
                className="w-full rounded border border-white/10 bg-[#121212] px-1 py-0.5 text-[10px]"
                placeholder={`${Math.round(autoVolume(s.speed) * 100)}`}
                title="Boş = otomatik (1×'te açık, hızlıda kısık)"
                value={s.volume === undefined ? '' : Math.round(s.volume * 100)}
                onChange={(e) => updSeg(i, { volume: e.target.value === '' ? undefined : Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)) / 100 })}
              />
              <div className="flex min-w-0 items-center gap-1">
                <input
                  className="min-w-0 flex-1 rounded border border-white/10 bg-[#121212] px-1 py-0.5 text-[10px]"
                  value={s.note ?? ''}
                  placeholder="not"
                  onChange={(e) => updSeg(i, { note: e.target.value || undefined })}
                />
                <span className="font-mono text-[9px] text-neutral-500">{starts[i].toFixed(1)}s</span>
              </div>
              {i > 0 ? (
                <button className="text-[10px] text-neutral-500 hover:text-red-400" title="Önceki bölümle birleştir" onClick={() => set({ ...r, segments: r.segments.filter((_, k) => k !== i) })}>
                  ✕
                </button>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <Btn small onClick={() => set(splitAt(r, srcNow))} data-testid="ramp-split">
          ✂ Oynatıcı konumunda böl ({mmss(srcNow)})
        </Btn>
        <Btn small onClick={() => useStore.getState().setDuration(layer.start + layer.duration)} data-testid="ramp-fit-project">
          Proje süresini videoya eşitle
        </Btn>
        <Btn small onClick={() => set(undefined)}>Sabit hıza dön</Btn>
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-400">
        <span>Yumuşak geçiş</span>
        <div className="w-16">
          <NumInput value={r.smooth} step={0.1} digits={1} min={0} max={2} onChange={(v) => set({ ...r, smooth: v })} />
        </div>
        <span>sn (0 = keskin)</span>
      </div>
      <p className="mt-1 text-[10px] leading-relaxed text-neutral-500">
        Geçişler hep hızlı bölümün görüntüsünden yapılır; yavaş (önemli) bölüm tam hızında kalır. Zaman çizelgesinde bölüm sınırlarını sürükleyebilirsin. Hızlandırılmış veya yavaşlatılmış bölümlerde oyun sesi otomatik kısılır (1× dışındaki hızlarda ses perdesi bozulur).
      </p>
    </Section>
  );
};

/** Inspector section: rewind (footage runs backwards) */
export const RewindEditor: React.FC<{ layer: Layer }> = ({ layer }) => {
  const fps = useStore((s) => s.project.fps);
  const asset = useStore((s) => s.project.assets.find((a) => a.id === layer.assetId));
  const up = (patch: Partial<Layer>) => useStore.getState().updateLayer(layer.id, patch);
  const rw = layer.rewind;
  if (!rw)
    return (
      <Section title="Geri sarma efekti">
        <p className="text-[11px] text-neutral-500">Bu katman, kaydı geriye doğru hızla sarar (VHS görünümüyle). Süresini zaman çizelgesinden ayarlarsın.</p>
        <Btn small data-testid="rewind-enable" onClick={() => up({ rewind: { from: asset?.duration ?? 10, to: 0, vhs: true }, speedRamp: undefined, startSound: 'rewind' })}>
          Geri sarma yap
        </Btn>
      </Section>
    );
  return (
    <Section title="Geri sarma efekti">
      <div className="grid grid-cols-2 gap-2 text-[11px] text-neutral-400">
        <label>
          Kayıttaki başlangıç (sn)
          <NumInput value={rw.from} step={0.5} digits={1} min={0} onChange={(v) => up({ rewind: { ...rw, from: v } })} />
        </label>
        <label>
          Sarılacağı yer (sn)
          <NumInput value={rw.to} step={0.5} digits={1} min={0} onChange={(v) => up({ rewind: { ...rw, to: v } })} />
        </label>
      </div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-neutral-400">
        <input type="checkbox" checked={rw.vhs !== false} onChange={(e) => up({ rewind: { ...rw, vhs: e.target.checked } })} /> VHS görünümü (◀◀, tarama çizgileri)
      </div>
      <div className="mt-1 text-[10px] text-neutral-500">Süre: {(layer.duration / fps).toFixed(2)} sn</div>
      <Btn small className="mt-1" onClick={() => up({ rewind: undefined })}>
        Geri sarmayı kaldır
      </Btn>
    </Section>
  );
};
