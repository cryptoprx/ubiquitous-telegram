import React from 'react';
import { Star } from 'lucide-react';
import useBrowserStore from '../store/browserStore';

export default function BookmarksBar() {
  const { bookmarks, settings, addTab } = useBrowserStore();

  if (!settings.showBookmarksBar || bookmarks.length === 0) return null;

  return (
    <div className="flex items-center gap-0.5 px-3 py-1 bg-surface-1/80 backdrop-blur-sm border-b border-white/5 overflow-x-auto scrollbar-none">
      {bookmarks.slice(0, 20).map((bm, i) => {
        let favicon = bm.favicon;
        if (!favicon) {
          try { favicon = `https://icons.duckduckgo.com/ip3/${new URL(bm.url).hostname}.ico`; } catch {}
        }
        return (
          <button
            key={i}
            onClick={() => addTab(bm.url)}
            className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-white/50 hover:text-white/80 hover:bg-white/[0.06] hover:shadow-sm transition-all duration-150 whitespace-nowrap flex-shrink-0"
            title={bm.url}
          >
            {favicon ? (
              <img src={favicon} alt="" className="w-3.5 h-3.5 rounded-sm group-hover:scale-110 transition-transform" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling && (e.target.nextSibling.style.display = 'inline'); }} />
            ) : null}
            <Star size={10} className="text-white/20 hidden" style={{ display: favicon ? 'none' : 'inline' }} />
            <span className="text-[11px] max-w-[120px] truncate">{bm.title || (() => { try { return new URL(bm.url).hostname; } catch { return bm.url; } })()}</span>
          </button>
        );
      })}
    </div>
  );
}
