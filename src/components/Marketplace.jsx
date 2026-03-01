import React, { useState, useEffect } from 'react';
import {
  Store, Search, Download, Trash2, Star, TrendingUp, Sparkles,
  Bot, Music, StickyNote, CloudSun, Braces, Palette, FileSearch,
  Gamepad2, Hammer, MessageCircle, Package, CheckCircle2, Loader2,
  Filter, Grid3X3, List, ArrowUpDown, ExternalLink, Globe, Wallet, Lock, Newspaper, Phone,
  KeyRound, ShieldCheck, Calendar, QrCode, Calculator, Ruler, Clock, Wifi,
  Image as ImageIcon, Pencil, ArrowLeftRight, Smile, Camera, Gauge, Video,
  EyeOff, ShieldAlert, Film, Share2, Shield, Crown, DollarSign, Podcast, Waves,
} from 'lucide-react';
import useBrowserStore from '../store/browserStore';

const ICON_MAP = {
  bot: Bot,
  music: Music,
  'sticky-note': StickyNote,
  'cloud-sun': CloudSun,
  braces: Braces,
  palette: Palette,
  'file-search': FileSearch,
  'gamepad-2': Gamepad2,
  hammer: Hammer,
  'message-circle': MessageCircle,
  globe: Globe,
  wallet: Wallet,
  lock: Lock,
  newspaper: Newspaper,
  phone: Phone,
  'key-round': KeyRound,
  'shield-check': ShieldCheck,
  calendar: Calendar,
  'qr-code': QrCode,
  calculator: Calculator,
  ruler: Ruler,
  clock: Clock,
  wifi: Wifi,
  image: ImageIcon,
  pencil: Pencil,
  'arrow-left-right': ArrowLeftRight,
  smile: Smile,
  camera: Camera,
  gauge: Gauge,
  video: Video,
  'eye-off': EyeOff,
  'shield-alert': ShieldAlert,
  film: Film,
  'share-2': Share2,
  shield: Shield,
  'trash-2': Trash2,
  podcast: Podcast,
  Podcast: Podcast,
  waves: Waves,
  Waves: Waves,
};

const CATEGORIES = [
  { id: 'all', label: 'All', icon: Grid3X3 },
  { id: 'productivity', label: 'Productivity', icon: Sparkles },
  { id: 'developer', label: 'Developer', icon: Braces },
  { id: 'media', label: 'Media', icon: Music },
  { id: 'social', label: 'Social', icon: MessageCircle },
  { id: 'crypto', label: 'Crypto', icon: Hammer },
  { id: 'games', label: 'Games', icon: Gamepad2 },
  { id: 'utilities', label: 'Utilities', icon: CloudSun },
  { id: 'security', label: 'Security', icon: Lock },
];

