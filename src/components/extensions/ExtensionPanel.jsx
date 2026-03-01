import React, { useState, useEffect } from 'react';
import {
  Puzzle, Grid3X3, ChevronDown, ExternalLink, X, CloudSun, StickyNote, MessageCircle, MessageSquare, Hammer, Music, Braces, Palette, FileSearch, Bot, Store,
  KeyRound, ShieldCheck, Newspaper, Wallet, Calendar, QrCode, Calculator, Ruler, Clock, Wifi,
  Phone, Image as ImageIcon, Pencil, ArrowLeftRight, Smile, Camera, Gauge, Video,
  EyeOff, ShieldAlert, Film, Share2, Trash2, Shield,
} from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';
import ExtensionManager from './ExtensionManager';
import ExtensionHost from './ExtensionHost';

const EXT_ICONS = {
  'ai-chat': { type: 'lucide', icon: Bot, color: 'text-orange-400' },
  'music-player': { type: 'lucide', icon: Music, color: 'text-pink-400' },
  'sample-notes': { type: 'lucide', icon: StickyNote, color: 'text-amber-400' },
  'sample-weather': { type: 'lucide', icon: CloudSun, color: 'text-sky-400' },
  'json-formatter': { type: 'lucide', icon: Braces, color: 'text-emerald-400' },
  'color-picker': { type: 'lucide', icon: Palette, color: 'text-violet-400' },
  'regex-tester': { type: 'lucide', icon: FileSearch, color: 'text-cyan-400' },
  'flipprx-miner': { type: 'lucide', icon: Hammer, color: 'text-orange-400' },
  'mimo-messenger': { type: 'lucide', icon: MessageSquare, color: 'text-violet-400' },
  'community-chat': { type: 'lucide', icon: MessageCircle, color: 'text-teal-400' },
  'password-vault': { type: 'lucide', icon: KeyRound, color: 'text-amber-400' },
  'totp-auth': { type: 'lucide', icon: ShieldCheck, color: 'text-emerald-400' },
  'crypto-news': { type: 'lucide', icon: Newspaper, color: 'text-sky-400' },
  'xrpl-wallet': { type: 'lucide', icon: Wallet, color: 'text-cyan-400' },
  'calendar-widget': { type: 'lucide', icon: Calendar, color: 'text-blue-400' },
  'qr-generator': { type: 'lucide', icon: QrCode, color: 'text-white/60' },
  'calculator': { type: 'lucide', icon: Calculator, color: 'text-teal-400' },
  'unit-converter': { type: 'lucide', icon: Ruler, color: 'text-indigo-400' },
  'world-clock': { type: 'lucide', icon: Clock, color: 'text-sky-400' },
  'ip-lookup': { type: 'lucide', icon: Wifi, color: 'text-green-400' },
  'flip-call': { type: 'lucide', icon: Phone, color: 'text-emerald-400' },
  'image-editor': { type: 'lucide', icon: ImageIcon, color: 'text-pink-400' },
  'drawing-canvas': { type: 'lucide', icon: Pencil, color: 'text-violet-400' },
  'file-converter': { type: 'lucide', icon: ArrowLeftRight, color: 'text-blue-400' },
  'meme-generator': { type: 'lucide', icon: Smile, color: 'text-yellow-400' },
  'screenshot-annotator': { type: 'lucide', icon: Camera, color: 'text-rose-400' },
  'speed-test': { type: 'lucide', icon: Gauge, color: 'text-green-400' },
  'video-downloader': { type: 'lucide', icon: Video, color: 'text-red-400' },
  'privacy-dashboard': { type: 'lucide', icon: EyeOff, color: 'text-purple-400' },
  'link-checker': { type: 'lucide', icon: ShieldAlert, color: 'text-amber-400' },
  'flip-share': { type: 'lucide', icon: Share2, color: 'text-cyan-400' },
  'gif-maker': { type: 'lucide', icon: Film, color: 'text-pink-400' },
  'file-cleaner': { type: 'lucide', icon: Trash2, color: 'text-red-400' },
  'security-dashboard': { type: 'lucide', icon: Shield, color: 'text-indigo-400' },
};

