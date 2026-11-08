import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { MainComposition } from '../remotion/Main';
import { useStore } from '../store';
import { propAt } from '../lib/anim';
import { playerApi } from '../lib/player';
import { ASPECT_SIZES, type Layer } from '../types';

const FULL = new Set(['background', 'particles', 'audio', 'camera']);

function boxAt(l: Layer, frame: number) {
  const local = frame - l.start;
  return {
    x: propAt(l, 'x', local),
    y: propAt(l, 'y', local),
    s: propAt(l, 'scale', local),
    r: propAt(l, 'rotation', local),
  };
}

function hit(l: Layer, frame: number, px: number, py: number) {
  const b = boxAt(l, frame);
  const rad = (-b.r * Math.PI) / 180;
  const dx = px - b.x;
  const dy = py - b.y;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  return Math.abs(lx) <= (l.width * Math.abs(b.s)) / 2 && Math.abs(ly) <= (l.height * Math.abs(b.s)) / 2;
}

type Drag =
  | { kind: 'move'; id: string; px: number; py: number; x0: number; y0: number }
  | { kind: 'resize'; id: string; d0: number; w0: number; h0: number; fs0?: number; sw0?: number }
  | { kind: 'rotate'; id: string };

export const Preview: React.FC = () => {
  const project = useStore((s) => s.project);
  const assetUrls = useStore((s) => s.assetUrls);
  const selectedId = useStore((s) => s.selectedId);
  const frame = useStore((s) => s.frame);
  const { width: W, height: H } = ASPECT_SIZES[project.aspect];
  const wrapRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef>(null);
  const [box, setBox] = useState({ w: 400, h: 400 });
  const [guides, setGuides] = useState<{ v: boolean; h: boolean }>({ v: false, h: false });
  const drag = useRef<Drag | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth - 32, h: el.clientHeight - 32 }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const k = Math.max(0.05, Math.min(box.w / W, box.h / H));
  const dw = W * k;
  const dh = H * k;

  useEffect(() => {
    const p = playerRef.current;
    playerApi.ref = p;
    if (!p) return;
    // the player is re-created when the aspect ratio changes: keep the playhead
    p.seekTo(useStore.getState().frame);
    const onFrame = (e: { detail: { frame: number } }) => useStore.getState().setFrame(e.detail.frame);
    const onPlay = () => useStore.getState().setPlaying(true);
    const onPause = () => useStore.getState().setPlaying(false);
    p.addEventListener('frameupdate', onFrame);
    p.addEventListener('seeked', onFrame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    return () => {
      p.removeEventListener('frameupdate', onFrame);
      p.removeEventListener('seeked', onFrame);
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
    };
  }, [project.aspect]);

  const inputProps = useMemo(() => ({ project, assetUrls }), [project, assetUrls]);

  const toComp = (e: { clientX: number; clientY: number }) => {
    const rect = wrapRef.current!.querySelector('[data-stage]')!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / k, y: (e.clientY - rect.top) / k };
  };

  const active = project.layers.filter(
    (l) => l.visible && !FULL.has(l.type) && frame >= l.start && frame < l.start + l.duration,
  );
  const selected = project.layers.find((l) => l.id === selectedId) ?? null;

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const st = useStore.getState();
      const l = st.project.layers.find((x) => x.id === d.id);
      if (!l) return;
      const p = toComp(e);
      if (d.kind === 'move') {
        let nx = d.x0 + (p.x - d.px);
        let ny = d.y0 + (p.y - d.py);
        const snap = 14 / k;
        const v = Math.abs(nx - W / 2) < snap;
        const h = Math.abs(ny - H / 2) < snap;
        if (v && !e.altKey) nx = W / 2;
        if (h && !e.altKey) ny = H / 2;
        setGuides({ v, h });
        st.setLayerProp(d.id, 'x', Math.round(nx), false);
        st.setLayerProp(d.id, 'y', Math.round(ny), false);
      } else if (d.kind === 'resize') {
        const b = boxAt(l, st.frame);
        const dist = Math.hypot(p.x - b.x, p.y - b.y);
        const ratio = Math.max(0.05, dist / d.d0);
        const patch: Partial<Layer> = { width: Math.round(d.w0 * ratio), height: Math.round(d.h0 * ratio) };
        if (l.text && l.type === 'text' && d.fs0) {
          patch.text = { ...l.text, fontSize: Math.round(d.fs0 * ratio), strokeWidth: Math.round((d.sw0 ?? 0) * ratio) };
        }
        st.updateLayer(d.id, patch, false);
      } else {
        const b = boxAt(l, st.frame);
        let a = (Math.atan2(p.y - b.y, p.x - b.x) * 180) / Math.PI + 90;
        if (e.shiftKey) a = Math.round(a / 15) * 15;
        if (a > 180) a -= 360;
        st.setLayerProp(d.id, 'rotation', Math.round(a * 10) / 10, false);
      }
    };
    const onUp = () => {
      drag.current = null;
      setGuides({ v: false, h: false });
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  });

  const onStageDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const p = toComp(e);
    const st = useStore.getState();
    const target = [...active].reverse().find((l) => hit(l, frame, p.x, p.y));
    if (!target) {
      st.select(null);
      return;
    }
    st.select(target.id);
    if (target.locked) return;
    const b = boxAt(target, frame);
    st.checkpoint();
    drag.current = { kind: 'move', id: target.id, px: p.x, py: p.y, x0: b.x, y0: b.y };
  };

  const startResize = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!selected || selected.locked) return;
    const p = toComp(e);
    const b = boxAt(selected, frame);
    useStore.getState().checkpoint();
    drag.current = {
      kind: 'resize',
      id: selected.id,
      d0: Math.max(1, Math.hypot(p.x - b.x, p.y - b.y)),
      w0: selected.width,
      h0: selected.height,
      fs0: selected.text?.fontSize,
      sw0: selected.text?.strokeWidth,
    };
  };
  const startRotate = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (!selected || selected.locked) return;
    useStore.getState().checkpoint();
    drag.current = { kind: 'rotate', id: selected.id };
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const st = useStore.getState();
    const p = toComp(e);
    const assetId = e.dataTransfer.getData('application/x-slotolog-asset');
    if (assetId) {
      st.addAssetLayer(assetId, p);
      return;
    }
    for (const f of Array.from(e.dataTransfer.files)) {
      try {
        const a = await st.addAssetFromFile(f);
        st.addAssetLayer(a.id, p);
      } catch (err) {
        alert((err as Error).message);
      }
    }
  };

  const sel = selected && !FULL.has(selected.type) && frame >= selected.start && frame < selected.start + selected.duration ? selected : null;
  const sb = sel ? boxAt(sel, frame) : null;

  return (
    <div
      ref={wrapRef}
      className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center overflow-hidden bg-[#0d0d0d] bg-[radial-gradient(circle_at_center,#1b1b1b_0%,#0d0d0d_70%)] p-4"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onDrop}
    >
      <div data-stage className="relative shadow-[0_0_60px_rgba(255,142,22,0.15)]" style={{ width: dw, height: dh }}>
        <Player
          ref={playerRef}
          key={project.aspect}
          component={MainComposition}
          inputProps={inputProps}
          durationInFrames={project.durationInFrames}
          fps={project.fps}
          compositionWidth={W}
          compositionHeight={H}
          style={{ width: dw, height: dh }}
          loop
          acknowledgeRemotionLicense
          numberOfSharedAudioTags={8}
        />
        <div className="absolute inset-0 cursor-default select-none" onPointerDown={onStageDown} data-testid="stage-overlay">
          {guides.v && <div className="pointer-events-none absolute top-0 bottom-0 w-px bg-cyan-400" style={{ left: dw / 2 }} />}
          {guides.h && <div className="pointer-events-none absolute right-0 left-0 h-px bg-cyan-400" style={{ top: dh / 2 }} />}
          {sel && sb && (
            <div
              className="absolute border-2 border-[#FF8E16]"
              style={{
                left: (sb.x - (sel.width * sb.s) / 2) * k,
                top: (sb.y - (sel.height * sb.s) / 2) * k,
                width: sel.width * sb.s * k,
                height: sel.height * sb.s * k,
                transform: `rotate(${sb.r}deg)`,
                pointerEvents: 'none',
              }}
            >
              {!sel.locked && (
                <>
                  {(['-left-1.5 -top-1.5', '-right-1.5 -top-1.5', '-left-1.5 -bottom-1.5', '-right-1.5 -bottom-1.5'] as const).map((c) => (
                    <div
                      key={c}
                      onPointerDown={startResize}
                      className={`pointer-events-auto absolute ${c} h-3 w-3 cursor-nwse-resize rounded-sm border border-black bg-white`}
                    />
                  ))}
                  <div className="absolute -top-7 left-1/2 h-6 w-px bg-[#FF8E16]" />
                  <div
                    onPointerDown={startRotate}
                    title="Döndür (Shift: 15°)"
                    className="pointer-events-auto absolute -top-9 left-1/2 h-4 w-4 -translate-x-1/2 cursor-grab rounded-full border-2 border-[#FF8E16] bg-[#1E1E1E]"
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-3 text-[10px] text-neutral-500">
        {W}×{H} · {Math.round(k * 100)}% · Sürükle: taşı · Köşe: boyut · Üst tutamaç: döndür · Alt: yapışmayı kapat
      </div>
    </div>
  );
};
