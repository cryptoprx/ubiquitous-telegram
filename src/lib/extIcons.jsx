/**
 * extIcons.js — Single source of truth for extension icon/gradient mappings.
 * Shared by ExtensionManager, ExtensionDock, and ExtensionPanel.
 */
import {
  Bot, Music, StickyNote, CloudSun, Braces, Palette, FileSearch,
  Hammer, MessageCircle, MessageSquare, Wallet, Zap,
  KeyRound, ShieldCheck, Newspaper, Calendar, QrCode, Calculator,
  Ruler, Clock, Wifi, Phone, Image as ImageIcon, Pencil,
  ArrowLeftRight, Smile, Camera, Gauge, Video,
  EyeOff, ShieldAlert, Film, Share2, Trash2, Shield, Puzzle,
} from 'lucide-react';

/** Icon + color for each known extension ID. Falls back to Puzzle icon. */
export const EXT_ICONS = {
  'ai-chat':              { icon: Bot,           color: 'text-orange-400' },
  'music-player':         { icon: Music,          color: 'text-pink-400'   },
  'sample-notes':         { icon: StickyNote,     color: 'text-amber-400'  },
  'sample-weather':       { icon: CloudSun,        color: 'text-sky-400'    },
  'json-formatter':       { icon: Braces,          color: 'text-emerald-400'},
  'color-picker':         { icon: Palette,         color: 'text-violet-400' },
  'regex-tester':         { icon: FileSearch,      color: 'text-cyan-400'   },
  'flipprx-miner':        { icon: Hammer,          color: 'text-orange-400' },
  'flipprx-game':         { icon: Zap,             color: 'text-rose-400'   },
  'mimo-messenger':       { icon: MessageSquare,   color: 'text-violet-400' },
  'community-chat':       { icon: MessageCircle,   color: 'text-teal-400'   },
  'password-vault':       { icon: KeyRound,        color: 'text-amber-400'  },
  'totp-auth':            { icon: ShieldCheck,     color: 'text-emerald-400'},
  'crypto-news':          { icon: Newspaper,       color: 'text-sky-400'    },
  'xrpl-wallet':          { icon: Wallet,          color: 'text-cyan-400'   },
  'calendar-widget':      { icon: Calendar,        color: 'text-blue-400'   },
  'qr-generator':         { icon: QrCode,          color: 'text-white/60'   },
  'calculator':           { icon: Calculator,      color: 'text-teal-400'   },
  'unit-converter':       { icon: Ruler,           color: 'text-indigo-400' },
  'world-clock':          { icon: Clock,           color: 'text-sky-400'    },
  'ip-lookup':            { icon: Wifi,            color: 'text-green-400'  },
  'flip-call':            { icon: Phone,           color: 'text-emerald-400'},
  'image-editor':         { icon: ImageIcon,       color: 'text-pink-400'   },
  'drawing-canvas':       { icon: Pencil,          color: 'text-violet-400' },
  'file-converter':       { icon: ArrowLeftRight,  color: 'text-blue-400'   },
  'meme-generator':       { icon: Smile,           color: 'text-yellow-400' },
  'screenshot-annotator': { icon: Camera,          color: 'text-rose-400'   },
  'speed-test':           { icon: Gauge,           color: 'text-green-400'  },
  'video-downloader':     { icon: Video,           color: 'text-red-400'    },
  'privacy-dashboard':    { icon: EyeOff,          color: 'text-purple-400' },
  'link-checker':         { icon: ShieldAlert,     color: 'text-amber-400'  },
  'flip-share':           { icon: Share2,          color: 'text-cyan-400'   },
  'gif-maker':            { icon: Film,            color: 'text-pink-400'   },
  'file-cleaner':         { icon: Trash2,          color: 'text-red-400'    },
  'security-dashboard':   { icon: Shield,          color: 'text-indigo-400' },
};

/** Tailwind gradient classes for extension card headers. */
export const EXT_GRADIENTS = {
  'sample-weather':  'from-sky-500/20 to-blue-600/20',
  'sample-notes':    'from-amber-500/20 to-orange-600/20',
  'mimo-messenger':  'from-violet-500/20 to-purple-600/20',
  'community-chat':  'from-teal-500/20 to-emerald-600/20',
  'flipprx-game':    'from-rose-500/20 to-red-600/20',
  'flipprx-miner':   'from-orange-500/20 to-amber-600/20',
  'music-player':    'from-pink-500/20 to-rose-600/20',
  'json-formatter':  'from-emerald-500/20 to-green-600/20',
  'color-picker':    'from-violet-500/20 to-fuchsia-600/20',
  'regex-tester':    'from-cyan-500/20 to-sky-600/20',
  'ai-chat':         'from-orange-500/20 to-amber-600/20',
  'xrpl-wallet':     'from-cyan-500/20 to-blue-600/20',
};

/** Default gradient when no specific one is mapped. */
export const DEFAULT_GRADIENT = 'from-flip-500/20 to-flip-700/20';

/**
 * Returns a React element for an extension's icon, or null.
 * @param {string} extId
 * @param {number} size
 * @param {string} [overrideClass] — Tailwind color class override (e.g. when active)
 */
export function getExtIconEl(extId, size = 14, overrideClass = null) {
  const entry = EXT_ICONS[extId];
  if (!entry) return null;
  const { icon: Icon, color } = entry;
  return <Icon size={size} className={overrideClass ?? color} />;
}
