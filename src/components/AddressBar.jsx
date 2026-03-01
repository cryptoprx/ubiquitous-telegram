import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ArrowLeft, ArrowRight, RotateCw, Home, Star, StarOff,
  Shield, ShieldCheck, Lock, Unlock, PanelLeft, Search,
  Command, SplitSquareHorizontal, X, BookOpen, PictureInPicture2,
  Camera, Languages, MoreVertical, Puzzle, Download, Sparkles,
  Printer, FileDown, Scissors, Store, Bot, Copy, Check, Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../store/browserStore';
import { t } from '../i18n';

export default function AddressBar() {
  const {
    tabs, activeTabId, sidebarOpen, blockedCount, settings, readingMode,
    updateTab, addTab, addBookmark, removeBookmark, bookmarks,
    toggleSidebar, toggleCommandPalette, toggleSplitView, toggleReadingMode,
    extensions, setSidebarView, sidebarView,
  } = useBrowserStore();

  const toolbarExtensions = extensions.filter(
    (e) => e.enabled && e.manifest?.toolbar_action
  );

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const lang = settings.language || 'en';
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCopied, setAiCopied] = useState(false);
  const aiResponseRef = useRef('');
  const inputRef = useRef(null);
  const moreRef = useRef(null);
  const aiCardRef = useRef(null);
  const unsubTokenRef = useRef(null);
  const unsubDoneRef = useRef(null);

  // Cleanup stream listeners helper
  function cleanupStreamListeners() {
    if (unsubTokenRef.current) { unsubTokenRef.current(); unsubTokenRef.current = null; }
    if (unsubDoneRef.current) { unsubDoneRef.current(); unsubDoneRef.current = null; }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => cleanupStreamListeners();
  }, []);

  // Close overflow menu on outside click
  useEffect(() => {
    function handleClick(e) {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
    }
    if (moreOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [moreOpen]);

  const isBookmarked = bookmarks.some((b) => b.url === activeTab?.url);
  const isSecure = activeTab?.url?.startsWith('https://');
  const isInternal = activeTab?.url?.startsWith('flip://');

  useEffect(() => {
    if (!isFocused && activeTab) {
      setInputValue(activeTab.url === 'flip://newtab' ? '' : activeTab.url === 'flip://devtools' ? 'flip://devtools' : activeTab.url === 'flip://marketplace' ? 'flip://marketplace' : activeTab.url?.startsWith('flip://ext/') ? activeTab.url : activeTab.url || '');
    }
  }, [activeTab?.url, isFocused]);

  // AI query handler
  const sendAiQuery = useCallback(async (prompt) => {
    setAiOpen(true);
    setAiQuery(prompt);
    setAiResponse('');
    setAiLoading(true);
    aiResponseRef.current = '';

    // Remove any previous stream listeners before registering new ones
    cleanupStreamListeners();

    // Build context — include page title if available
    const pageTitle = activeTab?.title || '';
    const pageUrl = activeTab?.url || '';
    const contextNote = (pageTitle && !pageUrl.startsWith('flip://')) 
      ? `\n[User is currently viewing: "${pageTitle}" at ${pageUrl}]` 
      : '';

    try {
      // Set up streaming listeners before sending
      const tokenHandler = (token) => {
        aiResponseRef.current += token;
        setAiResponse(aiResponseRef.current);
      };
      const doneHandler = () => {
        setAiLoading(false);
        cleanupStreamListeners();
      };
      unsubTokenRef.current = window.flipAPI?.onAiStreamToken(tokenHandler);
      unsubDoneRef.current = window.flipAPI?.onAiStreamDone(doneHandler);

      const result = await window.flipAPI?.aiChat({
        messages: [
          { role: 'system', content: 'You are Flip AI, a helpful assistant embedded in the Flip Browser address bar. Be concise, clear, and helpful. Format with markdown when useful.' + contextNote },
          { role: 'user', content: prompt },
        ],
        stream: true,
      });

      // If non-streaming response came back directly
      if (result && typeof result === 'string') {
        setAiResponse(result);
        setAiLoading(false);
        cleanupStreamListeners();
      } else if (result?.content) {
        setAiResponse(result.content);
        setAiLoading(false);
        cleanupStreamListeners();
      }
    } catch (e) {
      setAiResponse('AI is not configured. Go to Settings → AI to set up your model.');
      setAiLoading(false);
      cleanupStreamListeners();
    }
  }, [activeTab?.title, activeTab?.url]);

  // Close AI card on outside click
  useEffect(() => {
    if (!aiOpen) return;
    function handleClick(e) {
      if (aiCardRef.current && !aiCardRef.current.contains(e.target) && !inputRef.current?.contains(e.target)) {
        setAiOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [aiOpen]);

  // Ctrl+Shift+A shortcut to open AI prompt
  useEffect(() => {
    function handleKey(e) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        inputRef.current?.focus();
        setInputValue('@ai ');
        setIsFocused(true);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  function handleNavigate(e) {
    e.preventDefault();
    if (!inputValue.trim()) return;

    let url = inputValue.trim();

    const aiMatch = url.match(/^(?:@ai\s+|\?\s*)(.*)/i);
    if (aiMatch && aiMatch[1]) {
      sendAiQuery(aiMatch[1]);
      inputRef.current?.blur();
      setIsFocused(false);
      return;
    }

    // Close AI card on normal navigation
    if (aiOpen) setAiOpen(false);

    // Determine if input is a URL or search query
    if (!/^https?:\/\//i.test(url) && !/^[a-z]+:\/\//i.test(url)) {
      if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(url) || url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        url = settings.searchEngine + encodeURIComponent(url);
      }
    }

    // Handle internal flip:// URLs without dispatching to webview
    if (url === 'flip://newtab' || url === 'flip://devtools' || url === 'flip://marketplace' || url === 'flip://studio' || url.startsWith('flip://ext/')) {
      const titles = { 'flip://devtools': 'Developer Dashboard', 'flip://marketplace': 'Extension Marketplace', 'flip://studio': 'Extension Studio', 'flip://newtab': 'New Tab' };
      const title = titles[url] || (url.startsWith('flip://ext/') ? url.replace('flip://ext/', '') : 'New Tab');
      updateTab(activeTabId, { url, title, loading: false });
      inputRef.current?.blur();
      setIsFocused(false);
      return;
    }

    updateTab(activeTabId, { url, loading: true });
    inputRef.current?.blur();
    setIsFocused(false);

    // Dispatch custom event for WebContent to pick up
    window.dispatchEvent(new CustomEvent('flip-navigate', { detail: { tabId: activeTabId, url } }));
  }

  function goBack() {
    window.dispatchEvent(new CustomEvent('flip-go-back', { detail: { tabId: activeTabId } }));
  }

  function goForward() {
    window.dispatchEvent(new CustomEvent('flip-go-forward', { detail: { tabId: activeTabId } }));
  }

  function reload() {
    window.dispatchEvent(new CustomEvent('flip-reload', { detail: { tabId: activeTabId } }));
  }

  function goHome() {
    updateTab(activeTabId, { url: 'flip://newtab', title: 'New Tab', loading: false });
    window.dispatchEvent(new CustomEvent('flip-navigate', { detail: { tabId: activeTabId, url: 'flip://newtab' } }));
  }

  function toggleBookmark() {
    if (isBookmarked) {
      const bm = bookmarks.find((b) => b.url === activeTab.url);
      if (bm) removeBookmark(bm.id);
    } else {
      addBookmark({ url: activeTab.url, title: activeTab.title });
    }
  }

  return (
    <div className="relative flex items-center gap-2 px-3 py-2 bg-surface-1/80 backdrop-blur-md border-b border-white/5 z-30">
      {/* Sidebar toggle (when collapsed) */}
      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className="btn-ghost p-1.5"
          title="Open sidebar"
        >
          <PanelLeft size={15} />
        </button>
      )}

      {/* Navigation buttons */}
      <div className="flex items-center gap-0.5">
        <NavButton
          onClick={goBack}
          disabled={!activeTab?.canGoBack}
          title={t('back', lang)}
        >
          <ArrowLeft size={15} />
        </NavButton>
        <NavButton
          onClick={goForward}
          disabled={!activeTab?.canGoForward}
          title={t('forward', lang)}
        >
          <ArrowRight size={15} />
        </NavButton>
        <NavButton onClick={reload} title={t('reload', lang)}>
          <RotateCw size={14} />
        </NavButton>
        <NavButton onClick={goHome} title={t('home', lang)}>
          <Home size={14} />
        </NavButton>
      </div>

      {/* Address input */}
      <form onSubmit={handleNavigate} className="flex-1 mx-1">
        <div
          className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-200',
            isFocused
              ? 'bg-white/10 border border-flip-500/30 ring-1 ring-flip-500/15 shadow-lg shadow-flip-500/5'
              : 'bg-white/5 border border-white/5 hover:border-white/10'
          )}
        >
          {/* Security indicator */}
          {!isFocused && !isInternal && (
            <div className="flex-shrink-0" title={isSecure ? t('secureConnection', lang) : t('insecureConnection', lang)}>
              {isSecure ? (
                <Lock size={12} className="text-accent-400/70" />
              ) : (
                <Unlock size={12} className="text-red-400/70" />
              )}
            </div>
          )}
          {isFocused && (
            <Search size={13} className="text-white/30 flex-shrink-0" />
          )}

          <input
            id="flip-address-input"
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => {
              setIsFocused(true);
              setTimeout(() => inputRef.current?.select(), 0);
            }}
            onBlur={() => setIsFocused(false)}
            placeholder={t('searchOrUrl', lang)}
            className="flex-1 bg-transparent text-xs text-white placeholder-white/30 outline-none"
            spellCheck={false}
          />

          {/* Loading indicator */}
          {activeTab?.loading && (
            <div className="w-3 h-3 rounded-full border-2 border-flip-400 border-t-transparent animate-spin flex-shrink-0" />
          )}
        </div>

        {/* Loading progress bar */}
        {activeTab?.loading && (
          <div className="absolute left-0 right-0 bottom-0 h-0.5 overflow-hidden">
            <div className="loading-bar" />
          </div>
        )}
      </form>

      {/* AI Inline Response Card */}
      {aiOpen && (
        <div ref={aiCardRef} className="absolute left-16 right-16 top-full mt-1 z-[100] animate-fade-in">
          <div className="rounded-2xl bg-surface-2/98 backdrop-blur-2xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden max-h-[60vh] flex flex-col">
            {/* Card header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 shrink-0">
              <div className="w-6 h-6 rounded-lg bg-flip-500/15 flex items-center justify-center">
                <Bot size={13} className="text-flip-400" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-white/40 font-medium">Flip AI</span>
                <p className="text-xs text-white/70 truncate">{aiQuery}</p>
              </div>
              <div className="flex items-center gap-1">
                {aiResponse && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(aiResponse);
                      setAiCopied(true);
                      setTimeout(() => setAiCopied(false), 1500);
                    }}
                    className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                    title="Copy response"
                  >
                    {aiCopied ? <Check size={12} className="text-accent-400" /> : <Copy size={12} />}
                  </button>
                )}
                <button
                  onClick={() => setAiOpen(false)}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                >
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Response body */}
            <div className="overflow-y-auto px-4 py-3 text-xs text-white/80 leading-relaxed whitespace-pre-wrap ai-response-body">
              {aiLoading && !aiResponse ? (
                <div className="flex items-center gap-2 py-4 text-white/30">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-[10px]">Thinking...</span>
                </div>
              ) : (
                <>{aiResponse}{aiLoading && <span className="inline-block w-1.5 h-3.5 bg-flip-400/60 animate-pulse ml-0.5 rounded-sm" />}</>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 shrink-0">
              <span className="text-[8px] text-white/15">Ctrl+Shift+A to ask AI · @ai or ? prefix</span>
              <button
                onClick={() => {
                  setAiOpen(false);
                  setSidebarView('extensions');
                  window.dispatchEvent(new CustomEvent('flip-open-extension', { detail: { extensionId: 'ai-chat' } }));
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('flip-ai-prompt', { detail: { prompt: aiQuery } }));
                  }, 300);
                }}
                className="text-[9px] text-flip-400/60 hover:text-flip-400 transition-colors"
              >
                Open in AI Chat →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-0.5">
        {/* Bookmark */}
        <NavButton
          onClick={toggleBookmark}
          title={isBookmarked ? t('removeBookmark', lang) : t('addBookmark', lang)}
          disabled={isInternal}
        >
          {isBookmarked ? (
            <Star size={14} className="fill-flip-400 text-flip-400" />
          ) : (
            <Star size={14} />
          )}
        </NavButton>

        {/* Ad blocker indicator + per-site toggle */}
        <ShieldButton
          blockedCount={blockedCount}
          activeTab={activeTab}
          isInternal={isInternal}
          lang={lang}
        />

        {/* PWA install indicator */}
        {activeTab?.pwa && (
          <NavButton
            onClick={() => {
              const pwa = activeTab.pwa;
              const url = pwa.start_url || activeTab.url;
              useBrowserStore.getState().addTab(url);
              const newTab = useBrowserStore.getState().tabs[useBrowserStore.getState().tabs.length - 1];
              if (newTab) useBrowserStore.getState().updateTab(newTab.id, { pinned: true, title: pwa.name || 'App' });
            }}
            title={`Install ${activeTab.pwa.name || 'App'} as pinned tab`}
          >
            <Download size={14} className="text-accent-400/70" />
          </NavButton>
        )}

        {/* AI Summarize */}
        <NavButton
          onClick={() => {
            const pageTitle = activeTab?.title || 'this page';
            const pageUrl = activeTab?.url || '';
            // Extract page content first, then summarize with context
            const onContent = (e) => {
              window.removeEventListener('flip-page-content-result', onContent);
              const text = (e.detail?.content || '').slice(0, 6000);
              const prompt = text
                ? `Summarize this page. Title: "${pageTitle}"\nURL: ${pageUrl}\n\nPage content:\n${text}\n\nGive a concise summary with key points.`
                : `Summarize the page titled "${pageTitle}" at ${pageUrl}. Give a concise, well-structured summary with the key points.`;
              window.dispatchEvent(new CustomEvent('flip-ai-overlay', {
                detail: { prompt, mode: 'summarize', x: Math.round(window.innerWidth / 2 - 200), y: 80 },
              }));
            };
            window.addEventListener('flip-page-content-result', onContent);
            window.dispatchEvent(new CustomEvent('flip-extract-page-content', { detail: { tabId: activeTab?.id } }));
            // Fallback if extraction doesn't respond in 2s
            setTimeout(() => {
              window.removeEventListener('flip-page-content-result', onContent);
            }, 3000);
          }}
          title="AI Summarize — let Flip AI summarize this page"
          disabled={isInternal}
        >
          <Sparkles size={14} />
        </NavButton>

        {/* Reading mode */}
        <NavButton
          onClick={toggleReadingMode}
          title={t('readingMode', lang) + ' — clean, distraction-free reading'}
          disabled={isInternal}
        >
          <BookOpen size={14} className={readingMode ? 'text-flip-400' : ''} />
        </NavButton>

        {/* More tools overflow */}
        <div className="relative" ref={moreRef}>
          <NavButton onClick={() => setMoreOpen(!moreOpen)} title="More tools">
            <MoreVertical size={14} className={moreOpen ? 'text-flip-400' : ''} />
          </NavButton>
          {moreOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 py-1 rounded-xl bg-surface-3 border border-white/10 shadow-2xl shadow-black/50 z-50 animate-fade-in">
              <OverflowItem
                icon={PictureInPicture2}
                label="Picture-in-Picture"
                disabled={isInternal}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('flip-pip', { detail: { tabId: activeTabId } }));
                  setMoreOpen(false);
                }}
              />
              <OverflowItem
                icon={Camera}
                label="Screenshot"
                disabled={isInternal}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('flip-screenshot', { detail: { tabId: activeTabId } }));
                  setMoreOpen(false);
                }}
              />
              <OverflowItem
                icon={Scissors}
                label="Snip Page"
                disabled={isInternal}
                onClick={() => {
                  setMoreOpen(false);
                  setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('flip-snip', { detail: { tabId: activeTabId } }));
                  }, 50);
                }}
              />
              <OverflowItem
                icon={Languages}
                label="Translate Page"
                disabled={isInternal}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('flip-translate', { detail: { tabId: activeTabId, targetLang: 'en' } }));
                  setMoreOpen(false);
                }}
              />
              <div className="my-1 mx-2 h-px bg-white/[0.06]" />
              <OverflowItem
                icon={Printer}
                label="Print Page"
                disabled={isInternal}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('flip-print', { detail: { tabId: activeTabId } }));
                  setMoreOpen(false);
                }}
              />
              <OverflowItem
                icon={FileDown}
                label="Save as PDF"
                disabled={isInternal}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('flip-print-pdf', { detail: { tabId: activeTabId } }));
                  setMoreOpen(false);
                }}
              />
              <div className="my-1 mx-2 h-px bg-white/[0.06]" />
              <OverflowItem
                icon={Store}
                label="Extension Marketplace"
                onClick={() => {
                  useBrowserStore.getState().addTab('flip://marketplace');
                  setMoreOpen(false);
                }}
              />
              {toolbarExtensions.length > 0 && (
                <>
                  <div className="my-1 mx-2 h-px bg-white/[0.06]" />
                  {toolbarExtensions.map((ext) => (
                    <OverflowItem
                      key={ext.id}
                      icon={Puzzle}
                      label={ext.manifest.toolbar_action.label || ext.manifest.name}
                      onClick={() => {
                        if (sidebarView !== 'extensions') setSidebarView('extensions');
                        window.dispatchEvent(new CustomEvent('flip-open-extension', { detail: { extensionId: ext.id } }));
                        setMoreOpen(false);
                      }}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Split view */}
        <NavButton
          onClick={() => toggleSplitView()}
          title={t('splitView', lang) + ' — browse two pages side by side'}
        >
          <SplitSquareHorizontal size={14} />
        </NavButton>

        {/* Command palette */}
        <NavButton
          onClick={toggleCommandPalette}
          title={`${t('commandPalette', lang)} (Ctrl+K) — search commands, tabs, and actions`}
        >
          <Command size={14} />
        </NavButton>
      </div>
    </div>
  );
}

function NavButton({ children, onClick, disabled, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-100',
        disabled
          ? 'text-white/15 cursor-default'
          : 'text-white/50 hover:text-white hover:bg-white/10 cursor-pointer'
      )}
    >
      {children}
    </button>
  );
}

