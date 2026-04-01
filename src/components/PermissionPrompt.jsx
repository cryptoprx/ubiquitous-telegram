import React, { useState } from 'react';
import useBrowserStore from '../store/browserStore';

/** Permission request prompt — floating overlay card */
export default function PermissionPrompt() {
  const { permissionRequest, setPermissionRequest } = useBrowserStore();

  if (!permissionRequest) return null;

  function handleAllow() {
    window.flipAPI?.respondPermission(permissionRequest.id, true);
    setPermissionRequest(null);
  }

  function handleDeny() {
    window.flipAPI?.respondPermission(permissionRequest.id, false);
    setPermissionRequest(null);
  }

  const permLabel = {
    notifications: 'send notifications',
    media: 'use your camera and microphone',
    camera: 'use your camera',
    microphone: 'use your microphone',
    'display-capture': 'share your screen',
    geolocation: 'access your location',
    midi: 'use MIDI devices',
    pointerLock: 'lock your pointer',
    fullscreen: 'enter fullscreen',
    openExternal: 'open an external app',
  }[permissionRequest.permission] || permissionRequest.permission;

  const permIcon = {
    notifications: '🔔',
    media: '📹',
    camera: '📷',
    microphone: '🎙️',
    'display-capture': '🖥️',
    geolocation: '📍',
  }[permissionRequest.permission] || '🔒';

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-20 animate-fade-in" onClick={handleDeny}>
      <div
        className="w-[340px] bg-surface-3 border border-white/10 rounded-2xl shadow-2xl shadow-black/60 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-lg">
              {permIcon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white/90 leading-tight">Permission Request</p>
              <p className="text-[11px] text-white/40 truncate mt-0.5">{permissionRequest.origin}</p>
            </div>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            This site wants to <strong className="text-white/90">{permLabel}</strong>
          </p>
        </div>
        <div className="flex border-t border-white/[0.06]">
          <button
            onClick={handleDeny}
            className="flex-1 py-3 text-xs font-medium text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-colors border-r border-white/[0.06]"
          >
            Block
          </button>
          <button
            onClick={handleAllow}
            className="flex-1 py-3 text-xs font-semibold text-flip-400 hover:bg-flip-500/10 transition-colors"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
