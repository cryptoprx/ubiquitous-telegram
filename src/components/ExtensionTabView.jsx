import React, { useState, useEffect } from 'react';
import useBrowserStore from '../store/browserStore';
import ExtensionHost from './extensions/ExtensionHost';

/** Full-tab extension view — renders an extension in the main content area */
export default function ExtensionTabView({ extensionId }) {
  const [extension, setExtension] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadExt() {
      setLoading(true);
      if (window.flipAPI) {
        const exts = await window.flipAPI.loadExtensions();
        if (exts) {
          const ext = exts.find((e) => e.id === extensionId);
          if (ext) setExtension({ ...ext, enabled: true });
        }
      }
      setLoading(false);
    }
    loadExt();
  }, [extensionId]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-6 h-6 border-2 border-flip-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!extension) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <p className="text-white/40 text-sm font-medium">Extension not found</p>
          <p className="text-white/20 text-xs mt-1">"{extensionId}" is not installed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0a0a0f] overflow-hidden">
      <ExtensionHost extension={extension} width="100%" height="100%" />
    </div>
  );
}