function ShieldButton({ blockedCount, activeTab, isInternal, lang }) {
  const [open, setOpen] = useState(false);
  const [whitelisted, setWhitelisted] = useState(false);
  const [stats, setStats] = useState(null);
  const [updating, setUpdating] = useState(false);
  const ref = useRef(null);

  const hostname = activeTab?.url ? (() => { try { return new URL(activeTab.url).hostname; } catch { return ''; } })() : '';

  useEffect(() => {
    if (!open || !hostname) return;
    window.flipAPI?.adblockIsWhitelisted?.(hostname).then(setWhitelisted);
    window.flipAPI?.adblockStats?.().then(setStats);
  }, [open, hostname]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  async function toggleSite() {
    if (!hostname) return;
    const nowBlocking = await window.flipAPI?.adblockToggleSite?.(hostname);
    setWhitelisted(!nowBlocking);
  }

  async function forceUpdate() {
    setUpdating(true);
    const s = await window.flipAPI?.adblockForceUpdate?.();
    if (s) setStats(s);
    setUpdating(false);
  }

  return (
    <div className="relative" ref={ref}>
      <NavButton onClick={() => setOpen(!open)} title={`${blockedCount} ${t('trackersBlocked', lang)}`}>
        <div className="relative">
          <ShieldCheck size={14} className={whitelisted ? 'text-white/30' : 'text-accent-400/70'} />
          {blockedCount > 0 && (
            <span className="absolute -top-1 -right-1.5 text-[8px] font-bold text-accent-400 bg-surface-1 rounded-full px-0.5">
              {blockedCount > 99 ? '99+' : blockedCount}
            </span>
          )}
        </div>
      </NavButton>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 rounded-xl bg-surface-3 border border-white/10 shadow-2xl shadow-black/50 z-50 animate-fade-in overflow-hidden">
          <div className="px-3 py-2.5 border-b border-white/5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-white/80 font-semibold">Ad & Tracker Blocker</span>
              <span className="text-[9px] text-accent-400 font-mono">{blockedCount} blocked</span>
            </div>
            {hostname && !isInternal && (
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-white/50 truncate max-w-36">{hostname}</span>
                <button
                  onClick={toggleSite}
                  className={clsx(
                    'px-2 py-0.5 rounded-md text-[9px] font-medium transition-colors',
                    whitelisted ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25' : 'bg-accent-400/15 text-accent-400 hover:bg-accent-400/25'
                  )}
                >
                  {whitelisted ? 'Disabled' : 'Protected'}
                </button>
              </div>
            )}
          </div>
          {stats && (
            <div className="px-3 py-2 space-y-1 border-b border-white/5">
              <div className="flex justify-between text-[9px]">
                <span className="text-white/30">Filter rules</span>
                <span className="text-white/50 font-mono">{stats.totalFilters?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-white/30">Domain rules</span>
                <span className="text-white/50 font-mono">{stats.blockedDomains?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-white/30">Cosmetic rules</span>
                <span className="text-white/50 font-mono">{stats.cosmeticRules?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-[9px]">
                <span className="text-white/30">Lists</span>
                <span className="text-white/50">{stats.listsLoaded?.join(', ') || 'Loading...'}</span>
              </div>
              {stats.lastUpdate && (
                <div className="flex justify-between text-[9px]">
                  <span className="text-white/30">Updated</span>
                  <span className="text-white/50">{new Date(stats.lastUpdate).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}
          <div className="px-3 py-2">
            <button
              onClick={forceUpdate}
              disabled={updating}
              className="w-full py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[10px] text-white/50 font-medium hover:bg-white/[0.08] transition-colors disabled:opacity-40"
            >
              {updating ? 'Updating filters...' : 'Update Filter Lists'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OverflowItem({ icon: Icon, label, onClick, disabled }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      className={clsx(
        'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors duration-100',
        disabled
          ? 'text-white/15 cursor-default'
          : 'text-white/60 hover:text-white hover:bg-white/[0.06] cursor-pointer'
      )}
    >
      <Icon size={13} />
      <span className="text-[11px]">{label}</span>
    </button>
  );
}
