import { create } from 'zustand';
import { persist, createJSONStorage, devtools } from 'zustand/middleware';
import type { FileNode, Tab, ChatMessage, ProjectInfo } from '../types';
import { saveFile, deleteFile, fetchFileTree } from '../api/filesApi';

const MAX_OPERATION_HISTORY = 50;

export interface FileOperationChange {
  filePath: string;
  oldContent: string | null;  // null means file didn't exist (new file)
  newContent: string | null;  // null means file was deleted
  backupPath?: string;
}

export interface FileOperation {
  id: string;
  type: 'apply' | 'create' | 'delete' | 'rename' | 'edit';
  timestamp: number;
  description: string;
  changes: FileOperationChange[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

const MAX_CHAT_SESSIONS = 50;
const MAX_MESSAGE_CHARS = 100_000; // ~100KB for typical text

function generateSessionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getSessionTitle(messages: ChatMessage[]): string {
  const first = messages.find(m => m.role === 'user');
  if (!first) return '新对话';
  const text = typeof first.content === 'string'
    ? first.content
    : (first.content.find(p => p.type === 'text')?.text ?? '');
  return text.slice(0, 30) || '新对话';
}

function truncateMessage(msg: ChatMessage): ChatMessage {
  if (typeof msg.content !== 'string') return msg;
  if (msg.content.length <= MAX_MESSAGE_CHARS) return msg;
  return { ...msg, content: msg.content.slice(0, MAX_MESSAGE_CHARS) + '\n...[内容过长，已截断]' };
}

function findLastAssistantIndex(msgs: ChatMessage[]): number {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'assistant') return i;
  }
  return -1;
}

