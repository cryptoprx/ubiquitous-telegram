import React from 'react';
import { Minus, Square, X, ShieldOff } from 'lucide-react';
import FlipLogo from './FlipLogo';

const isPrivate = new URLSearchParams(window.location.search).get('private') === '1';

export default function TitleBar() {
  const minimize = () => window.flipAPI?.minimize();
  const maximize = () => window.flipAPI?.maximize();
  const close = () => window.flipAPI?.close();

  return (
    <div className="drag-region flex items-center justify-between h-9 bg-surface-1/80 backdrop-blur-md border-b border-white/5 px-3">
      {/* Brand */}
      <div className="flex items-center gap-2 no-drag">
        <FlipLogo size={20} className="flip-logo" />
        <span className="text-[11px] font-bold tracking-[0.2em] uppercase">
          <span className="flip-gradient-text">FLIP</span>
        </span>
        {isPrivate && (
          <div className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/20">
            <ShieldOff size={9} className="text-purple-400" />
            <span className="text-[9px] text-purple-400 font-semibold uppercase tracking-wider">Private</span>
          </div>
        )}
      </div>

      {/* Window controls */}
      <div className="flex items-center gap-1 no-drag">
        <button
          onClick={minimize}
          className="w-8 h-6 flex items-center justify-center text-white/30 hover:text-white rounded-full hover:bg-white/10 transition-all duration-150"
          aria-label="Minimize"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={maximize}
          className="w-8 h-6 flex items-center justify-center text-white/30 hover:text-white rounded-full hover:bg-white/10 transition-all duration-150"
          aria-label="Maximize"
        >
          <Square size={9} />
        </button>
        <button
          onClick={close}
          className="w-8 h-6 flex items-center justify-center text-white/30 hover:text-white rounded-full hover:bg-red-500/70 transition-all duration-150"
          aria-label="Close"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