export default function Marketplace() {
  const { setExtensions, addTab } = useBrowserStore();
  const [catalog, setCatalog] = useState([]);
  const [bundled, setBundled] = useState([]);
  const [installed, setInstalled] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState('featured');
  const [installing, setInstalling] = useState(null);
  const [error, setError] = useState('');
  const [entitlements, setEntitlements] = useState([]);
  const [purchasing, setPurchasing] = useState(null);
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem('flip-premium-email') || '');
  const [showEmailPrompt, setShowEmailPrompt] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState(null);
  const [emailInput, setEmailInput] = useState('');

  useEffect(() => {
    loadCatalog();
    loadEntitlements();
  }, []);

  async function loadEntitlements() {
    try {
      const email = localStorage.getItem('flip-premium-email');
      if (!email) return;
      const result = await window.flipAPI?.premiumCheckEntitlements?.(email);
      if (result?.extensions) setEntitlements(result.extensions);
    } catch {}
  }

  function hasEntitlement(extId) {
    return entitlements.some(e => e.ext_id === extId && e.status === 'active');
  }

  function isPremium(ext) {
    return ext.pricing && ext.pricing.type && ext.pricing.price > 0;
  }

  async function handlePurchase(ext) {
    const email = localStorage.getItem('flip-premium-email');
    if (!email) {
      // Show email prompt, save which extension they want to buy
      setPendingPurchase(ext);
      setShowEmailPrompt(true);
      return;
    }
    setPurchasing(ext.id);
    setError('');
    try {
      const result = await window.flipAPI?.premiumCreateCheckout?.({
        email,
        extId: ext.id,
        priceId: ext.pricing.stripe_price_id,
        planType: ext.pricing.type,
      });
      if (result?.error) {
        setError(result.error);
      } else if (result?.url) {
        addTab(result.url);
      }
    } catch (e) {
      setError(e.message);
    }
    setPurchasing(null);
  }

  async function handleEmailSubmit(e) {
    e.preventDefault();
    const email = emailInput.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    localStorage.setItem('flip-premium-email', email);
    setUserEmail(email);
    setShowEmailPrompt(false);
    setEmailInput('');
    // Now continue with the pending purchase
    if (pendingPurchase) {
      const ext = pendingPurchase;
      setPendingPurchase(null);
      setPurchasing(ext.id);
      try {
        const result = await window.flipAPI?.premiumCreateCheckout?.({
          email,
          extId: ext.id,
          priceId: ext.pricing.stripe_price_id,
          planType: ext.pricing.type,
        });
        if (result?.error) {
          setError(result.error);
        } else if (result?.url) {
          addTab(result.url);
        }
      } catch (err) {
        setError(err.message);
      }
      setPurchasing(null);
    }
    // Also load entitlements now that we have an email
    loadEntitlements();
  }

  async function loadCatalog() {
    setLoading(true);
    setError('');
    try {
      const [catalogData, installedData] = await Promise.all([
        window.flipAPI?.marketplaceCatalog?.(),
        window.flipAPI?.marketplaceGetInstalled?.(),
      ]);
      if (catalogData?.error) {
        setError(catalogData.error);
      }
      setCatalog(catalogData?.extensions || []);
      setBundled(installedData?.bundled || []);
      setInstalled(installedData?.userInstalled || []);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }

  async function handleInstall(extId) {
    setInstalling(extId);
    try {
      const result = await window.flipAPI?.marketplaceInstall?.(extId);
      if (result?.error) {
        setError(result.error);
      } else {
        setInstalled((prev) => [...prev, extId]);
        // Reload extensions in the sidebar (refresh)
        const exts = await window.flipAPI?.loadExtensions?.();
        if (exts) setExtensions(exts);
      }
    } catch (e) {
      setError(e.message);
    }
    setInstalling(null);
  }

  async function handleUninstall(extId) {
    setInstalling(extId);
    try {
      const result = await window.flipAPI?.marketplaceUninstall?.(extId);
      if (result?.error) {
        setError(result.error);
      } else {
        setInstalled((prev) => prev.filter((id) => id !== extId));
        const exts = await window.flipAPI?.loadExtensions?.();
        if (exts) setExtensions(exts);
      }
    } catch (e) {
      setError(e.message);
    }
    setInstalling(null);
  }

  // Filter and sort
  let filtered = catalog;
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.author.toLowerCase().includes(q)
    );
  }
  if (category !== 'all') {
    filtered = filtered.filter((e) => e.category === category);
  }
  if (sortBy === 'featured') {
    filtered = [...filtered].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || b.downloads - a.downloads);
  } else if (sortBy === 'downloads') {
    filtered = [...filtered].sort((a, b) => b.downloads - a.downloads);
  } else if (sortBy === 'rating') {
    filtered = [...filtered].sort((a, b) => b.rating - a.rating);
  } else if (sortBy === 'name') {
    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }

  const featured = catalog.filter((e) => e.featured);

  return (
    <div className="flex-1 overflow-y-auto bg-surface-0 custom-scrollbar">
      <div className="max-w-[960px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-flip-500 to-orange-500 flex items-center justify-center shadow-lg shadow-flip-500/20">
            <Store size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white/90">Extension Marketplace</h1>
            <p className="text-[11px] text-white/30">
              {catalog.length} extensions available · {bundled.length + installed.length} installed
            </p>
          </div>
        </div>

        {/* Email prompt modal */}
        {showEmailPrompt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => { setShowEmailPrompt(false); setPendingPurchase(null); }}>
            <form onSubmit={handleEmailSubmit} onClick={e => e.stopPropagation()} className="bg-[#141419] border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                  <Crown size={18} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white/90">Premium Extension</h3>
                  <p className="text-[10px] text-white/30">Enter your email to continue</p>
                </div>
              </div>
              {pendingPurchase && (
                <p className="text-[11px] text-white/40 mb-3">
                  Purchasing <strong className="text-white/70">{pendingPurchase.name}</strong> — ${pendingPurchase.pricing?.price}/mo
                </p>
              )}
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                placeholder="your@email.com"
                autoFocus
                required
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white/80 placeholder:text-white/20 outline-none focus:border-amber-500/40 transition-colors mb-3"
              />
              <p className="text-[9px] text-white/20 mb-4">Your email is used to manage your subscription. We'll never spam you.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setShowEmailPrompt(false); setPendingPurchase(null); }} className="flex-1 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-white/40 hover:bg-white/[0.08] transition-colors">
                  Cancel
                </button>
                <button type="submit" className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-xs text-amber-400 font-semibold hover:from-amber-500/30 hover:to-orange-500/30 transition-colors">
                  Continue
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 text-xs text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError('')} className="text-red-400/50 hover:text-red-400">✕</button>
          </div>
        )}

        {/* Featured banner */}
        {!loading && featured.length > 0 && !search && category === 'all' && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <TrendingUp size={12} /> Featured
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {featured.map((ext) => {
                const IconComp = ICON_MAP[ext.icon] || Package;
                const isBundled = bundled.includes(ext.id);
                const isUserInstalled = installed.includes(ext.id);
                const isAnyInstalled = isBundled || isUserInstalled;
                return (
                  <div
                    key={ext.id}
                    className="group relative bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06] rounded-xl p-4 hover:border-flip-500/30 hover:shadow-lg hover:shadow-flip-500/5 transition-all duration-200"
                  >
                    <div className="flex items-start gap-3 mb-2">
                      <div className="w-9 h-9 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                        <IconComp size={18} className="text-flip-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-white/90 truncate">{ext.name}</p>
                        <p className="text-[9px] text-white/30">{ext.author}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2 mb-3">{ext.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[9px] text-white/25">
                        {ext.rating > 0 && (
                          <span className="flex items-center gap-0.5"><Star size={9} className="text-amber-400" /> {ext.rating}</span>
                        )}
                        {ext.downloads > 0 ? (
                          <span>{ext.downloads >= 1000 ? `${(ext.downloads / 1000).toFixed(1)}k` : ext.downloads}</span>
                        ) : (
                          <span className="text-flip-400/60">New</span>
                        )}
                      </div>
                      {isAnyInstalled ? (
                        <span className={`text-[9px] flex items-center gap-1 ${isBundled ? 'text-white/30' : 'text-emerald-400'}`}>
                          <CheckCircle2 size={10} /> {isBundled ? 'Bundled' : 'Installed'}
                        </span>
                      ) : isPremium(ext) && !hasEntitlement(ext.id) ? (
                        <button
                          onClick={() => handlePurchase(ext)}
                          disabled={purchasing === ext.id}
                          className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/25 text-[10px] text-amber-400 font-medium hover:from-amber-500/25 hover:to-orange-500/25 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {purchasing === ext.id ? <Loader2 size={10} className="animate-spin" /> : <><Crown size={10} /> ${ext.pricing.price}/{ext.pricing.type === 'monthly' ? 'mo' : ext.pricing.type === 'yearly' ? 'yr' : ''}</>}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleInstall(ext.id)}
                          disabled={installing === ext.id}
                          className="px-2.5 py-1 rounded-lg bg-flip-500/15 border border-flip-500/25 text-[10px] text-flip-400 font-medium hover:bg-flip-500/25 transition-colors disabled:opacity-50"
                        >
                          {installing === ext.id ? <Loader2 size={10} className="animate-spin" /> : 'Install'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Search + filters */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/20" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search extensions..."
              className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white/80 placeholder:text-white/20 outline-none focus:border-flip-500/40 transition-colors"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-white/[0.03] border border-white/[0.06] rounded-xl px-3 py-2.5 text-xs text-white/60 outline-none cursor-pointer"
          >
            <option value="featured">Featured</option>
            <option value="downloads">Most Popular</option>
            <option value="rating">Top Rated</option>
            <option value="name">A-Z</option>
          </select>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 custom-scrollbar">
          {CATEGORIES.map((cat) => {
            const CatIcon = cat.icon;
            const active = category === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all ${
                  active
                    ? 'bg-flip-500/15 border border-flip-500/30 text-flip-400'
                    : 'bg-white/[0.02] border border-white/[0.04] text-white/30 hover:text-white/50 hover:bg-white/[0.04]'
                }`}
              >
                <CatIcon size={12} />
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 size={24} className="text-flip-400 animate-spin" />
            <p className="text-xs text-white/30">Loading marketplace...</p>
          </div>
        )}

        {/* Extension grid */}
        {!loading && (
          <>
            <p className="text-[10px] text-white/20 mb-3">
              {filtered.length} extension{filtered.length !== 1 ? 's' : ''}
              {category !== 'all' ? ` in ${CATEGORIES.find((c) => c.id === category)?.label}` : ''}
              {search ? ` matching "${search}"` : ''}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtered.map((ext) => {
                const IconComp = ICON_MAP[ext.icon] || Package;
                const isBundled = bundled.includes(ext.id);
                const isUserInstalled = installed.includes(ext.id);
                const isAnyInstalled = isBundled || isUserInstalled;
                const isWorking = installing === ext.id;

                return (
                  <div
                    key={ext.id}
                    className="group bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 hover:border-white/[0.1] hover:bg-white/[0.03] transition-all duration-200"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/[0.05] flex items-center justify-center shrink-0 group-hover:bg-white/[0.08] transition-colors">
                        <IconComp size={20} className="text-white/40 group-hover:text-white/60 transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <h3 className="text-[13px] font-semibold text-white/85 truncate">{ext.name}</h3>
                          <span className="text-[9px] text-white/20 font-mono shrink-0 ml-2">v{ext.version}</span>
                        </div>
                        <p className="text-[10px] text-white/30 mb-1">by {ext.author}</p>
                        <p className="text-[11px] text-white/40 leading-relaxed line-clamp-2 mb-3">
                          {ext.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 text-[10px] text-white/25">
                            {ext.rating > 0 && (
                              <span className="flex items-center gap-1">
                                <Star size={10} className="text-amber-400/70" />
                                {ext.rating}
                              </span>
                            )}
                            {ext.downloads > 0 ? (
                              <span className="flex items-center gap-1">
                                <Download size={10} />
                                {ext.downloads >= 1000 ? `${(ext.downloads / 1000).toFixed(1)}k` : ext.downloads}
                              </span>
                            ) : (
                              <span className="text-flip-400/60">New</span>
                            )}
                            <span className="capitalize px-1.5 py-0.5 rounded bg-white/[0.04] text-[9px]">
                              {ext.category}
                            </span>
                          </div>
                          {isBundled ? (
                            <span className="text-[10px] text-white/30 flex items-center gap-1">
                              <CheckCircle2 size={11} /> Bundled
                            </span>
                          ) : isUserInstalled ? (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-emerald-400/80 flex items-center gap-1">
                                <CheckCircle2 size={11} /> Installed
                              </span>
                              <button
                                onClick={() => handleUninstall(ext.id)}
                                disabled={isWorking}
                                className="p-1.5 rounded-lg text-white/15 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                                title="Uninstall"
                              >
                                {isWorking ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              </button>
                            </div>
                          ) : isPremium(ext) && !hasEntitlement(ext.id) ? (
                            <button
                              onClick={() => handlePurchase(ext)}
                              disabled={purchasing === ext.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500/15 to-orange-500/15 border border-amber-500/25 text-[10px] text-amber-400 font-semibold hover:from-amber-500/25 hover:to-orange-500/25 transition-colors disabled:opacity-50"
                            >
                              {purchasing === ext.id ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <>
                                  <Crown size={11} /> ${ext.pricing.price}/{ext.pricing.type === 'monthly' ? 'mo' : ext.pricing.type === 'yearly' ? 'yr' : ''}
                                </>
                              )}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleInstall(ext.id)}
                              disabled={isWorking}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-flip-500/15 border border-flip-500/25 text-[10px] text-flip-400 font-semibold hover:bg-flip-500/25 transition-colors disabled:opacity-50"
                            >
                              {isWorking ? (
                                <Loader2 size={11} className="animate-spin" />
                              ) : (
                                <>
                                  <Download size={11} /> Install
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <Package size={32} className="text-white/10" />
                <p className="text-sm text-white/30">No extensions found</p>
                <p className="text-[10px] text-white/15">Try a different search or category</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
