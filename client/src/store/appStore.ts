import { create } from 'zustand';
import type { FileNode, Tab, ChatMessage, ProjectInfo } from '../types';

interface AppState {
  fileTree: FileNode | null;
  currentProject: ProjectInfo | null;
  openTabs: Tab[];
  activeTabPath: string | null;
  selectedModel: string;
  showPreview: boolean;
  chatMessages: ChatMessage[];
  isAiLoading: boolean;

  setFileTree: (tree: FileNode | null) => void;
  setCurrentProject: (project: ProjectInfo | null) => void;
  openTab: (tab: Tab) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  updateTabContent: (path: string, content: string, isDirty: boolean) => void;
  setSelectedModel: (model: string) => void;
  togglePreview: () => void;
  addChatMessage: (message: ChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  clearChat: () => void;
  setAiLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  fileTree: null,
  currentProject: null,
  openTabs: [],
  activeTabPath: null,
  selectedModel: 'deepseek-chat',
  showPreview: false,
  chatMessages: [],
  isAiLoading: false,

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

  setActiveTab: (path) => set({ activeTabPath: path }),

  updateTabContent: (path, content, isDirty) =>
    set((state) => ({
      openTabs: state.openTabs.map((t) =>
        t.path === path ? { ...t, content, isDirty } : t
      ),
    })),

  setSelectedModel: (model) => set({ selectedModel: model }),
  togglePreview: () => set((state) => ({ showPreview: !state.showPreview })),

  addChatMessage: (message) =>
    set((state) => ({ chatMessages: [...state.chatMessages, message] })),

  updateLastAssistantMessage: (content) =>
    set((state) => {
      const msgs = [...state.chatMessages];
      const lastIdx = msgs.findLastIndex((m) => m.role === 'assistant');
      if (lastIdx >= 0) {
        msgs[lastIdx] = { ...msgs[lastIdx], content };
      }
      return { chatMessages: msgs };
    }),

  clearChat: () => set({ chatMessages: [] }),
  setAiLoading: (loading) => set({ isAiLoading: loading }),
}));
