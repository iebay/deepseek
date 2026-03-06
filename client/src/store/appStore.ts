import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FileNode, Tab, ChatMessage, ProjectInfo } from '../types';

interface AppState {
  fileTree: FileNode | null;
  currentProject: ProjectInfo | null;
  openTabs: Tab[];
  activeTabPath: string | null;
  selectedModel: string;
  showPreview: boolean;
  showSidebar: boolean;
  showAIPanel: boolean;
  showGitPanel: boolean;
  showTerminal: boolean;
  sidebarWidth: number;
  aiPanelWidth: number;
  chatMessages: ChatMessage[];
  isAiLoading: boolean;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  previewUrl: string;

  setFileTree: (tree: FileNode | null) => void;
  setCurrentProject: (project: ProjectInfo | null) => void;
  openTab: (tab: Tab) => void;
  closeTab: (path: string) => void;
  closeOtherTabs: (path: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (path: string) => void;
  updateTabContent: (path: string, content: string, isDirty: boolean) => void;
  reorderTabs: (fromIndex: number, toIndex: number) => void;
  setSelectedModel: (model: string) => void;
  togglePreview: () => void;
  toggleSidebar: () => void;
  toggleAIPanel: () => void;
  toggleGitPanel: () => void;
  toggleTerminal: () => void;
  setSidebarWidth: (width: number) => void;
  setAIPanelWidth: (width: number) => void;
  addChatMessage: (message: ChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  clearChat: () => void;
  setAiLoading: (loading: boolean) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
  setPreviewUrl: (url: string) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      fileTree: null,
      currentProject: null,
      openTabs: [],
      activeTabPath: null,
      selectedModel: 'deepseek-chat',
      showPreview: false,
      showSidebar: true,
      showAIPanel: true,
      showGitPanel: false,
      showTerminal: false,
      sidebarWidth: 240,
      aiPanelWidth: 320,
      chatMessages: [],
      isAiLoading: false,
      toast: null,
      previewUrl: '',

      setFileTree: (tree) => set({ fileTree: tree }),
      setCurrentProject: (project) => set({ currentProject: project }),

      openTab: (tab) =>
        set((state) => {
          const exists = state.openTabs.find((t) => t.path === tab.path);
          if (exists) return { activeTabPath: tab.path };
          return { openTabs: [...state.openTabs, tab], activeTabPath: tab.path };
        }),

      closeTab: (path) =>
        set((state) => {
          const idx = state.openTabs.findIndex((t) => t.path === path);
          const newTabs = state.openTabs.filter((t) => t.path !== path);
          let newActive = state.activeTabPath;
          if (state.activeTabPath === path) {
            newActive = newTabs[Math.max(0, idx - 1)]?.path ?? null;
          }
          return { openTabs: newTabs, activeTabPath: newActive };
        }),

      closeOtherTabs: (path) =>
        set((state) => ({
          openTabs: state.openTabs.filter((t) => t.path === path),
          activeTabPath: path,
        })),

      closeAllTabs: () => set({ openTabs: [], activeTabPath: null }),

      setActiveTab: (path) => set({ activeTabPath: path }),

      updateTabContent: (path, content, isDirty) =>
        set((state) => ({
          openTabs: state.openTabs.map((t) =>
            t.path === path ? { ...t, content, isDirty } : t
          ),
        })),

      reorderTabs: (fromIndex, toIndex) =>
        set((state) => {
          const newTabs = [...state.openTabs];
          const [removed] = newTabs.splice(fromIndex, 1);
          newTabs.splice(toIndex, 0, removed);
          return { openTabs: newTabs };
        }),

      setSelectedModel: (model) => set({ selectedModel: model }),
      togglePreview: () => set((state) => ({ showPreview: !state.showPreview })),
      toggleSidebar: () => set((state) => ({ showSidebar: !state.showSidebar })),
      toggleAIPanel: () => set((state) => ({ showAIPanel: !state.showAIPanel })),
      toggleGitPanel: () => set((state) => ({ showGitPanel: !state.showGitPanel })),
      toggleTerminal: () => set((state) => ({ showTerminal: !state.showTerminal })),
      setSidebarWidth: (width) => set({ sidebarWidth: width }),
      setAIPanelWidth: (width) => set({ aiPanelWidth: width }),

      addChatMessage: (message) =>
        set((state) => ({ chatMessages: [...state.chatMessages, message] })),

      updateLastAssistantMessage: (content) =>
        set((state) => {
          const msgs = [...state.chatMessages];
          // Use manual loop for ES2020 compatibility (findLastIndex requires ES2023)
          let lastIdx = -1;
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === 'assistant') { lastIdx = i; break; }
          }
          if (lastIdx >= 0) {
            msgs[lastIdx] = { ...msgs[lastIdx], content };
          }
          return { chatMessages: msgs };
        }),

      clearChat: () => set({ chatMessages: [] }),
      setAiLoading: (loading) => set({ isAiLoading: loading }),

      showToast: (message, type = 'info') =>
        set({ toast: { message, type } }),
      clearToast: () => set({ toast: null }),
      setPreviewUrl: (url) => set({ previewUrl: url }),
    }),
    {
      name: 'deepseek-app-settings',
      partialize: (state) => ({
        selectedModel: state.selectedModel,
        showPreview: state.showPreview,
        showSidebar: state.showSidebar,
        showAIPanel: state.showAIPanel,
        sidebarWidth: state.sidebarWidth,
        aiPanelWidth: state.aiPanelWidth,
      }),
    }
  )
);
