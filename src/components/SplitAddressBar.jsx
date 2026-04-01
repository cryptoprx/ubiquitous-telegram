import React, { useState, useEffect, useCallback } from 'react';
import useBrowserStore from '../store/browserStore';

// Detect private mode once at module level
const isPrivateMode = new URLSearchParams(window.location.search).get('private') === '1';

/** Mini address bar for the split view pane */
export default function SplitAddressBar() {
  const { splitTabId, tabs, closeSplitView, navigateSplitTab, settings } = useBrowserStore();
  const splitTab = tabs.find((t) => t.id === splitTabId);
  const [input, setInput] = useState(splitTab?.url === 'flip://newtab' ? '' : (splitTab?.url || ''));

  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (!input.trim()) return;
    let url = input.trim();
    if (!/^https?:\/\//i.test(url) && !url.startsWith('flip://')) {
      if (url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        url = (settings.searchEngine || 'https://duckduckgo.com/?q=') + encodeURIComponent(url);
      }
    }
    navigateSplitTab(url);
    // Dispatch navigate event for the split tab's webview
    window.dispatchEvent(new CustomEvent('flip-navigate', { detail: { tabId: splitTabId, url } }));
  }, [input, settings.searchEngine, navigateSplitTab, splitTabId]);

  // Sync input when split tab URL changes externally (e.g. link clicks inside the webview)
  const currentUrl = splitTab?.url || '';
  useEffect(() => {
    if (currentUrl && currentUrl !== 'flip://newtab') {
      setInput(currentUrl);
    }
  }, [currentUrl]);

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-surface-1 border-b border-white/5">
      <form onSubmit={handleSubmit} className="flex-1 flex">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onFocus={(e) => e.target.select()}
          placeholder="Search or enter URL..."
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-1 text-xs text-white/90 outline-none focus:border-flip-500/50 placeholder:text-white/20"
        />
      </form>
      <button
        onClick={closeSplitView}
        className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/80 transition-colors"
        title="Close split view"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}