function createNewSession(): ChatSession {
  return {
    id: generateSessionId(),
    title: '新对话',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

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
  showSearchPanel: boolean;
  showProjectList: boolean;
  aiMode: 'chat' | 'agent';
  sidebarWidth: number;
  aiPanelWidth: number;
  currentBranch: string | null;
  chatMessages: ChatMessage[];
  chatSessions: ChatSession[];
  activeChatSessionId: string | null;
  isAiLoading: boolean;
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  previewUrl: string;
  operationHistory: FileOperation[];
  operationIndex: number;
  canUndo: boolean;
  canRedo: boolean;

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
  toggleSearchPanel: () => void;
  setShowProjectList: (show: boolean) => void;
  setAiMode: (mode: 'chat' | 'agent') => void;
  activateAgentMode: () => void;
  setSidebarWidth: (width: number) => void;
  setAIPanelWidth: (width: number) => void;
  setCurrentBranch: (branch: string) => void;
  addChatMessage: (message: ChatMessage) => void;
  updateLastAssistantMessage: (content: string) => void;
  clearChat: () => void;
  setAiLoading: (loading: boolean) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
  setPreviewUrl: (url: string) => void;
  createChatSession: () => void;
  switchChatSession: (id: string) => void;
  deleteChatSession: (id: string) => void;
  pushOperation: (op: Omit<FileOperation, 'id' | 'timestamp'>) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clearHistory: () => void;
}

export const useAppStore = create<AppState>()(
  devtools(
    persist(
      (set, get) => {
        const initialSession = createNewSession();
        return {
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
          showSearchPanel: false,
          showProjectList: false,
          aiMode: 'chat' as const,
          sidebarWidth: 240,
          aiPanelWidth: 320,
          currentBranch: null,
          chatMessages: [],
          chatSessions: [initialSession],
          activeChatSessionId: initialSession.id,
          isAiLoading: false,
          toast: null,
          previewUrl: '',
          operationHistory: [],
          operationIndex: -1,
          canUndo: false,
          canRedo: false,

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
          toggleSearchPanel: () => set((state) => ({ showSearchPanel: !state.showSearchPanel })),
          setShowProjectList: (show) => set({ showProjectList: show }),
          setAiMode: (mode) => set({ aiMode: mode }),
          activateAgentMode: () => set({ aiMode: 'agent', showAIPanel: true }),
          setSidebarWidth: (width) => set({ sidebarWidth: width }),
          setAIPanelWidth: (width) => set({ aiPanelWidth: width }),
          setCurrentBranch: (branch) => set({ currentBranch: branch }),

          addChatMessage: (message) =>
            set((state) => {
              const safeMsg = truncateMessage(message);
              const newMessages = [...state.chatMessages, safeMsg];
              const updatedSessions = state.chatSessions.map(s =>
                s.id === state.activeChatSessionId
                  ? {
                      ...s,
                      messages: newMessages,
                      title: getSessionTitle(newMessages),
                      updatedAt: Date.now(),
                    }
                  : s
              );
              return { chatMessages: newMessages, chatSessions: updatedSessions };
            }),

          updateLastAssistantMessage: (content) =>
            set((state) => {
              const msgs = [...state.chatMessages];
              const lastIdx = findLastAssistantIndex(msgs);
              if (lastIdx >= 0) {
                msgs[lastIdx] = { ...msgs[lastIdx], content };
              }
              const updatedSessions = state.chatSessions.map(s =>
                s.id === state.activeChatSessionId
                  ? { ...s, messages: msgs, updatedAt: Date.now() }
                  : s
              );
              return { chatMessages: msgs, chatSessions: updatedSessions };
            }),

          clearChat: () =>
            set((state) => {
              const updatedSessions = state.chatSessions.map(s =>
                s.id === state.activeChatSessionId
                  ? { ...s, messages: [], title: '新对话', updatedAt: Date.now() }
                  : s
              );
              return { chatMessages: [], chatSessions: updatedSessions };
            }),

          setAiLoading: (loading) => set({ isAiLoading: loading }),

          showToast: (message, type = 'info') =>
            set({ toast: { message, type } }),
          clearToast: () => set({ toast: null }),
          setPreviewUrl: (url) => set({ previewUrl: url }),

          createChatSession: () =>
            set((state) => {
              const newSession = createNewSession();
              let sessions = [newSession, ...state.chatSessions];
              // Enforce maximum number of sessions
              if (sessions.length > MAX_CHAT_SESSIONS) {
                sessions = sessions.slice(0, MAX_CHAT_SESSIONS);
              }
              return {
                chatSessions: sessions,
                activeChatSessionId: newSession.id,
                chatMessages: [],
              };
            }),

          switchChatSession: (id) =>
            set((state) => {
              const session = state.chatSessions.find(s => s.id === id);
              if (!session) return {};
              return {
                activeChatSessionId: id,
                chatMessages: session.messages,
              };
            }),

          deleteChatSession: (id) =>
            set((state) => {
              const remaining = state.chatSessions.filter(s => s.id !== id);
              if (remaining.length === 0) {
                const newSession = createNewSession();
                return {
                  chatSessions: [newSession],
                  activeChatSessionId: newSession.id,
                  chatMessages: [],
                };
              }
              const newActiveId = state.activeChatSessionId === id
                ? remaining[0].id
                : state.activeChatSessionId;
              const activeSession = remaining.find(s => s.id === newActiveId);
              return {
                chatSessions: remaining,
                activeChatSessionId: newActiveId,
                chatMessages: activeSession?.messages ?? [],
              };
            }),

          pushOperation: (op) =>
            set((state) => {
              const id = generateSessionId();
              const newOp: FileOperation = { ...op, id, timestamp: Date.now() };
              // Discard any redo history beyond current index
              const truncated = state.operationHistory.slice(0, state.operationIndex + 1);
              let newHistory = [...truncated, newOp];
              // Enforce max history size
              if (newHistory.length > MAX_OPERATION_HISTORY) {
                newHistory = newHistory.slice(newHistory.length - MAX_OPERATION_HISTORY);
              }
              const newIndex = newHistory.length - 1;
              return {
                operationHistory: newHistory,
                operationIndex: newIndex,
                canUndo: newIndex >= 0,
                canRedo: false,
              };
            }),

          undo: async () => {
            const state = get();
            const op = state.operationHistory[state.operationIndex];
            if (!op) return;
            try {
              for (const change of op.changes) {
                if (change.oldContent === null) {
                  // File was newly created; undo = delete it
                  await deleteFile(change.filePath);
                } else {
                  // Restore the previous content
                  await saveFile(change.filePath, change.oldContent);
                }
              }
              const newIndex = state.operationIndex - 1;
              set(s => {
                const updatedTabs = s.openTabs
                  .filter(tab => {
                    const change = op.changes.find(c => c.filePath === tab.path);
                    // If file was newly created and we're undoing, close the tab
                    return !(change && change.oldContent === null);
                  })
                  .map(tab => {
                    const change = op.changes.find(c => c.filePath === tab.path);
                    if (!change) return tab;
                    return { ...tab, content: change.oldContent as string, isDirty: false };
                  });
                const activeStillExists = updatedTabs.some(t => t.path === s.activeTabPath);
                return {
                  operationIndex: newIndex,
                  canUndo: newIndex >= 0,
                  canRedo: true,
                  openTabs: updatedTabs,
                  activeTabPath: activeStillExists ? s.activeTabPath : (updatedTabs[updatedTabs.length - 1]?.path ?? null),
                };
              });
              // Refresh file tree
              const currentProject = get().currentProject;
              if (currentProject) {
                try {
                  const tree = await fetchFileTree(currentProject.path);
                  set({ fileTree: tree });
                } catch { /* ignore tree refresh errors */ }
              }
              get().showToast(`↩ 已撤销: ${op.description}`, 'info');
            } catch (e) {
              get().showToast(`撤销失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
            }
          },

          redo: async () => {
            const state = get();
            const op = state.operationHistory[state.operationIndex + 1];
            if (!op) return;
            try {
              for (const change of op.changes) {
                if (change.newContent === null) {
                  // Operation was a deletion; redo = delete again
                  await deleteFile(change.filePath);
                } else {
                  // Re-apply the new content
                  await saveFile(change.filePath, change.newContent);
                }
              }
              const newIndex = state.operationIndex + 1;
              const newHistory = get().operationHistory;
              set(s => {
                const updatedTabs = s.openTabs
                  .filter(tab => {
                    const change = op.changes.find(c => c.filePath === tab.path);
                    // If the operation deleted this file, close the tab
                    return !(change && change.newContent === null);
                  })
                  .map(tab => {
                    const change = op.changes.find(c => c.filePath === tab.path);
                    if (!change || change.newContent === null) return tab;
                    return { ...tab, content: change.newContent, isDirty: false };
                  });
                const activeStillExists = updatedTabs.some(t => t.path === s.activeTabPath);
                return {
                  operationIndex: newIndex,
                  canUndo: newIndex >= 0,
                  canRedo: newIndex < newHistory.length - 1,
                  openTabs: updatedTabs,
                  activeTabPath: activeStillExists ? s.activeTabPath : (updatedTabs[updatedTabs.length - 1]?.path ?? null),
                };
              });
              // Refresh file tree
              const currentProject = get().currentProject;
              if (currentProject) {
                try {
                  const tree = await fetchFileTree(currentProject.path);
                  set({ fileTree: tree });
                } catch { /* ignore tree refresh errors */ }
              }
              get().showToast(`↪ 已重做: ${op.description}`, 'info');
            } catch (e) {
              get().showToast(`重做失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
            }
          },

          clearHistory: () =>
            set({ operationHistory: [], operationIndex: -1, canUndo: false, canRedo: false }),
        };
      },
      {
        name: 'deepseek-app-store',
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          chatSessions: state.chatSessions,
          activeChatSessionId: state.activeChatSessionId,
          selectedModel: state.selectedModel,
          aiMode: state.aiMode,
        }),
        onRehydrateStorage: () => (state) => {
          if (!state) return;
          if (state.chatSessions.length === 0) {
            // Ensure there is always at least one session
            const fresh = createNewSession();
            state.chatSessions = [fresh];
            state.activeChatSessionId = fresh.id;
            state.chatMessages = [];
            return;
          }
          // Sync chatMessages from the active session after hydration
          const activeSession = state.chatSessions.find(
            s => s.id === state.activeChatSessionId
          );
          if (activeSession) {
            state.chatMessages = activeSession.messages;
          } else {
            state.activeChatSessionId = state.chatSessions[0].id;
            state.chatMessages = state.chatSessions[0].messages;
          }
        },
      }
    ),
    { name: 'deepseek-app' }
  )
);
