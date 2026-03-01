export const createBookmarksSlice = (set, get) => ({
  bookmarks: [],
  bookmarkCategories: ['General', 'Development', 'News', 'Social', 'Shopping', 'Research', 'Entertainment', 'Work', 'Finance', 'Education'],
  setBookmarks: (bookmarks) => set({ bookmarks }),

  addBookmark: (bookmark) => {
    const id = Date.now();
    const newBm = { ...bookmark, id, category: bookmark.category || 'General', addedAt: new Date().toISOString() };
    set((state) => {
      const bookmarks = [...state.bookmarks, newBm];
      window.flipAPI?.saveBookmarks(bookmarks);
      return { bookmarks };
    });
    if (window.flipAPI?.aiChat && !bookmark.category) {
      window.flipAPI.aiChat({
        messages: [
          { role: 'system', content: 'You are a bookmark categorizer. Given a URL and title, respond with ONLY one category from this list: General, Development, News, Social, Shopping, Research, Entertainment, Work, Finance, Education. No explanation, just the category word.' },
          { role: 'user', content: `URL: ${bookmark.url}\nTitle: ${bookmark.title || ''}` },
        ],
        stream: false,
      }).then(result => {
        const cat = (typeof result === 'string' ? result : result?.content || '').trim();
        const validCats = get().bookmarkCategories;
        if (cat && validCats.includes(cat)) {
          set((state) => {
            const bookmarks = state.bookmarks.map(b => b.id === id ? { ...b, category: cat } : b);
            window.flipAPI?.saveBookmarks(bookmarks);
            return { bookmarks };
          });
        }
      }).catch(() => {});
    }
  },

  updateBookmark: (id, partial) =>
    set((state) => {
      const bookmarks = state.bookmarks.map(b => b.id === id ? { ...b, ...partial } : b);
      window.flipAPI?.saveBookmarks(bookmarks);
      return { bookmarks };
    }),

  removeBookmark: (id) =>
    set((state) => {
      const bookmarks = state.bookmarks.filter((b) => b.id !== id);
      window.flipAPI?.saveBookmarks(bookmarks);
      return { bookmarks };
    }),

  isBookmarked: (url) => get().bookmarks.some((b) => b.url === url),

  history: [],
  setHistory: (history) => set({ history }),
});
