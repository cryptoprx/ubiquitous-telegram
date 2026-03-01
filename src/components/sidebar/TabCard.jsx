import { Globe, X, Volume2, VolumeX } from 'lucide-react';
import clsx from 'clsx';
import { getAgeFade } from './tabHelpers';

function TabCard({ tab, isActive, onClick, onClose, onContext, accentColor, compact, index = 0 }) {
  const ageFade = getAgeFade(tab.lastActive);

  return (
    <div
      onClick={onClick}
      onContextMenu={onContext}
      className={clsx(
        'group flex items-center gap-2.5 cursor-pointer transition-all duration-200 relative animate-fade-in-up',
        compact ? 'px-3 py-1.5 ml-1' : 'px-3 py-2 mx-1 rounded-xl mb-0.5',
        isActive
          ? 'bg-white/[0.06] shadow-[0_0_12px_rgba(255,98,52,0.06)]'
          : 'hover:bg-white/[0.03]'
      )}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {/* Age indicator bar */}
      {!compact && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-full transition-all duration-500"
          style={{
            height: isActive ? 20 : 14,
            backgroundColor: accentColor || (isActive ? '#ff6234' : `rgba(255,255,255,${ageFade * 0.4})`),
            opacity: isActive ? 1 : ageFade,
          }}
        />
      )}

      {/* Favicon */}
      {tab.favicon ? (
        <img src={tab.favicon} className={clsx('rounded-sm flex-shrink-0', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} alt="" />
      ) : (
        <Globe size={compact ? 13 : 14} className="flex-shrink-0 text-white/30" />
      )}

      {/* Title & meta */}
      <div className="flex-1 min-w-0">
        <div className={clsx('truncate leading-tight', compact ? 'text-[11px]' : 'text-xs')}
          style={{ opacity: isActive ? 1 : Math.max(ageFade, 0.5) }}
        >
          {tab.title || 'New Tab'}
        </div>
        {tab.suspended && (
          <div className="text-[9px] text-flip-400/60">Suspended</div>
        )}
      </div>

      {/* Audio indicator + mute toggle */}
      {tab.isAudible && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(new CustomEvent('flip-mute-tab', { detail: { tabId: tab.id } }));
          }}
          className="p-0.5 rounded hover:bg-white/10 transition-all flex-shrink-0"
          title={tab.isMuted ? 'Unmute tab' : 'Mute tab'}
        >
          {tab.isMuted ? (
            <VolumeX size={compact ? 10 : 12} className="text-red-400/70" />
          ) : (
            <Volume2 size={compact ? 10 : 12} className="text-flip-400/70" />
          )}
        </button>
      )}

      {/* Loading pulse */}
      {tab.loading && (
        <div className="w-2 h-2 rounded-full bg-flip-400 animate-pulse-subtle flex-shrink-0" />
      )}

      {/* Close button */}
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-all text-white/40 hover:text-white flex-shrink-0"
      >
        <X size={compact ? 10 : 12} />
      </button>
    </div>
  );
}

export default TabCard;
