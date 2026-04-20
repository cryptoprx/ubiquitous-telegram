import React, { useState } from 'react';
import { X, Clock, Search, Trash2 } from 'lucide-react';
import useBrowserStore from '../../store/browserStore';

function HistoryView() {
  const { history, addTab, clearHistory, removeHistoryItem } = useBrowserStore();
  const [histSearch, setHistSearch] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const filtered = histSearch
    ? history.filter((e) =>
        (e.title || '').toLowerCase().includes(histSearch.toLowerCase()) ||
        (e.url || '').toLowerCase().includes(histSearch.toLowerCase())
      )
    : history;

  const today = new Date().toLocaleDateString();
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();

  const grouped = filtered.reduce((acc, entry, idx) => {
    const rawDate = new Date(entry.timestamp).toLocaleDateString();
    let date = rawDate;
    if (rawDate === today) date = 'Today';
    else if (rawDate === yesterday) date = 'Yesterday';
    
    if (!acc[date]) acc[date] = [];
    acc[date].push({ ...entry, _idx: history.indexOf(entry) });
    return acc;
  }, {});

  return (
    <div className="flex-1 overflow-y-auto px-1 py-2">
      <div className="flex items-center justify-between px-3 mb-1">
        <div className="sidebar-section !mb-0 !pb-0">History</div>
        {history.length > 0 && (
          confirmClear ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => { clearHistory(); setConfirmClear(false); }}
                className="text-[9px] text-red-400 hover:text-red-300 font-medium px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmClear(false)}
                className="text-[9px] text-white/30 hover:text-white/50 px-1.5 py-0.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmClear(true)}
              className="flex items-center gap-1 text-[9px] text-white/20 hover:text-red-400 transition-colors"
              title="Clear all history"
            >
              <Trash2 size={10} />
              <span>Clear</span>
            </button>
          )
        )}
      </div>
      {/* Search */}
      <div className="px-2 pb-2 pt-2">
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
        <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-3">
            <Clock size={18} className="text-white/15" />
          </div>
          <p className="text-xs text-white/30 mb-1">
            {histSearch ? 'No results found' : 'No browsing history yet'}
          </p>
          {!histSearch && (
            <p className="text-[10px] text-white/15">Pages you visit will appear here</p>
          )}
        </div>
      ) : (
        Object.entries(grouped).slice(0, 10).map(([date, entries]) => (
          <div key={date}>
            <div className="px-3 py-1 text-[10px] text-white/25 font-medium">{date}</div>
            {entries.slice(0, 20).map((entry, i) => (
              <div
                key={i}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-lg mx-1 mb-0.5 cursor-pointer text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                onClick={() => addTab(entry.url)}
              >
                <Clock size={11} className="flex-shrink-0 text-white/20" />
                <div className="flex-1 min-w-0">
                  <span className="text-xs truncate block">{entry.title || entry.url}</span>
                </div>
                <span className="text-[9px] text-white/15 flex-shrink-0">
                  {(() => { try { return new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })()}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeHistoryItem(entry._idx); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-white/10 text-white/20 hover:text-white/50 transition-all flex-shrink-0"
                  title="Remove from history"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

export default HistoryView;
