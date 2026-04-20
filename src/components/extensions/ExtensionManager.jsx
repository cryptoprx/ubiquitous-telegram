import React, { useState } from 'react';
import {
  Puzzle, Plus, Trash2, ToggleLeft, ToggleRight,
  ExternalLink, FolderOpen, AlertCircle, Check,
  Shield, Eye, RefreshCw, Zap, Globe, MessageSquare,
  Braces, Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';
import { EXT_ICONS, EXT_GRADIENTS, DEFAULT_GRADIENT } from '../../lib/extIcons';



const TYPE_CONFIG = {
  sidebar: { label: 'Sidebar', color: 'text-blue-400', bg: 'bg-blue-500/10', icon: Puzzle },
  popup: { label: 'Popup', color: 'text-purple-400', bg: 'bg-purple-500/10', icon: Zap },
  toolbar: { label: 'Toolbar', color: 'text-green-400', bg: 'bg-green-500/10', icon: Globe },
};

export default function ExtensionManager() {
  const { extensions, toggleExtension, addExtension, setExtensions } = useBrowserStore();
  const [installing, setInstalling] = useState(false);
  const [uninstalling, setUninstalling] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  async function handleInstall() {
    if (!window.flipAPI) {
      setError('Extension API not available (run in Electron)');
      return;
    }
    setInstalling(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await window.flipAPI.installExtension();
      if (!result) { setInstalling(false); return; }
      if (result.error) {
        setError(result.error);
      } else {
        addExtension(result);
        setSuccess(`"${result.manifest.name}" installed!`);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (e) {
      setError(e.message);
    }
    setInstalling(false);
  }

  async function handleReload() {
    if (!window.flipAPI) return;
    const exts = await window.flipAPI.loadExtensions();
    if (exts) setExtensions(exts);
  }

  function handleRemove(extId) {
    setExtensions(extensions.filter((e) => e.id !== extId));
  }

  async function handleUninstall(extId) {
    setUninstalling(extId);
    setError(null);
    try {
      const result = await window.flipAPI?.marketplaceUninstall?.(extId);
      if (result?.error) {
        setError(result.error);
      } else {
        const exts = await window.flipAPI?.loadExtensions?.();
        if (exts) setExtensions(exts);
        setSuccess(`Extension uninstalled`);
        setTimeout(() => setSuccess(null), 3000);
      }
    } catch (e) {
      setError(e.message);
    }
    setUninstalling(null);
  }

  const enabledCount = extensions.filter(e => e.enabled).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[13px] font-semibold text-white/90">Extensions</h2>
            <p className="text-[10px] text-white/30 mt-0.5">
              {enabledCount} active · {extensions.length} installed
            </p>
          </div>
          <button
            onClick={handleReload}
            className="w-8 h-8 rounded-[10px] flex items-center justify-center text-white/25 hover:text-white/50 hover:bg-white/[0.05] transition-colors"
            title="Reload extensions"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        {/* Install from Folder — disabled */}

        {error && (
          <div className="mt-2 flex items-start gap-2 p-2.5 rounded-[12px] bg-red-500/10 border border-red-500/15">
            <AlertCircle size={12} className="text-red-400 mt-0.5 flex-shrink-0" />
            <span className="text-[10px] text-red-300">{error}</span>
          </div>
        )}
        {success && (
          <div className="mt-2 flex items-center gap-2 p-2.5 rounded-[12px] bg-green-500/10 border border-green-500/15 animate-fade-in">
            <Check size={12} className="text-green-400" />
            <span className="text-[10px] text-green-300">{success}</span>
          </div>
        )}
      </div>

      {/* Extension cards */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {extensions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-[16px] bg-gradient-to-br from-flip-500/10 to-accent-400/10 border border-white/[0.06] flex items-center justify-center mb-4">
              <Puzzle size={24} className="text-flip-400/40" />
            </div>
            <p className="text-xs text-white/40 mb-1">No extensions yet</p>
            <p className="text-[10px] text-white/20 max-w-48 leading-relaxed">
              Build React components that run inside Flip with full access to the browser API.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {[...extensions].sort((a, b) => {
              if (a.enabled && !b.enabled) return -1;
              if (!a.enabled && b.enabled) return 1;
              return 0;
            }).map((ext) => (
              <ExtensionCard
                key={ext.id}
                extension={ext}
                onToggle={() => toggleExtension(ext.id)}
                onRemove={() => handleRemove(ext.id)}
                onUninstall={() => handleUninstall(ext.id)}
                isUninstalling={uninstalling === ext.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-white/[0.06]">
        <div className="flex items-center gap-3 text-[9px] text-white/20">
          <div className="flex items-center gap-1">
            <Braces size={8} /> JSX + manifest.json
          </div>
          <div className="flex items-center gap-1">
            <Shield size={8} /> Sandboxed
          </div>
        </div>
      </div>
    </div>
  );
}

function ExtensionCard({ extension, onToggle, onRemove, onUninstall, isUninstalling }) {
  const { manifest, enabled, id, source } = extension;
  const isMarketplace = source === 'marketplace';
  const extIcon = EXT_ICONS[id];
  const gradient = EXT_GRADIENTS[id] || DEFAULT_GRADIENT;
  const typeConf = TYPE_CONFIG[manifest.type] || TYPE_CONFIG.sidebar;
  const isWebview = manifest.content_type === 'webview';

  return (
    <div
      className={clsx(
        'rounded-[16px] border overflow-hidden transition-all duration-200',
        enabled
          ? 'border-white/[0.06] hover:border-white/[0.1]'
          : 'border-white/[0.04] opacity-50'
      )}
    >
      {/* Gradient header strip */}
      <div className={clsx('h-1 w-full bg-gradient-to-r', enabled ? gradient : 'from-white/5 to-white/5')} />

      <div className="p-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={clsx(
            'w-11 h-11 rounded-[14px] flex items-center justify-center text-lg flex-shrink-0 transition-all',
            enabled
              ? `bg-gradient-to-br ${gradient}`
              : 'bg-white/[0.03]'
          )}>
            {extIcon
              ? React.createElement(extIcon.icon, { size: 18, className: extIcon.color })
              : (manifest.name?.[0] || 'E')}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-[13px] font-medium text-white/85 truncate">
                {manifest.name || 'Unnamed'}
              </h3>
              {isWebview && (
                <Globe size={9} className="text-white/20 flex-shrink-0" />
              )}
            </div>
            <p className="text-[10px] text-white/30 mt-0.5 line-clamp-1 leading-relaxed">
              {manifest.description || 'No description'}
            </p>

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-2">
              <span className={clsx('text-[9px] rounded-[6px] px-1.5 py-0.5 font-medium', typeConf.bg, typeConf.color)}>
                {typeConf.label}
              </span>
              <span className="text-[9px] text-white/15">v{manifest.version || '1.0'}</span>
              {manifest.author && (
                <span className="text-[9px] text-white/20 truncate">by {manifest.author}</span>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
            <button
              onClick={onToggle}
              className="p-0.5 rounded-[10px] hover:bg-white/[0.05] transition-colors"
              title={enabled ? 'Disable' : 'Enable'}
            >
              {enabled ? (
                <ToggleRight size={20} className="text-flip-400" />
              ) : (
                <ToggleLeft size={20} className="text-white/15" />
              )}
            </button>
            {isMarketplace && (
              <button
                onClick={onUninstall}
                disabled={isUninstalling}
                className="p-1 rounded-[10px] text-white/10 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                title="Uninstall"
              >
                {isUninstalling ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              </button>
            )}
          </div>
        </div>

        {/* Permissions */}
        {enabled && manifest.permissions && manifest.permissions.length > 0 && (
          <div className="flex items-center gap-1 mt-2.5 pl-[56px] flex-wrap">
            {manifest.permissions.map((perm) => (
              <span
                key={perm}
                className="text-[8px] bg-white/[0.04] text-white/25 rounded-[6px] px-1.5 py-0.5 font-medium uppercase tracking-wider"
              >
                {perm}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
