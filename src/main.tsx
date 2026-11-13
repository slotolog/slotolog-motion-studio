import { drawBonusFrame } from './remotion/Bonus';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './index.css';
import { useStore } from './store';
import * as ramp from './lib/speedramp';
import * as format from './lib/reformat';
import { seek } from './lib/player';
import * as emoji from './lib/emoji';
import * as emojiTemplates from './lib/emojiTemplates';
import * as reel from './lib/reel';

// handle for automated browser tests (read-only use)
(window as unknown as { __slotolog: typeof useStore }).__slotolog = useStore;
(window as unknown as { __slotologRamp: typeof ramp }).__slotologRamp = ramp;
(window as unknown as { __slotologFormat: typeof format }).__slotologFormat = format;
(window as unknown as { __slotologSeek: typeof seek }).__slotologSeek = seek;
(window as unknown as { __slotologEmoji: unknown }).__slotologEmoji = { ...emoji, ...emojiTemplates, reel, drawBonusFrame };

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
