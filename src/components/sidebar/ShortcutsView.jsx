import React, { useState, useEffect } from 'react';
import { Keyboard, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';

function ShortcutsView() {
  const { shortcuts, setShortcuts } = useBrowserStore();
  const [recording, setRecording] = useState(null);

  useEffect(() => {
    window.flipAPI?.getShortcuts?.().then(s => { if (s) setShortcuts(s); });
  }, []);

  function startRecording(key) {
    setRecording(key);
  }

  useEffect(() => {
    if (!recording) return;
    function handleKey(e) {
      e.preventDefault();
      e.stopPropagation();
      const parts = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Meta');
      const key = e.key;
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        parts.push(key.length === 1 ? key.toUpperCase() : key);
        const combo = parts.join('+');
        const updated = { ...shortcuts, [recording]: combo };
        setShortcuts(updated);
        window.flipAPI?.saveShortcuts?.(updated);
        setRecording(null);
      }
    }
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [recording, shortcuts]);

  function resetDefaults() {
    const defaults = {
      newTab: 'Ctrl+T', closeTab: 'Ctrl+W', reopenTab: 'Ctrl+Shift+T',
      commandPalette: 'Ctrl+K', focusAddress: 'Ctrl+L', toggleSidebar: 'Ctrl+B',
      splitView: 'Ctrl+Shift+S', devTools: 'F12', reload: 'Ctrl+R',
      zoomIn: 'Ctrl+=', zoomOut: 'Ctrl+-', zoomReset: 'Ctrl+0', pip: 'Ctrl+Shift+P',
    };
    setShortcuts(defaults);
    window.flipAPI?.saveShortcuts?.(defaults);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
            <Keyboard size={14} className="text-flip-400" />
            Keyboard Shortcuts
          </h2>
          <button onClick={resetDefaults} className="text-[9px] text-white/20 hover:text-white/40 transition-colors flex items-center gap-1">
            <RotateCcw size={9} /> Reset
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
        {Object.entries(SHORTCUT_LABELS).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between px-2.5 py-2 rounded-lg hover:bg-white/[0.02] transition-colors">
            <span className="text-[10px] text-white/50">{label}</span>
            <button
              onClick={() => startRecording(key)}
              className={clsx(
                'px-2.5 py-1 rounded-lg text-[9px] font-mono border transition-all',
                recording === key
                  ? 'border-flip-500/40 bg-flip-500/10 text-flip-400 animate-pulse'
                  : 'border-white/10 bg-white/5 text-white/40 hover:border-white/20'
              )}
            >
              {recording === key ? 'Press keys...' : shortcuts[key] || '—'}
            </button>
          </div>
        ))}
        <div className="pt-2 border-t border-white/5 mt-2">
          <div className="flex items-start gap-2">
            <Keyboard size={9} className="text-white/15 mt-0.5" />
            <span className="text-[9px] text-white/20">Click a shortcut to rebind it. Press your desired key combination.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ShortcutsView;
