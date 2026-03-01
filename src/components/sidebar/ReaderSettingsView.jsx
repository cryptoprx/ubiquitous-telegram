import React, { useState } from 'react';
import { Settings, BookOpenCheck } from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';

function ReaderSettingsView() {
  const { readerSettings, setReaderSettings } = useBrowserStore();
  const [local, setLocal] = useState({ ...readerSettings });

  function update(partial) {
    const next = { ...local, ...partial };
    setLocal(next);
    setReaderSettings(next);
    window.flipAPI?.saveReaderSettings(next);
  }

  const BG_PRESETS = [
    { label: 'Dark', bg: '#1a1a1a', text: '#e0e0e0' },
    { label: 'Sepia', bg: '#f4ecd8', text: '#5b4636' },
    { label: 'Light', bg: '#ffffff', text: '#1a1a1a' },
    { label: 'Night', bg: '#0d1117', text: '#c9d1d9' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <BookOpenCheck size={14} className="text-flip-400" />
          Reader Settings
        </h2>
        <p className="text-[9px] text-white/25 mt-1">Customize reading mode appearance.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Font size */}
        <div>
          <label className="text-[10px] text-white/40 mb-1.5 block">Font Size: {local.fontSize}px</label>
          <input
            type="range"
            min={12}
            max={32}
            value={local.fontSize}
            onChange={(e) => update({ fontSize: parseInt(e.target.value) })}
            className="w-full accent-flip-500"
          />
          <div className="flex justify-between text-[8px] text-white/20 mt-0.5">
            <span>12px</span><span>32px</span>
          </div>
        </div>

        {/* Font family */}
        <div>
          <label className="text-[10px] text-white/40 mb-1.5 block">Font Family</label>
          <div className="flex gap-2">
            {['serif', 'sans', 'mono'].map((ff) => (
              <button
                key={ff}
                onClick={() => update({ fontFamily: ff })}
                className={clsx(
                  'flex-1 px-3 py-2 rounded-lg border text-[10px] font-medium transition-all',
                  local.fontFamily === ff
                    ? 'border-flip-500/30 bg-flip-500/10 text-flip-400'
                    : 'border-white/10 bg-white/[0.02] text-white/40 hover:bg-white/[0.04]'
                )}
                style={{ fontFamily: ff === 'serif' ? 'Georgia, serif' : ff === 'sans' ? 'system-ui, sans-serif' : 'monospace' }}
              >
                {ff === 'serif' ? 'Serif' : ff === 'sans' ? 'Sans' : 'Mono'}
              </button>
            ))}
          </div>
        </div>

        {/* Background presets */}
        <div>
          <label className="text-[10px] text-white/40 mb-1.5 block">Theme</label>
          <div className="grid grid-cols-2 gap-2">
            {BG_PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => update({ bgColor: preset.bg, textColor: preset.text })}
                className={clsx(
                  'px-3 py-2.5 rounded-lg border text-[10px] font-medium transition-all',
                  local.bgColor === preset.bg
                    ? 'border-flip-500/30 ring-1 ring-flip-500/20'
                    : 'border-white/10 hover:border-white/20'
                )}
                style={{ background: preset.bg, color: preset.text }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="mt-2">
          <label className="text-[10px] text-white/40 mb-1.5 block">Preview</label>
          <div
            className="rounded-lg p-4 border border-white/10"
            style={{ background: local.bgColor, color: local.textColor, fontFamily: local.fontFamily === 'serif' ? 'Georgia, serif' : local.fontFamily === 'sans' ? 'system-ui, sans-serif' : 'monospace', fontSize: `${local.fontSize}px`, lineHeight: 1.8 }}
          >
            The quick brown fox jumps over the lazy dog. Reading mode makes articles clean and focused.
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReaderSettingsView;
