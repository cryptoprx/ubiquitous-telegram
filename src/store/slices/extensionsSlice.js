export const createExtensionsSlice = (set) => ({
  extensions: [],
  setExtensions: (extensions) => set({ extensions }),

  toggleExtension: (id) =>
    set((state) => {
      const updated = state.extensions.map((e) =>
        e.id === id ? { ...e, enabled: !e.enabled } : e
      );
      const states = {};
      updated.forEach((e) => { states[e.id] = e.enabled; });
      window.flipAPI?.saveExtensionStates?.(states);
      return { extensions: updated };
    }),

  addExtension: (ext) =>
    set((state) => ({
      extensions: [...state.extensions, ext],
    })),
});
