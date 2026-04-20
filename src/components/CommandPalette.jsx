import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Search, Globe, Plus, X, Bookmark, Clock, Settings,
  Puzzle, SplitSquareHorizontal, Shield, PanelLeft,
  ArrowRight, Command, Trash2, Pin, Copy, Code2, RotateCw,
} from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../store/browserStore';

export default function CommandPalette() {
  const {
    tabs, activeTabId, bookmarks, history, extensions,
    closeCommandPalette, addTab, setActiveTab, closeTab,
    setSidebarView, toggleSidebar, toggleSplitView,
    pinTab, duplicateTab,
  } = useBrowserStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Build command list
  const commands = useMemo(() => {
    const cmds = [];

    // Quick actions
    cmds.push(
      { id: 'new-tab', type: 'action', icon: Plus, label: 'New Tab', shortcut: 'Ctrl+T', action: () => { addTab(); closeCommandPalette(); } },
      { id: 'close-tab', type: 'action', icon: X, label: 'Close Current Tab', shortcut: 'Ctrl+W', action: () => { closeTab(activeTabId); closeCommandPalette(); } },
      { id: 'reopen-tab', type: 'action', icon: RotateCw, label: 'Reopen Closed Tab', shortcut: 'Ctrl+Shift+T', action: () => { useBrowserStore.getState().reopenLastClosedTab(); closeCommandPalette(); } },
      { id: 'split-view', type: 'action', icon: SplitSquareHorizontal, label: 'Toggle Split View', shortcut: 'Ctrl+\\', action: () => { toggleSplitView(); closeCommandPalette(); } },
      { id: 'toggle-sidebar', type: 'action', icon: PanelLeft, label: 'Toggle Sidebar', shortcut: 'Ctrl+B', action: () => { toggleSidebar(); closeCommandPalette(); } },
      { id: 'pin-tab', type: 'action', icon: Pin, label: 'Pin/Unpin Current Tab', action: () => { pinTab(activeTabId); closeCommandPalette(); } },
      { id: 'duplicate-tab', type: 'action', icon: Copy, label: 'Duplicate Current Tab', action: () => { duplicateTab(activeTabId); closeCommandPalette(); } },
      { id: 'settings', type: 'action', icon: Settings, label: 'Open Settings', action: () => { setSidebarView('settings'); closeCommandPalette(); } },
      { id: 'extensions', type: 'action', icon: Puzzle, label: 'Manage Extensions', action: () => { window.dispatchEvent(new CustomEvent('flip-open-extension-manager')); closeCommandPalette(); } },
      { id: 'bookmarks', type: 'action', icon: Bookmark, label: 'View Bookmarks', action: () => { setSidebarView('bookmarks'); closeCommandPalette(); } },
      { id: 'history', type: 'action', icon: Clock, label: 'View History', action: () => { setSidebarView('history'); closeCommandPalette(); } },
      { id: 'devtools', type: 'action', icon: Code2, label: 'Developer Dashboard', action: () => { useBrowserStore.getState().updateTab(activeTabId, { url: 'flip://devtools', title: 'Developer Dashboard', loading: false }); closeCommandPalette(); } },
    );

    // Open tabs
    tabs.forEach((tab) => {
      cmds.push({
        id: `tab-${tab.id}`,
        type: 'tab',
        icon: Globe,
        label: tab.title || 'Untitled',
        subtitle: tab.url,
        favicon: tab.favicon,
        action: () => { setActiveTab(tab.id); closeCommandPalette(); },
      });
    });

    // Bookmarks
    bookmarks.slice(0, 10).forEach((bm) => {
      cmds.push({
        id: `bm-${bm.id}`,
        type: 'bookmark',
        icon: Bookmark,
        label: bm.title || bm.url,
        subtitle: bm.url,
        action: () => { addTab(bm.url); closeCommandPalette(); },
      });
    });

    // Recent history
    history.slice(0, 10).forEach((entry, i) => {
      cmds.push({
        id: `hist-${i}`,
        type: 'history',
        icon: Clock,
        label: entry.title || entry.url,
        subtitle: entry.url,
        action: () => { addTab(entry.url); closeCommandPalette(); },
      });
    });

    return cmds;
  }, [tabs, bookmarks, history, activeTabId]);

  // Filter by query
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(q) ||
        c.subtitle?.toLowerCase().includes(q)
    );
  }, [commands, query]);

  // Keyboard navigation
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      closeCommandPalette();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filtered[selectedIndex];
      if (item) item.action();
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex];
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Group items by type
  const grouped = useMemo(() => {
    const groups = {};
    filtered.forEach((item) => {
      const type = item.type;
      if (!groups[type]) groups[type] = [];
      groups[type].push(item);
    });
    return groups;
  }, [filtered]);

  const typeLabels = {
    action: 'Actions',
    tab: 'Open Tabs',
    bookmark: 'Bookmarks',
    history: 'Recent History',
  };

  let globalIndex = -1;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 command-overlay" onClick={closeCommandPalette}>
      <div
        className="w-full max-w-xl rounded-[18px] vibrancy border border-white/[0.08] shadow-mac-xl overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.06]">
          <Search size={16} className="text-white/30" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tabs, bookmarks, actions..."
            className="flex-1 bg-transparent text-[14px] text-white/90 placeholder-white/25 outline-none"
            spellCheck={false}
          />
          <kbd className="text-[10px] text-white/20 bg-white/[0.04] rounded-[6px] px-1.5 py-0.5 border border-white/[0.06]">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-white/25">
              No results found
            </div>
          ) : (
            Object.entries(grouped).map(([type, items]) => (
              <div key={type}>
                <div className="px-4 py-1.5 text-[10px] font-medium text-white/25 uppercase tracking-wider">
                  {typeLabels[type] || type}
                </div>
                {items.map((item) => {
                  globalIndex++;
                  const idx = globalIndex;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={item.action}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 mx-1.5 rounded-[10px]',
                        isSelected ? 'bg-white/[0.08] text-white' : 'text-white/55 hover:text-white/80'
                      )}
                      style={{ width: 'calc(100% - 12px)' }}
                    >
                      {item.favicon ? (
                        <img src={item.favicon} className="w-4 h-4 rounded-sm" alt="" />
                      ) : (
                        <item.icon size={14} className={isSelected ? 'text-flip-400' : 'text-white/30'} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-medium truncate">{item.label}</div>
                        {item.subtitle && (
                          <div className="text-[10px] text-white/20 truncate mt-0.5">{item.subtitle}</div>
                        )}
                      </div>
                      {isSelected && (
                        <ArrowRight size={12} className="text-flip-400" />
                      )}
                      {item.shortcut && (
                        <kbd className="text-[9px] text-white/20 bg-white/[0.04] rounded-[4px] px-1.5 py-0.5 border border-white/[0.06] ml-auto flex-shrink-0">{item.shortcut}</kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/[0.06] text-[10px] text-white/20">
          <span><kbd className="bg-white/[0.04] rounded-[4px] px-1 border border-white/[0.06]">↑↓</kbd> Navigate</span>
          <span><kbd className="bg-white/[0.04] rounded-[4px] px-1 border border-white/[0.06]">Enter</kbd> Select</span>
          <span><kbd className="bg-white/[0.04] rounded-[4px] px-1 border border-white/[0.06]">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
