import React, { useState, useRef, useEffect, useMemo, memo } from 'react';
import {
  Search, Clock, Bookmark, Globe, Shield, Zap,
  ArrowRight, Sparkles, X, Newspaper, ExternalLink, RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../store/browserStore';
import { t } from '../i18n';
import FlipLogo from './FlipLogo';
import flipLogoUrl from '../assets/fliplogo.png';
import { getDailyQuote } from '../data/quotes';



const QUICK_LINKS = [
  { name: 'Flip', url: 'https://flip.croak.work', icon: flipLogoUrl },
  { name: 'CROAKWORKS', url: 'https://croak.work', icon: 'https://icons.duckduckgo.com/ip3/croak.work.ico' },
  { name: 'GitHub', url: 'https://www.github.com', icon: 'https://github.githubassets.com/favicons/favicon-dark.svg' },
  { name: 'Medium', url: 'https://medium.com', icon: 'https://miro.medium.com/v2/1*m-R_BkNf1Qjr1YbyOIJY2w.png' },
  { name: 'X', url: 'https://www.x.com', icon: 'https://abs.twimg.com/favicons/twitter.3.ico' },
];

function getGreeting(h, lang) {
  if (h < 5) return t('goodEvening', lang);
  if (h < 12) return t('goodMorning', lang);
  if (h < 17) return t('goodAfternoon', lang);
  if (h < 21) return t('goodEvening', lang);
  return t('goodEvening', lang);
}

// Animated floating orb (CSS-only, no JS animation loop)
function Orb({ color, size, x, y, delay, duration }) {
  return (
    <div
      className="absolute rounded-full pointer-events-none"
      style={{
        width: size, height: size,
        left: `${x}%`, top: `${y}%`,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
        animation: `orbFloat ${duration}s ease-in-out ${delay}s infinite alternate`,
        opacity: 0.5,
        filter: 'blur(60px)',
      }}
    />
  );
}

export default function NewTabPage({ isSplit = false }) {
  const { addTab, updateTab, activeTabId, splitTabId, navigateSplitTab, bookmarks, history, blockedCount, settings } = useBrowserStore();
  const targetTabId = isSplit ? splitTabId : activeTabId;
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mounted, setMounted] = useState(false);
  const [whatsNew, setWhatsNew] = useState(null);
  const [newsItems, setNewsItems] = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  // Quote computed once at module load — no state needed
  const dailyQuote = useMemo(() => getDailyQuote(), []);
  const [showCelebration, setShowCelebration] = useState(false);

  function fetchNews() {
    if (!window.flipAPI?.extFetchUrl) return;
    setNewsLoading(true);
    window.flipAPI.extFetchUrl('https://feeds.bbci.co.uk/news/world/rss.xml', { timeout: 10000 })
      .then(res => {
        if (!res?.body) return;
        const parser = new DOMParser();
        const xml = parser.parseFromString(res.body, 'text/xml');
        const items = xml.querySelectorAll('item');
        const parsed = [];
        const seen = new Set();
        items.forEach((item) => {
          if (parsed.length >= 8) return;
          const title = item.querySelector('title')?.textContent || '';
          if (seen.has(title)) return;
          seen.add(title);
          const link = item.querySelector('link')?.textContent || '';
          const pubDate = item.querySelector('pubDate')?.textContent || '';
          const desc = item.querySelector('description')?.textContent || '';
          const mediaThumbnail = item.getElementsByTagName('media:thumbnail')[0];
          const mediaContent = item.getElementsByTagName('media:content')[0];
          const thumb = mediaThumbnail?.getAttribute('url') || mediaContent?.getAttribute('url') || '';
          parsed.push({ title, link, pubDate, desc, thumb });
        });
        setNewsItems(parsed);
      })
      .catch(() => {})
      .finally(() => setNewsLoading(false));
  }

  useEffect(() => {
    inputRef.current?.focus();
    // Update clock only when the displayed HH:MM value changes (once per minute)
    // Align to the next minute boundary to avoid cumulative drift
    let timer;
    function tick() {
      setCurrentTime(new Date());
      const next = new Date();
      const msToNextMinute = 60000 - (next.getSeconds() * 1000 + next.getMilliseconds());
      timer = setTimeout(tick, msToNextMinute);
    }
    const now = new Date();
    const msToNextMinute = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
    timer = setTimeout(tick, msToNextMinute);
    requestAnimationFrame(() => setMounted(true));

    // Check for "What's new" after update
    window.flipAPI?.getWhatsNew?.().then((data) => {
      if (data && data.notes && data.notes.length) {
        setWhatsNew(data);
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 8000);
      }
    });

    // Fetch world news
    fetchNews();

    return () => clearTimeout(timer);
  }, []);

  function handleSearch(e) {
    e.preventDefault();
    if (!searchValue.trim()) return;
    let url = searchValue.trim();
    if (!/^https?:\/\//i.test(url)) {
      if (/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/.test(url) && !url.includes(' ')) {
        url = 'https://' + url;
      } else {
        url = settings.searchEngine + encodeURIComponent(url);
      }
    }
    updateTab(targetTabId, { url, title: url, loading: true });
    window.dispatchEvent(new CustomEvent('flip-navigate', { detail: { tabId: targetTabId, url } }));
  }

  function goTo(url, title) {
    updateTab(targetTabId, { url, title, loading: true });
    window.dispatchEvent(new CustomEvent('flip-navigate', { detail: { tabId: targetTabId, url } }));
  }

  const hours = currentTime.getHours();
  const mins = currentTime.getMinutes();
  const lang = settings.language || 'en';
  const locale = lang === 'es' ? 'es-US' : 'en-US';
  const timeStr = currentTime.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const dateStr = currentTime.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' });
  const greeting = getGreeting(hours, lang);

  const recentHistory = history.slice(0, 2);
  // Use selector subscription so it updates reactively when tabs change
  const tabCount = useBrowserStore((state) => state.tabs.length);

  // Stagger helper
  const s = (i) => ({
    opacity: mounted ? 1 : 0,
    transform: mounted ? 'translateY(0)' : 'translateY(16px)',
    transition: `opacity 0.5s ease ${i * 0.08}s, transform 0.5s ease ${i * 0.08}s`,
  });

  const wallpaperStyle = settings.wallpaper
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)), url(${settings.wallpaper})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : { backgroundColor: '#0c0a09' };

  return (
    <div className="flex-1 relative w-full h-full overflow-hidden" style={wallpaperStyle}>
      {/* Ambient orbs (only when no wallpaper) */}
      {!settings.wallpaper && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Orb color="rgba(255,98,52,0.08)" size={400} x={20} y={-5} delay={0} duration={8} />
          <Orb color="rgba(45,212,168,0.05)" size={350} x={70} y={10} delay={2} duration={10} />
          <Orb color="rgba(255,122,77,0.04)" size={300} x={50} y={50} delay={4} duration={12} />
        </div>
      )}

      <div className="absolute inset-0 flex flex-col items-center overflow-y-auto px-6 z-10 pt-[8vh]">
        <div className="max-w-xl w-full">
          {/* Logo + greeting + time */}
          <div className="text-center mb-5" style={s(0)}>
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-[16px] bg-white/[0.04] border border-white/[0.06] mb-4 backdrop-blur-sm">
              <FlipLogo size={30} className="drop-shadow-lg" />
            </div>
            <p className="text-[13px] text-white/30 font-light tracking-wide mb-1">{greeting}</p>
            <h1 className="text-5xl font-[200] text-white/90 tracking-tighter tabular-nums mb-1">{timeStr}</h1>
            <p className="text-[13px] text-white/20 font-light">{dateStr}</p>
            {dailyQuote && (
              <p className="text-[11px] text-white/20 font-light italic mt-3 max-w-sm mx-auto leading-relaxed">
                "{dailyQuote}"
              </p>
            )}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="mb-6" style={s(1)}>
            <div className="group flex items-center gap-3 px-5 py-3.5 rounded-[16px] bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.1] focus-within:border-flip-500/25 focus-within:bg-white/[0.06] focus-within:shadow-mac transition-all duration-300 backdrop-blur-sm">
              <Search size={16} className="text-white/20 group-focus-within:text-flip-400/60 transition-colors" />
              <input
                ref={inputRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={t('searchOrType', lang)}
                className="flex-1 bg-transparent text-[14px] text-white/90 placeholder-white/20 outline-none"
                spellCheck={false}
              />
              {searchValue && (
                <button type="submit" className="w-8 h-8 rounded-[10px] bg-flip-500/15 flex items-center justify-center text-flip-400 hover:bg-flip-500/25 transition-colors">
                  <ArrowRight size={13} />
                </button>
              )}
            </div>
          </form>

          {/* Quick links */}
          <div className="mb-5" style={s(2)}>
            <div className="flex items-center justify-center gap-2">
              {QUICK_LINKS.map((link) => (
                <button
                  key={link.name}
                  onClick={() => goTo(link.url, link.name)}
                  className="group flex flex-col items-center gap-1 w-14 py-2 rounded-2xl hover:bg-white/[0.05] transition-all duration-200"
                >
                  <div className="w-10 h-10 rounded-[12px] bg-white/[0.04] border border-white/[0.06] flex items-center justify-center overflow-hidden group-hover:border-white/[0.1] group-hover:scale-105 transition-all duration-200 backdrop-blur-sm">
                    <img
                      src={link.icon}
                      alt={link.name}
                      className="w-5 h-5 object-contain"
                      loading="lazy"
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                    <span className="text-white/40 font-semibold text-xs hidden items-center justify-center">{link.name[0]}</span>
                  </div>
                  <span className="text-[10px] text-white/25 group-hover:text-white/50 transition-colors font-medium truncate w-full text-center">
                    {link.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center justify-center gap-3 mb-4" style={s(3)}>
            <MiniStat icon={Shield} value={blockedCount} label={t('blocked', lang)} color="text-accent-400" />
            <MiniStat icon={Bookmark} value={bookmarks.length} label={t('saved', lang)} color="text-amber-400" />
            <MiniStat icon={Zap} value={tabCount} label={t('tabs', lang)} color="text-flip-400" />
          </div>

          {/* Shortcuts + Credit */}
          <div className="text-center" style={s(4)}>
            <div className="inline-flex items-center gap-4 text-[10px] text-white/10 mb-2">
              <span><kbd className="bg-white/[0.04] rounded px-1.5 py-0.5 text-white/20 mr-1">Ctrl+K</kbd>{t('commands', lang)}</span>
              <span><kbd className="bg-white/[0.04] rounded px-1.5 py-0.5 text-white/20 mr-1">Ctrl+T</kbd>{t('newTab', lang)}</span>
              <span><kbd className="bg-white/[0.04] rounded px-1.5 py-0.5 text-white/20 mr-1">Ctrl+L</kbd>{t('urlBar', lang)}</span>
            </div>
          </div>
        </div>

        {/* World News Section */}
        {newsItems.length > 0 && (
          <div className="max-w-2xl w-full mt-6 mb-8" style={s(5)}>
            <div className="flex items-center gap-2 mb-3">
              <Newspaper size={13} className="text-flip-400/60" />
              <span className="text-[10px] font-semibold text-white/25 uppercase tracking-widest">World News</span>
              <button
                onClick={fetchNews}
                className="ml-auto text-white/15 hover:text-white/40 transition-colors p-1 rounded-lg hover:bg-white/5"
                title="Refresh news"
              >
                <RefreshCw size={11} className={newsLoading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {newsItems.map((item, i) => (
                <button
                  key={i}
                  onClick={() => goTo(item.link, item.title)}
                  className="group flex gap-3 p-3 rounded-[14px] bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-200 text-left backdrop-blur-sm"
                >
                  {item.thumb && (
                    <img
                      src={item.thumb}
                      alt=""
                      className="w-16 rounded-lg object-cover flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
                      style={{ width: 64, height: 64, aspectRatio: '1 / 1' }}
                      loading="lazy"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-white/60 group-hover:text-white/80 transition-colors leading-snug line-clamp-3">
                      {item.title}
                    </p>
                    {item.pubDate && (
                      <p className="text-[9px] text-white/15 mt-1.5 font-medium">
                        {(() => { try { return new Date(item.pubDate).toLocaleString(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } })()}
                      </p>
                    )}
                  </div>
                  <ExternalLink size={10} className="text-white/10 group-hover:text-white/30 transition-colors flex-shrink-0 mt-0.5" />
                </button>
              ))}
            </div>
            <div className="text-center mt-3">
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); goTo('https://croak.work', 'CROAKWORKS'); }}
                className="text-[9px] text-white/10 hover:text-white/30 tracking-[0.2em] font-medium transition-colors duration-300"
              >
                CROAKWORKS
              </a>
            </div>
          </div>
        )}

        {/* Credit fallback if no news */}
        {newsItems.length === 0 && (
          <div className="mt-2 mb-8" style={s(5)}>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); goTo('https://croak.work', 'CROAKWORKS'); }}
              className="text-[9px] text-white/10 hover:text-white/30 tracking-[0.2em] font-medium transition-colors duration-300"
            >
              CROAKWORKS
            </a>
          </div>
        )}
      </div>

      {/* Tron-style orange light border glow on update */}
      {showCelebration && <TronBorderGlow />}

      {/* "What's new" changelog — centered modal */}
      {whatsNew && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="relative w-[340px] max-h-[70vh] flex flex-col vibrancy border border-white/[0.08] rounded-[20px] shadow-mac-xl overflow-hidden">
            {/* Tron accent line at top */}
            <div className="h-[2px] bg-gradient-to-r from-transparent via-flip-500 to-transparent" />

            {/* Header */}
            <div className="px-5 pt-5 pb-3 text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-[12px] bg-gradient-to-br from-flip-500/20 to-accent-400/10 border border-flip-500/20 flex items-center justify-center">
                <Sparkles size={18} className="text-flip-400" />
              </div>
              <h2 className="text-[15px] font-bold text-white/90">Updated to v{whatsNew.version}</h2>
              <p className="text-[11px] text-white/35 mt-1">Here's what changed</p>
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto px-5 pb-2 scrollbar-none">
              <ul className="space-y-2">
                {whatsNew.notes.map((note, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[11px] text-white/55 leading-relaxed">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-flip-500/60 shrink-0" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-white/[0.06]">
              <button
                onClick={() => { setWhatsNew(null); setShowCelebration(false); }}
                className="w-full py-2 rounded-[12px] bg-flip-500/15 border border-flip-500/20 text-[12px] font-medium text-flip-400 hover:bg-flip-500/25 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TronBorderGlow() {
  return (
    <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden rounded-[inherit]">
      {/* Rotating conic-gradient light that traces the border like a Tron light cycle */}
      <div
        className="absolute inset-0"
        style={{
          background: 'transparent',
          border: '2px solid transparent',
          borderRadius: 'inherit',
          maskImage: 'linear-gradient(#000,#000)',
          WebkitMaskImage: 'linear-gradient(#000,#000)',
        }}
      >
        {/* The moving orange light beam */}
        <div
          className="absolute -inset-[2px]"
          style={{
            background: 'conic-gradient(from var(--tron-angle, 0deg) at 50% 50%, transparent 0%, transparent 70%, #ff6234 78%, #f97316 82%, #fbbf24 86%, transparent 94%, transparent 100%)',
            animation: 'tron-spin 3s linear infinite',
            borderRadius: 'inherit',
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'exclude',
            WebkitMaskComposite: 'xor',
            padding: '2px',
          }}
        />
      </div>
      {/* Soft inner glow */}
      <div
        className="absolute inset-0"
        style={{
          boxShadow: 'inset 0 0 60px rgba(249,115,22,0.06), inset 0 0 120px rgba(255,98,52,0.03)',
          animation: 'tron-pulse 3s ease-in-out infinite',
          borderRadius: 'inherit',
        }}
      />
      <style>{`
        @keyframes tron-spin {
          from { --tron-angle: 0deg; }
          to   { --tron-angle: 360deg; }
        }
        @keyframes tron-pulse {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        @property --tron-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
      `}</style>
    </div>
  );
}

function MiniStat({ icon: Icon, value, label, color }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]">
      <Icon size={11} className={clsx(color, 'opacity-50')} />
      <span className="text-[11px] text-white/50 font-semibold tabular-nums">{value}</span>
      <span className="text-[9px] text-white/15">{label}</span>
    </div>
  );
}
