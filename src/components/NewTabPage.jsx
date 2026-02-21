import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search, Clock, Bookmark, Globe, Shield, Zap,
  ArrowRight, Sparkles, X, Newspaper, ExternalLink, RefreshCw,
} from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../store/browserStore';
import { t } from '../i18n';
import FlipLogo from './FlipLogo';
import flipLogoUrl from '../assets/fliplogo.png';

const DAILY_QUOTES = [
  'The only way to do great work is to love what you do.',
  'Believe you can and you\'re halfway there.',
  'It does not matter how slowly you go as long as you do not stop.',
  'Everything you\'ve ever wanted is on the other side of fear.',
  'Success is not final, failure is not fatal: it is the courage to continue that counts.',
  'The future belongs to those who believe in the beauty of their dreams.',
  'What you get by achieving your goals is not as important as what you become by achieving your goals.',
  'The best time to plant a tree was 20 years ago. The second best time is now.',
  'Your limitation—it\'s only your imagination.',
  'Push yourself, because no one else is going to do it for you.',
  'Great things never come from comfort zones.',
  'Dream it. Wish it. Do it.',
  'Success doesn\'t just find you. You have to go out and get it.',
  'The harder you work for something, the greater you\'ll feel when you achieve it.',
  'Don\'t stop when you\'re tired. Stop when you\'re done.',
  'Wake up with determination. Go to bed with satisfaction.',
  'Do something today that your future self will thank you for.',
  'Little things make big days.',
  'It\'s going to be hard, but hard does not mean impossible.',
  'Don\'t wait for opportunity. Create it.',
  'Sometimes we\'re tested not to show our weaknesses, but to discover our strengths.',
  'The key to success is to focus on goals, not obstacles.',
  'Dream bigger. Do bigger.',
  'Don\'t be afraid to give up the good to go for the great.',
  'The secret of getting ahead is getting started.',
  'It always seems impossible until it\'s done.',
  'What lies behind us and what lies before us are tiny matters compared to what lies within us.',
  'Hardships often prepare ordinary people for an extraordinary destiny.',
  'If you want to achieve greatness stop asking for permission.',
  'Things work out best for those who make the best of how things work out.',
  'To live a creative life, we must lose our fear of being wrong.',
  'If you are not willing to risk the usual, you will have to settle for the ordinary.',
  'All our dreams can come true if we have the courage to pursue them.',
  'Good things come to people who wait, but better things come to those who go out and get them.',
  'If you do what you always did, you will get what you always got.',
  'Happiness is not something readymade. It comes from your own actions.',
  'The ones who are crazy enough to think they can change the world are the ones that do.',
  'Failure is the condiment that gives success its flavor.',
  'We may encounter many defeats but we must not be defeated.',
  'Knowing is not enough; we must apply. Wishing is not enough; we must do.',
  'Imagine your life is perfect in every respect; what would it look like?',
  'We generate fears while we sit. We overcome them by action.',
  'Whether you think you can or think you can\'t, you\'re right.',
  'Security is mostly a superstition. Life is either a daring adventure or nothing.',
  'The man who has confidence in himself gains the confidence of others.',
  'The only limit to our realization of tomorrow will be our doubts of today.',
  'Creativity is intelligence having fun.',
  'What you do speaks so loudly that I cannot hear what you say.',
  'The most difficult thing is the decision to act, the rest is merely tenacity.',
  'An unexamined life is not worth living.',
  'Everything has beauty, but not everyone sees it.',
  'Turn your wounds into wisdom.',
  'Change your thoughts and you change your world.',
  'If you want to lift yourself up, lift up someone else.',
  'A person who never made a mistake never tried anything new.',
  'How wonderful it is that nobody need wait a single moment before starting to improve the world.',
  'When you reach the end of your rope, tie a knot in it and hang on.',
  'There is nothing impossible to they who will try.',
  'The only impossible journey is the one you never begin.',
  'With the new day comes new strength and new thoughts.',
];

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
  const [dailyQuote, setDailyQuote] = useState('');
  const [showCelebration, setShowCelebration] = useState(false);
  const confettiRef = useRef(null);

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
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
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

    // Daily motivational quote — pick one based on day of year
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    setDailyQuote(DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length]);

    return () => clearInterval(timer);
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
  const tabCount = useBrowserStore.getState().tabs.length;

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
          <Orb color="rgba(255,98,52,0.12)" size={400} x={20} y={-5} delay={0} duration={8} />
          <Orb color="rgba(45,212,168,0.08)" size={350} x={70} y={10} delay={2} duration={10} />
          <Orb color="rgba(255,122,77,0.06)" size={300} x={50} y={50} delay={4} duration={12} />
        </div>
      )}

      <div className="absolute inset-0 flex flex-col items-center overflow-y-auto px-6 z-10 pt-[8vh]">
        <div className="max-w-xl w-full">
          {/* Logo + greeting + time */}
          <div className="text-center mb-5" style={s(0)}>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] mb-3 backdrop-blur-sm">
              <FlipLogo size={28} className="drop-shadow-lg" />
            </div>
            <p className="text-xs text-white/30 font-light tracking-wide mb-1">{greeting}</p>
            <h1 className="text-5xl font-[200] text-white/90 tracking-tighter tabular-nums mb-0.5">{timeStr}</h1>
            <p className="text-[12px] text-white/20 font-light">{dateStr}</p>
            {dailyQuote && (
              <p className="text-[11px] text-white/25 font-light italic mt-2.5 max-w-sm mx-auto leading-relaxed">
                "{dailyQuote}"
              </p>
            )}
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="mb-6" style={s(1)}>
            <div className="group flex items-center gap-3 px-5 py-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.1] focus-within:border-flip-500/30 focus-within:bg-white/[0.06] transition-all duration-300 backdrop-blur-sm">
              <Search size={16} className="text-white/20 group-focus-within:text-flip-400/60 transition-colors" />
              <input
                ref={inputRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder={t('searchOrType', lang)}
                className="flex-1 bg-transparent text-[14px] text-white placeholder-white/20 outline-none"
                spellCheck={false}
              />
              {searchValue && (
                <button type="submit" className="w-7 h-7 rounded-full bg-flip-500/20 flex items-center justify-center text-flip-400 hover:bg-flip-500/30 transition-colors">
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
                  <div className="w-9 h-9 rounded-xl bg-white/[0.05] border border-white/[0.05] flex items-center justify-center overflow-hidden group-hover:border-white/[0.1] group-hover:scale-105 transition-all duration-200 backdrop-blur-sm">
                    <img
                      src={link.icon}
                      alt={link.name}
                      className="w-5 h-5 object-contain"
                      loading="lazy"
                      onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                    />
                    <span className="text-white/40 font-semibold text-xs hidden items-center justify-center">{link.name[0]}</span>
                  </div>
                  <span className="text-[9px] text-white/25 group-hover:text-white/50 transition-colors font-medium truncate w-full text-center">
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
                  className="group flex gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] hover:border-white/[0.1] transition-all duration-200 text-left backdrop-blur-sm"
                >
                  {item.thumb && (
                    <img
                      src={item.thumb}
                      alt=""
                      className="w-16 h-16 rounded-lg object-cover flex-shrink-0 opacity-80 group-hover:opacity-100 transition-opacity"
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

      {/* Confetti canvas */}
      {showCelebration && <ConfettiCanvas />}

      {/* "What's new" toast — shown once after an update */}
      {whatsNew && (
        <div className="absolute bottom-5 right-5 z-20 max-w-xs animate-fade-in">
          <div className="bg-surface-2/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/50 p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <Sparkles size={13} className="text-flip-400" />
              <span className="text-[11px] font-semibold text-white/80">What's new in v{whatsNew.version}</span>
              <button onClick={() => { setWhatsNew(null); setShowCelebration(false); }} className="ml-auto text-white/20 hover:text-white/50 transition-colors">
                <X size={12} />
              </button>
            </div>
            <div className="text-center mb-3">
              <p className="text-[13px] font-bold text-white/90">Flip Browser is now complete!</p>
              <p className="text-[10px] text-white/40 mt-0.5">Thank you for being part of the journey.</p>
            </div>
            <ul className="space-y-1 mb-1">
              {whatsNew.notes.map((note, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[10px] text-white/40 leading-tight">
                  <span className="text-flip-400/70 mt-px shrink-0">•</span>
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function ConfettiCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = (canvas.width = canvas.offsetWidth);
    let h = (canvas.height = canvas.offsetHeight);
    const colors = ['#ff6234', '#fbbf24', '#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#2dd4a8', '#f97316', '#06b6d4'];
    const particles = [];

    for (let i = 0; i < 150; i++) {
      particles.push({
        x: Math.random() * w,
        y: Math.random() * h * -1.5,
        w: 4 + Math.random() * 6,
        h: 6 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        rot: Math.random() * 360,
        rotV: (Math.random() - 0.5) * 8,
        opacity: 0.9 + Math.random() * 0.1,
        shape: Math.random() > 0.5 ? 'rect' : 'circle',
      });
    }

    let raf;
    let fadeStart = 0;
    const duration = 7000;
    const startTime = Date.now();

    function draw() {
      const elapsed = Date.now() - startTime;
      const fadeAlpha = elapsed > duration - 2000 ? Math.max(0, 1 - (elapsed - (duration - 2000)) / 2000) : 1;
      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        p.rot += p.rotV;
        p.vx *= 0.999;

        if (p.y > h + 20) continue;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.globalAlpha = p.opacity * fadeAlpha;

        if (p.shape === 'rect') {
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
        ctx.restore();
      }

      if (elapsed < duration) {
        raf = requestAnimationFrame(draw);
      }
    }

    draw();

    const handleResize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-30 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    />
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
