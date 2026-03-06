export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  extension?: string;
}

export interface Tab {
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ProjectInfo {
  name: string;
  path: string;
  techStack: string[];
  fileCount: number;
  lastOpened: string;
}
