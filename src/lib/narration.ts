import type { NarrationStyle, SceneKind, StoryData } from '../types';

/**
 * Editable voice-over text templates for the Big Win Story.
 *
 * Rules: templates only use data the user entered ({gameName}, {betAmount}, {totalWin} …)
 * and generic lines about the purpose of each scene. Anything specific that must come from
 * the real recording is left as a [bracket] for the user to fill in — the system never adds
 * events or win amounts that were not verified. Unfilled brackets raise a warning.
 */
export const NARRATION_STYLES: { id: NarrationStyle; name: string; note: string }[] = [
  { id: 'excited', name: 'Heyecanlı oyun yorumu', note: 'Canlı, enerjik yorumcu dili; kısa ünlemler.' },
  { id: 'story', name: 'Hikâye anlatımı', note: 'Sakin, adım adım anlatım.' },
  { id: 'cinematic', name: 'Sinematik anlatım', note: 'Kısa, vurucu, fragman tarzı cümleler.' },
];

export const DEFAULT_NARRATION: NarrationStyle = 'excited';

const T: Record<NarrationStyle, Partial<Record<SceneKind, string>>> = {
  excited: {
    hook: 'İşte o an! Ekranda {totalWin}!',
    flashback: 'Peki her şey nasıl başladı? Başa saralım!',
    start: '{gameName} açılıyor, bahis {betAmount}. [İlk dönüşte ekranda ne oldu?]',
    rising: 'Dönüşler devam ediyor! [Ekranda görünen anı yaz: çarpan, bonus, free spin…]',
    bigwin: 'Ve işte büyük an! Toplam kazanç {totalWin}!',
    outro: '{campaignText}: {bonusAmount} ve {freeSpinCount} Free Spin Slotolog’da!',
    custom: '[Bu sahnede ekranda olanı yaz.]',
  },
  story: {
    hook: 'Ekranda {totalWin} yazıyordu. Ama bu hikâye birkaç dönüş önce başladı.',
    flashback: 'Gelin başa dönelim.',
    start: 'Oyun {gameName}, başlangıç bahsi {betAmount}. [İlk dönüşleri anlat.]',
    rising: '[Ekranda gördüğün gelişmeyi sırayla anlat.]',
    bigwin: 'Ve sonunda toplam kazanç {totalWin} oldu.',
    outro: '{campaignText} {bonusAmount} ve {freeSpinCount} Free Spin seni bekliyor.',
    custom: '[Bu sahnede ekranda olanı anlat.]',
  },
  cinematic: {
    hook: 'Tek an. {totalWin}.',
    flashback: 'Geri saralım.',
    start: '{gameName}. {betAmount}. İlk dönüş.',
    rising: 'Gerilim artıyor. [Ekrandaki anı tek cümleyle yaz.]',
    bigwin: 'Ve… {totalWin}.',
    outro: 'Sıra sende. {bonusAmount} + {freeSpinCount} Free Spin.',
    custom: '[Kısa, vurucu bir cümle.]',
  },
};

export const narrationLine = (style: NarrationStyle, kind: SceneKind) => T[style][kind] ?? '';

/** Fills the scenes' voice-over texts with the style's templates (only empty ones unless overwrite). */
export function applyNarration(story: StoryData, style: NarrationStyle, overwrite: boolean): StoryData {
  const scenes = story.scenes.map((s) => (overwrite || !s.voText.trim() ? { ...s, voText: narrationLine(style, s.kind), anchorSentence: undefined } : s));
  return { ...story, narrationStyle: style, scenes, script: scenes.map((s) => s.voText).filter(Boolean).join('\n\n') };
}
