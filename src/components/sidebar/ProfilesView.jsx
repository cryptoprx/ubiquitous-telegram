import React, { useState } from 'react';
import { User, Trash2, UserCircle2 } from 'lucide-react';
import clsx from 'clsx';
import useBrowserStore from '../../store/browserStore';

function ProfilesView() {
  const { profiles, setProfiles } = useBrowserStore();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState(null);
  const [switching, setSwitching] = useState(false);

  async function handleCreate() {
    if (!newName.trim()) return;
    const result = await window.flipAPI?.createProfile(newName.trim());
    if (result?.error) { setError(result.error); return; }
    if (result?.profiles) setProfiles(result.profiles);
    setNewName('');
    setError(null);
  }

  async function handleSwitch(name) {
    if (name === profiles.active) return;
    setSwitching(true);
    const result = await window.flipAPI?.switchProfile(name);
    if (result?.profiles) {
      setProfiles(result.profiles);
      // Reload data for new profile
      const bm = await window.flipAPI.getBookmarks();
      if (bm) useBrowserStore.getState().setBookmarks(bm);
      const hist = await window.flipAPI.getHistory();
      if (hist) useBrowserStore.getState().setHistory(hist);
      const savedSettings = await window.flipAPI.getSettings();
      if (savedSettings) useBrowserStore.getState().updateSettings(savedSettings);
    }
    setSwitching(false);
  }

  async function handleDelete(name) {
    const result = await window.flipAPI?.deleteProfile(name);
    if (result?.error) { setError(result.error); return; }
    if (result?.profiles) setProfiles(result.profiles);
    setError(null);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white/90 flex items-center gap-2">
          <UserCircle2 size={14} className="text-flip-400" />
          User Profiles
        </h2>
        <p className="text-[9px] text-white/25 mt-1">Each profile has separate bookmarks, history, and passwords.</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {profiles.profiles?.map((p) => (
          <div
            key={p.name}
            className={clsx(
              'flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all cursor-pointer',
              p.name === profiles.active
                ? 'border-flip-500/30 bg-flip-500/10'
                : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
            )}
            onClick={() => handleSwitch(p.name)}
          >
            <div className="flex items-center gap-2.5">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                p.name === profiles.active ? 'bg-flip-500/20 text-flip-400' : 'bg-white/5 text-white/40'
              )}>
                {p.name[0].toUpperCase()}
              </div>
              <div>
                <div className="text-[11px] text-white/80 font-medium">{p.name}</div>
                {p.name === profiles.active && (
                  <div className="text-[8px] text-flip-400 font-semibold uppercase tracking-wider">Active</div>
                )}
              </div>
            </div>
            {p.name !== 'Default' && p.name !== profiles.active && (
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(p.name); }}
                className="p-1 rounded-lg hover:bg-white/10 text-white/20 hover:text-red-400 transition-colors"
              >
                <Trash2 size={11} />
              </button>
            )}
          </div>
        ))}
        {switching && <div className="text-[10px] text-flip-400 text-center animate-pulse">Switching profile...</div>}
        {error && <div className="text-[10px] text-red-400 text-center">{error}</div>}
        <div className="pt-3 border-t border-white/5 mt-2">
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="New profile name..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-white/25 outline-none focus:border-flip-500/30"
            />
            <button
              onClick={handleCreate}
              disabled={!newName.trim()}
              className="px-3 py-1.5 rounded-lg bg-flip-500/20 border border-flip-500/25 text-[10px] text-flip-400 font-medium hover:bg-flip-500/30 transition-colors disabled:opacity-30"
            >
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilesView;
