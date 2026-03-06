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
  timestamp?: number;
}

export interface ProjectInfo {
  name: string;
  path: string;
  techStack: string[];
  fileCount: number;
  lastOpened: string;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  gradient: string;
}
