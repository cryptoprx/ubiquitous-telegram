import { create } from 'zustand';
import { createTabsSlice } from './slices/tabsSlice';
import { createWorkspacesSlice } from './slices/workspacesSlice';
import { createUISlice } from './slices/uiSlice';
import { createSettingsSlice } from './slices/settingsSlice';
import { createBookmarksSlice } from './slices/bookmarksSlice';
import { createExtensionsSlice } from './slices/extensionsSlice';

const useBrowserStore = create((...a) => ({
  ...createTabsSlice(...a),
  ...createWorkspacesSlice(...a),
  ...createUISlice(...a),
  ...createSettingsSlice(...a),
  ...createBookmarksSlice(...a),
  ...createExtensionsSlice(...a),
}));

export default useBrowserStore;
