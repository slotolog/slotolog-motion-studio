import React, { useEffect, useState } from 'react';
import { useStore } from './store';
import { ensureFonts } from './lib/fonts';
import { loadProject } from './lib/storage';
import { seek, togglePlay } from './lib/player';
import { multiplierTemplate } from './lib/templates';
import { TopBar } from './components/TopBar';
import { Library } from './components/Library';
import { Preview } from './components/Preview';
import { Inspector } from './components/Inspector';
import { Timeline } from './components/Timeline';
import { StoryLeft, StoryRight } from './components/StoryStudio';

export const App: React.FC = () => {
  const [ready, setReady] = useState(false);
  const storyMode = useStore((s) => s.storyMode && !!s.project.story);

  useEffect(() => {
    (async () => {
      await ensureFonts().catch((e) => console.warn('Font yüklenemedi', e));
      const last = localStorage.getItem('slotolog:lastProject');
      const p = last ? await loadProject(last).catch(() => undefined) : undefined;
      await useStore.getState().loadIntoEditor(p ?? multiplierTemplate());
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
      const st = useStore.getState();
      const mod = e.metaKey || e.ctrlKey;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        st.redo();
      } else if (mod && e.key.toLowerCase() === 'd' && st.selectedId) {
        e.preventDefault();
        st.duplicateLayer(st.selectedId);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && st.selectedId) {
        e.preventDefault();
        st.removeLayer(st.selectedId);
      } else if (e.key === 'Escape') {
        st.select(null);
      } else if (e.key.startsWith('Arrow') && st.selectedId) {
        e.preventDefault();
        const l = st.project.layers.find((x) => x.id === st.selectedId);
        if (!l || l.locked) return;
        const d = e.shiftKey ? 10 : 1;
        const local = st.frame - l.start;
        const kx = l.keyframes.x?.length ? null : l.x;
        const ky = l.keyframes.y?.length ? null : l.y;
        void local;
        if (e.key === 'ArrowLeft') st.setLayerProp(l.id, 'x', (kx ?? l.x) - d);
        if (e.key === 'ArrowRight') st.setLayerProp(l.id, 'x', (kx ?? l.x) + d);
        if (e.key === 'ArrowUp') st.setLayerProp(l.id, 'y', (ky ?? l.y) - d);
        if (e.key === 'ArrowDown') st.setLayerProp(l.id, 'y', (ky ?? l.y) + d);
      } else if (e.key === 'Home') {
        seek(0);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!ready)
    return (
      <div className="flex h-full items-center justify-center text-sm text-neutral-400">
        <span className="mr-2 inline-block h-3 w-3 animate-ping rounded-full bg-[#FF8E16]" /> Slotolog Motion Studio yükleniyor…
      </div>
    );

  return (
    <div className="flex h-full flex-col">
      <TopBar />
      <div className="flex min-h-0 flex-1">
        {storyMode ? (
          <>
            <aside className="w-[400px] shrink-0 border-r border-white/10 bg-[#1a1a1a]" data-testid="story-left">
              <StoryLeft />
            </aside>
            <Preview />
            <aside className="w-[360px] shrink-0 border-l border-white/10 bg-[#1a1a1a]">
              <StoryRight />
            </aside>
          </>
        ) : (
          <>
            <aside className="w-72 shrink-0 border-r border-white/10 bg-[#1a1a1a]">
              <Library />
            </aside>
            <Preview />
            <aside className="w-80 shrink-0 overflow-y-auto border-l border-white/10 bg-[#1a1a1a]">
              <Inspector />
            </aside>
          </>
        )}
      </div>
      <div className="h-64 shrink-0">
        <Timeline />
      </div>
    </div>
  );
};
