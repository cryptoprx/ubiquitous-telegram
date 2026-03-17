import React from 'react';
import { Minus, Square, X, ShieldOff } from 'lucide-react';
import FlipLogo from './FlipLogo';

const isPrivate = new URLSearchParams(window.location.search).get('private') === '1';
const isMac = navigator.userAgent.includes('Mac');

export default function TitleBar() {
  const minimize = () => window.flipAPI?.minimize();
  const maximize = () => window.flipAPI?.maximize();
  const close = () => window.flipAPI?.close();

  return (
    <div className="drag-region flex items-center h-11 bg-surface-1/70 backdrop-blur-2xl border-b border-white/[0.06] px-3">
      {/* macOS: empty spacer for native traffic lights */}
      {isMac && <div className="w-[70px] flex-shrink-0" />}

      {/* Brand — centered on macOS, left-aligned on Windows */}
      <div className={`flex items-center gap-2.5 no-drag ${isMac ? 'flex-1 justify-center' : ''}`}>
        <FlipLogo size={22} className="flip-logo" />
        <span className="text-[11px] font-semibold tracking-[0.2em] uppercase">
          <span className="flip-gradient-text">FLIP</span>
        </span>
        {isPrivate && (
          <div className="flex items-center gap-1 ml-1 px-2 py-0.5 rounded-[8px] bg-purple-500/10 border border-purple-500/15">
            <ShieldOff size={9} className="text-purple-400/80" />
            <span className="text-[9px] text-purple-400/80 font-medium uppercase tracking-wider">Private</span>
          </div>
        )}
      </div>

      {/* Spacer to push brand to center on macOS */}
      {isMac && <div className="w-[70px] flex-shrink-0" />}

      {/* Window controls — hidden on macOS (native traffic lights handle it) */}
      {!isMac && (
        <div className="flex items-center gap-1.5 no-drag ml-auto">
          <button
            onClick={minimize}
            className="w-8 h-7 flex items-center justify-center text-white/30 hover:text-white/80 rounded-[8px] hover:bg-white/[0.06] transition-all duration-200"
            aria-label="Minimize"
          >
            <Minus size={13} />
          </button>
          <button
            onClick={maximize}
            className="w-8 h-7 flex items-center justify-center text-white/30 hover:text-white/80 rounded-[8px] hover:bg-white/[0.06] transition-all duration-200"
            aria-label="Maximize"
          >
            <Square size={10} />
          </button>
          <button
            onClick={close}
            className="w-8 h-7 flex items-center justify-center text-white/30 hover:text-white rounded-[8px] hover:bg-red-500/50 transition-all duration-200"
            aria-label="Close"
          >
            <X size={13} />
          </button>
        </div>
      )}
    </div>
  );
}
