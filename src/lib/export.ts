import { canRenderMediaOnWeb, renderMediaOnWeb, type WebRendererQuality } from '@remotion/web-renderer';
import { MainComposition } from '../remotion/Main';
import { ensureFonts } from './fonts';
import type { Project } from '../types';
import { ASPECT_SIZES } from '../types';

export const LICENSE_KEY_STORAGE = 'slotolog:remotionLicense';
export const getLicenseKey = () => localStorage.getItem(LICENSE_KEY_STORAGE) || 'free-license';

export function projectHasAudio(p: Project) {
  return p.layers.some((l) => l.visible && !l.muted && (l.type === 'audio' || l.type === 'video') && !!l.assetId);
}

export async function checkExportSupport(p: Project) {
  const { width, height } = ASPECT_SIZES[p.aspect];
  return canRenderMediaOnWeb({ width, height, container: 'mp4', videoCodec: 'h264', muted: !projectHasAudio(p) });
}

export async function exportMp4(
  project: Project,
  assetUrls: Record<string, string>,
  opts: { quality: WebRendererQuality; signal: AbortSignal; onProgress: (p: number, etaMs: number) => void },
): Promise<Blob> {
  await ensureFonts();
  const { width, height } = ASPECT_SIZES[project.aspect];
  const muted = !projectHasAudio(project);
  const result = await renderMediaOnWeb({
    composition: {
      id: 'slotolog',
      component: MainComposition,
      width,
      height,
      fps: project.fps,
      durationInFrames: project.durationInFrames,
      defaultProps: { project, assetUrls },
    },
    inputProps: { project, assetUrls },
    container: 'mp4',
    videoCodec: 'h264',
    muted,
    videoBitrate: opts.quality,
    signal: opts.signal,
    licenseKey: getLicenseKey(),
    onProgress: (p) => opts.onProgress(p.progress, p.renderEstimatedTime),
  });
  return result.getBlob();
}
