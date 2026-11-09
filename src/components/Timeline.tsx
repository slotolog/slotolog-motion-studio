import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { formatTime, seek, togglePlay } from '../lib/player';
import { EFFECT_META } from '../lib/anim';
import { ANIM_PROPS, type Layer, type LayerType, type SpeedRamp } from '../types';
import { normalizeRamp, segmentStarts } from '../lib/speedramp';
import { buildMusicSync } from '../lib/music';
import { NumInput } from './ui';

export const TYPE_META: Record<LayerType, { icon: string; color: string; label: string }> = {
  background: { icon: '▦', color: '#b45309', label: 'Arka plan' },
  particles: { icon: '✦', color: '#ca8a04', label: 'Parçacık' },
  image: { icon: '🖼', color: '#2563eb', label: 'Görsel' },
  video: { icon: '🎬', color: '#7c3aed', label: 'Video' },
  audio: { icon: '♪', color: '#059669', label: 'Ses' },
  text: { icon: 'T', color: '#db2777', label: 'Metin' },
  multiplier: { icon: 'X', color: '#ea580c', label: 'Çarpan' },
  button: { icon: '▭', color: '#0891b2', label: 'Buton' },
  placeholder: { icon: '▢', color: '#525252', label: 'Yer tutucu' },
  camera: { icon: '🎥', color: '#0f766e', label: 'Kamera' },
  frame: { icon: '▣', color: '#c2410c', label: 'Çerçeve' },
  subtitles: { icon: '💬', color: '#4f46e5', label: 'Altyazı' },
};

const LABEL_W = 210;
const ROW_H = 34;

type TDrag = { id: string; mode: 'move' | 'left' | 'right' | 'ramp'; x0: number; start0: number; dur0: number; trim0: number; media: boolean; seg?: number; ramp?: SpeedRamp };