export default function ExtensionPanel() {
  const { extensions, setExtensions } = useBrowserStore();
  const [activeExtId, setActiveExtId] = useState(null);

  // Lazy-load extensions when panel opens, clear when it closes
  useEffect(() => {
    async function loadExts() {
      if (window.flipAPI && extensions.length === 0) {
        const exts = await window.flipAPI.loadExtensions();
        if (exts) setExtensions(exts);
      }
    }
    loadExts();
    return () => {
      // Free memory: clear extensions from store when panel unmounts
      setExtensions([]);
    };
  }, []);

  // Listen for toolbar action clicks from AddressBar
  useEffect(() => {
    function handleOpenExt(e) {
      const id = e.detail?.extensionId;
      if (id) setActiveExtId(id);
    }
    window.addEventListener('flip-open-extension', handleOpenExt);
    return () => window.removeEventListener('flip-open-extension', handleOpenExt);
  }, []);

  const enabledSidebarExts = extensions.filter(
    (e) => e.enabled && (e.manifest.type === 'sidebar' || !e.manifest.type)
  );

  const activeExt = enabledSidebarExts.find((e) => e.id === activeExtId);
  const isWebview = activeExt?.manifest.content_type === 'webview';
  const panelWidth = isWebview ? 390 : 360;

  return (
    <div
      className="flex flex-col h-full bg-surface-1/95 backdrop-blur-xl border-l border-white/5 animate-slide-right"
      style={{ width: panelWidth, minWidth: panelWidth, maxWidth: 420 }}
    >
      {/* Extension dock bar */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-white/[0.04]">
        {/* Manager button */}
        <button
          onClick={() => setActiveExtId(null)}
          className={clsx(
            'flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200',
            !activeExtId
              ? 'bg-flip-500/15 text-flip-400 ring-1 ring-flip-500/20'
              : 'text-white/30 hover:text-white/50 hover:bg-white/5'
          )}
          title="Extension Manager"
        >
          <Grid3X3 size={14} />
        </button>

        <div className="w-px h-5 bg-white/5 mx-1" />

        {/* Extension icon buttons */}
        {enabledSidebarExts.map((ext) => {
          const extIcon = EXT_ICONS[ext.id];
          const isActive = activeExtId === ext.id;

          return (
            <button
              key={ext.id}
              onClick={() => setActiveExtId(ext.id)}
              className={clsx(
                'relative flex items-center justify-center w-8 h-8 rounded-xl transition-all duration-200 group',
                isActive
                  ? 'bg-flip-500/15 ring-1 ring-flip-500/20 scale-105'
                  : 'hover:bg-white/5 hover:scale-105'
              )}
              title={ext.manifest.name || ext.id}
            >
              {extIcon?.type === 'image'
                ? <img src={extIcon.src} alt="" className="w-4 h-4 object-contain" />
                : extIcon?.type === 'lucide'
                  ? React.createElement(extIcon.icon, { size: 14, className: isActive ? extIcon.color : 'text-white/40' })
                  : <span className="text-sm text-white/40">{ext.manifest.name?.[0] || '?'}</span>}
              {isActive && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-flip-500" />
              )}
            </button>
          );
        })}

        <div className="flex-1" />

        {/* Active extension name */}
        {activeExt && (
          <span className="text-[10px] text-white/25 truncate max-w-24 mr-1">
            {activeExt.manifest.name}
          </span>
        )}

        {/* Marketplace link */}
        <button
          onClick={() => useBrowserStore.getState().addTab('flip://marketplace')}
          className="flex items-center justify-center w-8 h-8 rounded-xl text-white/20 hover:text-flip-400 hover:bg-flip-500/10 transition-all duration-200"
          title="Get Extensions"
        >
          <Store size={14} />
        </button>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-hidden">
        {activeExt ? (
          <ExtensionHost
            extension={activeExt}
            width="100%"
            height="100%"
          />
        ) : (
          <ExtensionManager />
        )}
      </div>
    </div>
  );
}
