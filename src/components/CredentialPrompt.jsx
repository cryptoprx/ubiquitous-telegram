import React, { useState, useRef, useEffect } from 'react';
import { KeyRound } from 'lucide-react';
import useBrowserStore from '../store/browserStore';

/** "Save password?" prompt bar — shown when a login form submission is detected */
export default function CredentialPrompt() {
  const { pendingCredential, setPendingCredential } = useBrowserStore();

  if (!pendingCredential) return null;

  async function handleSave() {
    const passwords = (await window.flipAPI?.getPasswords()) || [];
    const entry = {
      id: Date.now(),
      site: pendingCredential.site,
      username: pendingCredential.username,
      password: pendingCredential.password,
      createdAt: Date.now(),
    };
    await window.flipAPI?.savePasswords([entry, ...passwords]);
    setPendingCredential(null);
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-surface-2 border-b border-white/5 animate-fade-in">
      <KeyRound size={14} className="text-flip-400 shrink-0" />
      <span className="text-xs text-white/70 truncate">
        Save password for <strong className="text-white/90">{pendingCredential.site}</strong> ({pendingCredential.username})?
      </span>
      <div className="flex items-center gap-1.5 ml-auto shrink-0">
        <button
          onClick={handleSave}
          className="px-3 py-1 rounded-lg bg-flip-500/20 text-flip-400 text-[11px] font-medium hover:bg-flip-500/30 transition-colors"
        >
          Save
        </button>
        <button
          onClick={() => setPendingCredential(null)}
          className="px-3 py-1 rounded-lg bg-white/5 text-white/40 text-[11px] font-medium hover:bg-white/10 hover:text-white/60 transition-colors"
        >
          Never
        </button>
      </div>
    </div>
  );
}
