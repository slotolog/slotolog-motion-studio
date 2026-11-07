import type { PlayerRef } from '@remotion/player';

/** Shared handle to the preview player so the timeline can control it. */
export const playerApi: { ref: PlayerRef | null } = { ref: null };

export function seek(frame: number) {
  playerApi.ref?.seekTo(Math.max(0, Math.round(frame)));
}

export function togglePlay() {
  const r = playerApi.ref;
  if (!r) return;
  if (r.isPlaying()) r.pause();
  else r.play();
}

export function formatTime(frame: number, fps: number) {
  const total = frame / fps;
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const cs = Math.floor((total % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}
