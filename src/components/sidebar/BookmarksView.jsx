import React, { useState } from 'react';
import { X, Bookmark, Search } from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';

function BookmarksView() {
  const { bookmarks, bookmarkCategories, removeBookmark, updateBookmark, addTab } = useBrowserStore();
  const [bmSearch, setBmSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [editingBm, setEditingBm] = useState(null);

  // Filter by category and search
  const filtered = bookmarks.filter(bm => {
    if (activeCategory !== 'All' && bm.category !== activeCategory) return false;
    if (bmSearch) {
      const q = bmSearch.toLowerCase();
      return (bm.title || '').toLowerCase().includes(q) || (bm.url || '').toLowerCase().includes(q) || (bm.category || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Count per category
  const catCounts = bookmarks.reduce((acc, bm) => {
    const c = bm.category || 'General';
    acc[c] = (acc[c] || 0) + 1;
    return acc;
  }, {});
  const usedCategories = Object.keys(catCounts).sort();

  return (
    <div className="flex-1 overflow-y-auto px-1 py-2">
      <div className="sidebar-section">Bookmarks</div>

      {/* Search */}
      <div className="px-2 pb-2">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
          <Search size={12} className="text-white/20 flex-shrink-0" />
          <input
            className="bg-transparent text-[11px] text-white outline-none flex-1 placeholder-white/20"
            placeholder="Search bookmarks..."
            value={bmSearch}
            onChange={(e) => setBmSearch(e.target.value)}
          />
          {bmSearch && <button onClick={() => setBmSearch('')} className="text-white/20 hover:text-white/50"><X size={10} /></button>}
        </div>
      </div>

      {/* Category filter pills */}
      {usedCategories.length > 1 && (
        <div className="px-2 pb-2 flex flex-wrap gap-1">
          <button
            onClick={() => setActiveCategory('All')}
            className={clsx('px-2 py-0.5 rounded-md text-[8px] font-medium transition-colors',
              activeCategory === 'All' ? 'bg-flip-500/15 text-flip-400' : 'bg-white/[0.04] text-white/30 hover:text-white/60'
            )}
          >All ({bookmarks.length})</button>
          {usedCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(activeCategory === cat ? 'All' : cat)}
              className={clsx('px-2 py-0.5 rounded-md text-[8px] font-medium transition-colors',
                activeCategory === cat ? 'bg-flip-500/15 text-flip-400' : 'bg-white/[0.04] text-white/30 hover:text-white/60'
              )}
            >{cat} ({catCounts[cat]})</button>
          ))}
        </div>
      )}

      {bookmarks.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
            <Bookmark size={18} className="text-white/15" />
          </div>
          <p className="text-xs text-white/30 mb-1">No bookmarks yet</p>
          <p className="text-[10px] text-white/15">Click the star in the address bar to save one</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-[10px] text-white/20 text-center py-6">No matching bookmarks</div>
      ) : (
        filtered.map((bm) => (
          <div
            key={bm.id}
            className="group flex items-center gap-2 px-3 py-1.5 rounded-lg mx-1 mb-0.5 cursor-pointer text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            onClick={() => addTab(bm.url)}
          >
            <Bookmark size={12} className="flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs truncate block">{bm.title || bm.url}</span>
              {bm.category && bm.category !== 'General' && (
                <span className="text-[7px] text-white/20 uppercase tracking-wider">{bm.category}</span>
              )}
            </div>
            {/* Category dropdown on hover */}
            <select
              value={bm.category || 'General'}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => { e.stopPropagation(); updateBookmark(bm.id, { category: e.target.value }); }}
              className="opacity-0 group-hover:opacity-100 bg-transparent text-[8px] text-white/40 outline-none cursor-pointer w-12 transition-opacity"
            >
              {bookmarkCategories.map(c => <option key={c} value={c} className="bg-[#1a1816] text-white">{c}</option>)}
            </select>
            <button
              onClick={(e) => { e.stopPropagation(); removeBookmark(bm.id); }}
              className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 transition-opacity"
            >
              <X size={10} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export default BookmarksView;
