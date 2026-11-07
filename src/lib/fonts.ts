import { loadFont } from '@remotion/fonts';
import latin900 from '@fontsource/montserrat/files/montserrat-latin-900-normal.woff2?url';
import latinExt900 from '@fontsource/montserrat/files/montserrat-latin-ext-900-normal.woff2?url';
import latin900i from '@fontsource/montserrat/files/montserrat-latin-900-italic.woff2?url';
import latinExt900i from '@fontsource/montserrat/files/montserrat-latin-ext-900-italic.woff2?url';
import latin700 from '@fontsource/montserrat/files/montserrat-latin-700-normal.woff2?url';
import latinExt700 from '@fontsource/montserrat/files/montserrat-latin-ext-700-normal.woff2?url';

export const FONT_FAMILY = 'Montserrat';

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

let promise: Promise<void> | null = null;

/** Loads the Montserrat font (bundled, works offline) once. */
export function ensureFonts(): Promise<void> {
  if (!promise) {
    const faces: [string, string, string, string][] = [
      [latin900, '900', 'normal', LATIN],
      [latinExt900, '900', 'normal', LATIN_EXT],
      [latin900i, '900', 'italic', LATIN],
      [latinExt900i, '900', 'italic', LATIN_EXT],
      [latin700, '700', 'normal', LATIN],
      [latinExt700, '700', 'normal', LATIN_EXT],
    ];
    promise = Promise.all(
      faces.map(([url, weight, style, unicodeRange]) =>
        loadFont({ family: FONT_FAMILY, url, weight, style, unicodeRange, format: 'woff2' }),
      ),
    ).then(() => undefined);
  }
  return promise;
}
