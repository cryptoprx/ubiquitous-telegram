import React, { useState } from 'react';
import { X, Clock, Search } from 'lucide-react';
import useBrowserStore from '../../store/browserStore';

function HistoryView() {
  const { history, addTab } = useBrowserStore();
  const [histSearch, setHistSearch] = useState('');

  const filtered = histSearch
    ? history.filter((e) =>
        (e.title || '').toLowerCase().includes(histSearch.toLowerCase()) ||
        (e.url || '').toLowerCase().includes(histSearch.toLowerCase())
      )
    : history;

  const grouped = filtered.reduce((acc, entry) => {
    const date = new Date(entry.timestamp).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto px-1 py-2">
      <div className="sidebar-section">History</div>
      {/* Search */}
      <div className="px-2 pb-2">
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10">
          <Search size={12} className="text-white/25" />
          <input
            value={histSearch}
            onChange={(e) => setHistSearch(e.target.value)}
            placeholder="Search history..."
            className="flex-1 bg-transparent text-xs text-white/80 placeholder-white/25 outline-none"
          />
          {histSearch && (
            <button onClick={() => setHistSearch('')} className="text-white/30 hover:text-white/60">
              <X size={11} />
            </button>
          )}
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-xs text-white/30">
          {histSearch ? 'No results found.' : 'No browsing history yet.'}
        </div>
      ) : (
        Object.entries(grouped).slice(0, 10).map(([date, entries]) => (
          <div key={date}>
            <div className="px-3 py-1 text-[10px] text-white/25 font-medium">{date}</div>
            {entries.slice(0, 20).map((entry, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-1 rounded-lg mx-1 mb-0.5 cursor-pointer text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                onClick={() => addTab(entry.url)}
              >
                <Clock size={11} className="flex-shrink-0 text-white/20" />
                <span className="text-xs truncate">{entry.title || entry.url}</span>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

export default HistoryView;
