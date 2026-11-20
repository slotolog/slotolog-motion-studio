import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDelayRender } from 'remotion';
import type { CampaignStyle } from '../types';
import { campaignFontReady, ensureCampaignFont, renderCampaign } from './campaign3d';

/** rendered frames are deterministic (style + frame + size) → small LRU so looping previews and the second
 *  encoding pass reuse them instead of rendering the 3D scene again */
const frameCache = new Map<string, HTMLCanvasElement>();
const MAX_FRAMES = 140;
function cached(key: string, make: () => HTMLCanvasElement) {
  const hit = frameCache.get(key);
  if (hit) {
    frameCache.delete(key);
    frameCache.set(key, hit);
    return hit;
  }
  const c = make();
  frameCache.set(key, c);
  if (frameCache.size > MAX_FRAMES) frameCache.delete(frameCache.keys().next().value as string);
  return c;
}

/** Slotolog Bonus Emojileri: 3D kampanya emojisi ya da yazılı başlık şeridinin bir parçası (her kare tek paylaşılan WebGL ile çizilir) */
export const CampaignView: React.FC<{ style: CampaignStyle; width: number; height: number; frame: number; duration: number }> = ({ style, width, height, frame, duration }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(campaignFontReady());
  const handle = useRef<number | null>(null);
  const { delayRender, continueRender } = useDelayRender();
  if (!ready && handle.current === null) handle.current = delayRender('3D yazı tipi yükleniyor');
  useEffect(() => {
    if (ready) return;
    let alive = true;
    ensureCampaignFont()
      .catch(() => undefined)
      .then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, [ready]);
  const side = Math.max(1, Math.round(Math.min(width, height)));
  useLayoutEffect(() => {
    if (!ready) return;
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    const L = Math.max(1, duration);
    const p = (((frame % L) + L) % L) / L;
    const tiles = style.kind === 'strip' ? Math.max(1, style.tiles ?? 1) : 1;
    const tile = Math.min(tiles - 1, Math.max(0, style.tile ?? 0));
    const key = `${style.kind}|${style.text ?? ''}|${tiles}|${tile}|${style.brightness ?? 1}|${style.shine ?? 1}|${side}|${L}|${((frame % L) + L) % L}`;
    const img = cached(key, () => {
      const src = renderCampaign({ kind: style.kind, text: style.text, tiles, p, size: side, brightness: style.brightness ?? 1, shine: style.shine ?? 1 });
      const c = document.createElement('canvas');
      c.width = side;
      c.height = side;
      c.getContext('2d')!.drawImage(src, tile * side, 0, side, side, 0, 0, side, side);
      return c;
    });
    ctx.clearRect(0, 0, side, side);
    ctx.drawImage(img, 0, 0);
    if (handle.current !== null && handle.current !== -1) {
      continueRender(handle.current);
      handle.current = -1;
    }
  }, [ready, frame, duration, side, JSON.stringify(style)]);
  return <canvas ref={ref} width={side} height={side} style={{ position: 'absolute', left: (width - side) / 2, top: (height - side) / 2, width: side, height: side, display: 'block' }} />;
};
