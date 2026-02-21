import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, ArrowRight, RotateCw, Home, Star, StarOff,
  Shield, ShieldCheck, Lock, Unlock, PanelLeft, Search,
  Command, SplitSquareHorizontal, X, BookOpen, PictureInPicture2,
  Camera, Languages, MoreVertical, Puzzle, Download, Sparkles,
  Printer, FileDown, Scissors, Store,
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
  const inputRef = useRef(null);
  const moreRef = useRef(null);

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

  function handleNavigate(e) {
    e.preventDefault();
    if (!inputValue.trim()) return;

    let url = inputValue.trim();

    // Determine if input is a URL or search query
    if (!/^https?:\/\//i.test(url) && !/^[a-z]+:\/\//i.test(url)) {
      if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(url) || url.includes('.') && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        url = settings.searchEngine + encodeURIComponent(url);
      }
    }

    // Handle internal flip:// URLs without dispatching to webview
    if (url === 'flip://newtab' || url === 'flip://devtools' || url === 'flip://marketplace' || url.startsWith('flip://ext/')) {
      const titles = { 'flip://devtools': 'Developer Dashboard', 'flip://marketplace': 'Extension Marketplace', 'flip://newtab': 'New Tab' };
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

        {/* Ad blocker indicator */}
        <NavButton title={`${blockedCount} ${t('trackersBlocked', lang)}`}>
          <div className="relative">
            <ShieldCheck size={14} className="text-accent-400/70" />
            {blockedCount > 0 && (
              <span className="absolute -top-1 -right-1.5 text-[8px] font-bold text-accent-400 bg-surface-1 rounded-full px-0.5">
                {blockedCount > 99 ? '99+' : blockedCount}
              </span>
            )}
          </div>
        </NavButton>

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
            if (sidebarView !== 'extensions') setSidebarView('extensions');
            window.dispatchEvent(new CustomEvent('flip-open-extension', { detail: { extensionId: 'ai-chat' } }));
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('flip-ai-prompt', { detail: { prompt: 'Summarize the current page I am viewing. Read it first and give me a concise summary.' } }));
            }, 300);
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
