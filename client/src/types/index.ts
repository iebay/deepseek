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

export type MultimodalContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | MultimodalContentPart[];
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

export interface GitChange {
  file: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed';
}

export interface GitStatus {
  branch: string;
  changes: GitChange[];
  isRepo: boolean;
  hasRemote: boolean;
  remoteUrl?: string;
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitLog {
  commits: GitCommit[];
}
