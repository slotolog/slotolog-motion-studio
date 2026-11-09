/**
 * Voice-over sources. Today only the user's own recording is available.
 *
 * An AI text-to-speech provider can be added later by registering a VoiceProvider here:
 * the Story Studio lists every registered provider, and a provider that needs a paid API
 * key stays disabled until the owner has approved it and entered a key. Nothing here calls
 * an external service.
 */
export interface VoiceRequest {
  text: string;
  /** e.g. 'tr-TR' */
  language: string;
  voiceId?: string;
  /** 0.5 – 2 */
  rate?: number;
}

export interface VoiceProvider {
  id: string;
  name: string;
  /** shown to the user next to the option */
  note: string;
  /** false while not set up / not approved */
  available: () => boolean;
  requiresApiKey: boolean;
  paid: boolean;
  synthesize?: (req: VoiceRequest) => Promise<Blob>;
}

export const VOICE_PROVIDERS: VoiceProvider[] = [
  {
    id: 'upload',
    name: 'Kendi ses kaydım (dosya yükle)',
    note: 'MP3, WAV, M4A. Kendi sesin veya hakkına sahip olduğun bir kayıt.',
    available: () => true,
    requiresApiKey: false,
    paid: false,
  },
  {
    id: 'ai-placeholder',
    name: 'Yapay zekâ seslendirme (henüz bağlı değil)',
    note: 'Altyapı hazır; ücretli bir servis gerektirdiği için onayın olmadan etkinleştirilmeyecek.',
    available: () => false,
    requiresApiKey: true,
    paid: true,
  },
];