/** speed-ramp parts inside a video bar: speed labels and draggable boundaries */
const RampMarks: React.FC<{ l: Layer; ppf: number; fps: number; onDrag: (e: React.PointerEvent, i: number) => void }> = ({ l, ppf, fps, onDrag }) => {
  const r = React.useMemo(() => normalizeRamp(l.speedRamp!), [l.speedRamp]);
  const starts = React.useMemo(() => segmentStarts(r, fps), [r, fps]);
  return (
    <>
      {r.segments.map((s, i) => {
        const x = starts[i] * fps * ppf;
        const w = ((starts[i + 1] ?? l.duration / fps) - starts[i]) * fps * ppf;
        const slow = s.speed <= 1.05;
        return (
          <React.Fragment key={i}>
            <div
              className={`pointer-events-none absolute top-0 h-full ${slow ? 'bg-emerald-400/35' : s.speed >= 4 ? 'bg-black/25' : 'bg-black/10'}`}
              style={{ left: x, width: Math.max(1, w) }}
              title={`${s.speed}×${s.note ? ' · ' + s.note : ''}`}
            >
              {w > 22 && <span className="absolute bottom-0 left-1 text-[9px] leading-3 text-white/90">{+s.speed.toFixed(2)}×</span>}
            </div>
            {i > 0 && (
              <div
                data-testid={`ramp-handle-${i}`}
                title={`Hız sınırı: ${s.from.toFixed(2)} sn (sürükle)`}
                className="absolute top-0 z-10 h-full w-2 -translate-x-1/2 cursor-ew-resize"
                style={{ left: x }}
                onPointerDown={(e) => onDrag(e, i)}
              >
                <div className="mx-auto h-full w-0.5 bg-white" />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
};

export const Timeline: React.FC = () => {
  const project = useStore((s) => s.project);
  const frame = useStore((s) => s.frame);
  const playing = useStore((s) => s.playing);
  const selectedId = useStore((s) => s.selectedId);
  const [ppf, setPpf] = useState(3); // pixels per frame
  const drag = useRef<TDrag | null>(null);
  const scrub = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);
  const fps = project.fps;
  const total = project.durationInFrames;
  const width = total * ppf + 60;
  const rows = [...project.layers].reverse();
  const music = React.useMemo(() => buildMusicSync(project), [project]);
  const sections = project.audio?.sections ?? [];

  const frameFromEvent = (e: { clientX: number }) => {
    const r = trackRef.current!.getBoundingClientRect();
    return Math.max(0, Math.min(total - 1, Math.round((e.clientX - r.left) / ppf)));
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (scrub.current) {
        seek(frameFromEvent(e));
        return;
      }
      const d = drag.current;
      if (!d) return;
      const df = Math.round((e.clientX - d.x0) / ppf);
      const st = useStore.getState();
      if (d.mode === 'ramp' && d.ramp && d.seg !== undefined) {
        // moving a speed boundary: dragging right adds footage of the left part (at its speed)
        const segs = d.ramp.segments;
        const i = d.seg;
        const dsec = (e.clientX - d.x0) / ppf / fps;
        const sp = dsec > 0 ? segs[i - 1].speed : segs[i].speed;
        const lo = segs[i - 1].from + 0.05;
        const hi = (segs[i + 1]?.from ?? d.ramp.end) - 0.05;
        const from = Math.max(lo, Math.min(hi, segs[i].from + dsec * sp));
        st.setSpeedRamp(d.id, { ...d.ramp, segments: segs.map((s, k) => (k === i ? { ...s, from: Math.round(from * 100) / 100 } : s)) }, false);
        return;
      }
      if (d.mode === 'move') {
        let ns = Math.max(0, Math.min(total - 1, d.start0 + df));
        // snap to music beats (hold Alt to move freely)
        if (music && !e.altKey) {
          const near = music.beats.map((b) => Math.round(b * fps)).find((bf) => Math.abs(bf - ns) * ppf <= 6);
          if (near !== undefined) ns = near;
        }
        st.updateLayer(d.id, { start: ns }, false);
      }
      else if (d.mode === 'right') st.updateLayer(d.id, { duration: Math.max(1, d.dur0 + df) }, false);
      else {
        const ns = Math.max(0, Math.min(d.start0 + d.dur0 - 1, d.start0 + df));
        const patch: Partial<Layer> = { start: ns, duration: d.dur0 - (ns - d.start0) };
        // trimming the left edge of a song / video also skips that part of the file
        if (d.media) patch.trimStart = Math.max(0, d.trim0 + (ns - d.start0) / fps);
        st.updateLayer(d.id, patch, false);
      }
    };
    const up = () => {
      drag.current = null;
      scrub.current = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  });

  const startDrag = (e: React.PointerEvent, l: Layer, mode: TDrag['mode']) => {
    e.stopPropagation();
    useStore.getState().select(l.id);
    if (l.locked) return;
    useStore.getState().checkpoint();
    drag.current = { id: l.id, mode, x0: e.clientX, start0: l.start, dur0: l.duration, trim0: l.trimStart ?? 0, media: l.type === 'audio' || l.type === 'video' };
  };

  const seconds = Math.ceil(total / fps);
  const tickEvery = ppf < 1.5 ? 2 : 1;

  return (
    <div className="flex h-full min-h-0 flex-col border-t border-white/10 bg-[#161616]">
      <div className="flex items-center gap-3 border-b border-white/10 px-3 py-1.5">
        <button onClick={() => seek(0)} className="text-neutral-300 hover:text-white" title="Başa dön">
          ⏮
        </button>
        <button
          onClick={togglePlay}
          data-testid="play"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FF8E16] text-black hover:bg-[#ffa340]"
          title="Oynat / Duraklat (Boşluk)"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="font-mono text-xs text-neutral-200" data-testid="time">
          {formatTime(frame, fps)} <span className="text-neutral-500">/ {formatTime(total, fps)}</span>
        </span>
        <span className="text-[11px] text-neutral-500">kare {frame}</span>
        <div className="ml-auto flex items-center gap-2 text-xs text-neutral-400">
          <span>Süre (sn)</span>
          <div className="w-16">
            <NumInput value={total / fps} step={0.5} min={0.5} max={600} digits={1} onChange={(v) => useStore.getState().setDuration(v * fps)} />
          </div>
          <span className="ml-3">Yakınlaştır</span>
          <input type="range" min={0.6} max={12} step={0.1} value={ppf} onChange={(e) => setPpf(parseFloat(e.target.value))} className="w-28 accent-[#FF8E16]" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="relative" style={{ width: LABEL_W + width }}>
          {/* ruler */}
          <div className="sticky top-0 z-20 flex h-6 bg-[#1b1b1b]">
            <div className="sticky left-0 z-30 shrink-0 border-r border-white/10 bg-[#1b1b1b] px-3 text-[10px] leading-6 text-neutral-500" style={{ width: LABEL_W }}>
              KATMANLAR ({project.layers.length})
            </div>
            <div
              ref={trackRef}
              className="relative cursor-pointer border-b border-white/10"
              style={{ width }}
              data-testid="ruler"
              onPointerDown={(e) => {
                scrub.current = true;
                seek(frameFromEvent(e));
              }}
            >
              {sections.map((sec) => (
                <div
                  key={sec.id}
                  title={`${sec.label} (×${sec.boost})`}
                  className="pointer-events-none absolute top-0 h-full bg-pink-500/25 text-[9px] leading-3 text-pink-200"
                  style={{ left: sec.start * fps * ppf, width: Math.max(2, (sec.end - sec.start) * fps * ppf) }}
                >
                  {sec.label}
                </div>
              ))}
              {music?.beats.map((b, i) => (
                <div
                  key={i}
                  data-testid="beat-marker"
                  className={`pointer-events-none absolute bottom-0 w-px ${music.strong.includes(b) ? 'h-3 bg-[#FF8E16]' : 'h-1.5 bg-[#FF8E16]/60'}`}
                  style={{ left: b * fps * ppf }}
                />
              ))}
              {Array.from({ length: seconds + 1 }, (_, i) => i)
                .filter((i) => i % tickEvery === 0)
                .map((i) => (
                  <div key={i} className="absolute top-0 h-full border-l border-white/20 pl-1 text-[10px] text-neutral-400" style={{ left: i * fps * ppf }}>
                    {i}s
                  </div>
                ))}
            </div>
          </div>

          {rows.map((l) => {
            const meta = TYPE_META[l.type];
            const kfFrames = new Set<number>();
            ANIM_PROPS.forEach((p) => l.keyframes[p]?.forEach((k) => kfFrames.add(k.frame)));
            const sel = l.id === selectedId;
            return (
              <div key={l.id} className={`flex border-b border-white/5 ${sel ? 'bg-[#FF8E16]/10' : ''}`} style={{ height: ROW_H }}>
                <div
                  className="sticky left-0 z-10 flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-white/10 bg-[#161616] px-2 text-xs"
                  style={{ width: LABEL_W }}
                  onClick={() => useStore.getState().select(l.id)}
                >
                  <button
                    className={`w-4 text-[11px] ${l.visible ? 'text-neutral-300' : 'text-neutral-600'}`}
                    title={l.visible ? 'Gizle' : 'Göster'}
                    onClick={(e) => {
                      e.stopPropagation();
                      useStore.getState().updateLayer(l.id, { visible: !l.visible });
                    }}
                  >
                    {l.visible ? '👁' : '—'}
                  </button>
                  <span className="flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold text-white" style={{ background: meta.color }}>
                    {meta.icon}
                  </span>
                  <span className={`truncate ${sel ? 'text-[#FF8E16]' : 'text-neutral-200'}`}>{l.name}</span>
                  {l.locked && <span className="text-[10px]">🔒</span>}
                </div>
                <div
                  className="relative"
                  style={{ width }}
                  onPointerDown={(e) => {
                    scrub.current = true;
                    seek(frameFromEvent(e));
                  }}
                >
                  <div
                    data-testid={`bar-${l.id}`}
                    className={`absolute top-1 flex h-5 cursor-grab items-center overflow-hidden rounded text-[10px] font-semibold text-white ${sel ? 'ring-2 ring-[#FF8E16]' : ''} ${l.visible ? '' : 'opacity-40'}`}
                    style={{ left: l.start * ppf, width: Math.max(4, l.duration * ppf), background: meta.color }}
                    onPointerDown={(e) => startDrag(e, l, 'move')}
                  >
                    {!l.speedRamp && <div className="absolute top-0 left-0 h-full w-1.5 cursor-ew-resize bg-black/30" onPointerDown={(e) => startDrag(e, l, 'left')} />}
                    <span className="truncate px-2">{l.name}</span>
                    {!l.speedRamp && <div className="absolute top-0 right-0 h-full w-1.5 cursor-ew-resize bg-black/30" onPointerDown={(e) => startDrag(e, l, 'right')} />}
                    {l.speedRamp && <RampMarks l={l} ppf={ppf} fps={fps} onDrag={(e, i) => {
                      e.stopPropagation();
                      useStore.getState().select(l.id);
                      if (l.locked) return;
                      useStore.getState().checkpoint();
                      drag.current = { id: l.id, mode: 'ramp', x0: e.clientX, start0: l.start, dur0: l.duration, trim0: 0, media: true, seg: i, ramp: normalizeRamp(l.speedRamp!) };
                    }} />}
                    {[...kfFrames].map((f) => (
                      <div
                        key={f}
                        title={`Keyframe: ${formatTime(l.start + f, fps)}`}
                        className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-black bg-yellow-300"
                        style={{ left: f * ppf }}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          useStore.getState().select(l.id);
                          seek(l.start + f);
                        }}
                      />
                    ))}
                  </div>
                  {l.effects.map((ef) => {
                    const s = Math.min(ef.start, l.duration);
                    const w = Math.max(2, Math.min(ef.duration, l.duration - s) * ppf);
                    return (
                      <div
                        key={ef.id}
                        title={`${EFFECT_META[ef.type].label}: ${(ef.start / fps).toFixed(1)}s – ${((ef.start + ef.duration) / fps).toFixed(1)}s`}
                        className="pointer-events-none absolute h-1 rounded-full bg-yellow-300/70"
                        style={{ left: (l.start + s) * ppf, width: w, top: 26 }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}

          <div className="pointer-events-none absolute top-0 bottom-0 z-20 w-px bg-red-500" style={{ left: LABEL_W + frame * ppf }}>
            <div className="absolute -top-0 -left-1.5 h-3 w-3 rotate-45 bg-red-500" />
          </div>
        </div>
      </div>
    </div>
  );
};
