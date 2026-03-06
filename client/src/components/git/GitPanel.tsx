import { useState, useEffect, useCallback } from 'react';
import {
  GitBranch, GitCommit, Upload, Check, FileText, Plus, Minus,
  Settings, RefreshCw, ChevronDown, ChevronRight, AlertCircle,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import {
  fetchGitStatus,
  fetchGitLog,
  commitChanges,
  pushChanges,
  initRepo,
  setRemote,
  configGitToken,
} from '../../api/gitApi';
import type { GitStatus, GitChange, GitCommit as GitCommitType } from '../../types';

function StatusIcon({ status }: { status: GitChange['status'] }) {
  if (status === 'added') return <Plus size={12} className="text-[#3fb950]" />;
  if (status === 'deleted') return <Minus size={12} className="text-[#f85149]" />;
  if (status === 'untracked') return <FileText size={12} className="text-[#8b949e]" />;
  return <FileText size={12} className="text-[#d29922]" />;
}

function statusColor(status: GitChange['status']) {
  if (status === 'added') return 'text-[#3fb950]';
  if (status === 'deleted') return 'text-[#f85149]';
  if (status === 'untracked') return 'text-[#8b949e]';
  return 'text-[#d29922]';
}

function statusLabel(status: GitChange['status']) {
  const map: Record<GitChange['status'], string> = {
    added: 'A',
    deleted: 'D',
    modified: 'M',
    untracked: 'U',
    renamed: 'R',
  };
  return map[status] ?? 'M';
}

export default function GitPanel() {
  const { currentProject, showToast } = useAppStore();
  const root = currentProject?.path ?? '';

  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [commits, setCommits] = useState<GitCommitType[]>([]);
  const [loading, setLoading] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [showHistory, setShowHistory] = useState(false);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [showRemoteDialog, setShowRemoteDialog] = useState(false);
  const [remoteUrlInput, setRemoteUrlInput] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!root) return;
    setLoading(true);
    try {
      const status = await fetchGitStatus(root);
      setGitStatus(status);
      // Default select all changed files
      setSelectedFiles(new Set(status.changes.map((c) => c.file)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to get git status';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [root, showToast]);

  const loadLog = useCallback(async () => {
    if (!root) return;
    try {
      const log = await fetchGitLog(root, 10);
      setCommits(log.commits);
    } catch {
      // Silently ignore log errors (no commits yet is fine)
    }
  }, [root]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (showHistory) loadLog();
  }, [showHistory, loadLog]);

  function toggleFile(file: string) {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file)) next.delete(file);
      else next.add(file);
      return next;
    });
  }

  function toggleAll() {
    if (!gitStatus) return;
    if (selectedFiles.size === gitStatus.changes.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(gitStatus.changes.map((c) => c.file)));
    }
  }

  async function handleInit() {
    try {
      await initRepo(root);
      showToast('Git 仓库初始化成功', 'success');
      await loadStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Init failed';
      showToast(msg, 'error');
    }
  }

  async function handleCommit(andPush = false) {
    if (!commitMsg.trim()) {
      showToast('请输入提交信息', 'error');
      return;
    }
    setIsCommitting(true);
    try {
      const files = selectedFiles.size > 0 ? Array.from(selectedFiles) : undefined;
      await commitChanges(root, commitMsg.trim(), files);
      showToast('提交成功', 'success');
      setCommitMsg('');
      await loadStatus();

      if (andPush) {
        await handlePush();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Commit failed';
      showToast(msg, 'error');
    } finally {
      setIsCommitting(false);
    }
  }

  async function handlePush() {
    setIsPushing(true);
    try {
      await pushChanges(root);
      showToast('推送成功', 'success');
      if (showHistory) await loadLog();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Push failed';
      showToast(msg, 'error');
    } finally {
      setIsPushing(false);
    }
  }

  async function handleSaveToken() {
    if (!tokenInput.trim()) return;
    try {
      await configGitToken(tokenInput.trim());
      showToast('Token 已保存', 'success');
      setShowTokenDialog(false);
      setTokenInput('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save token';
      showToast(msg, 'error');
    }
  }

  async function handleSetRemote() {
    if (!remoteUrlInput.trim()) return;
    try {
      await setRemote(root, remoteUrlInput.trim());
      showToast('Remote 设置成功', 'success');
      setShowRemoteDialog(false);
      setRemoteUrlInput('');
      await loadStatus();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to set remote';
      showToast(msg, 'error');
    }
  }

  if (!root) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-[#8b949e] gap-2 p-4">
        <AlertCircle size={24} />
        <p className="text-sm text-center">请先打开一个项目</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#e6edf3] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-2">
          <GitBranch size={14} className="text-[#388bfd]" />
          <span className="text-sm font-medium">Git</span>
          {gitStatus?.branch && (
            <span className="text-xs text-[#8b949e] bg-[#21262d] px-1.5 py-0.5 rounded">
              {gitStatus.branch}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowTokenDialog(true)}
            className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
            title="设置 GitHub Token"
          >
            <Settings size={13} />
          </button>
          <button
            onClick={loadStatus}
            disabled={loading}
            className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors disabled:opacity-50"
            title="刷新状态"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Not a repo */}
        {gitStatus && !gitStatus.isRepo && (
          <div className="p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[#8b949e] text-xs">
              <AlertCircle size={13} />
              <span>当前目录不是 Git 仓库</span>
            </div>
            <button
              onClick={handleInit}
              className="text-xs bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              git init
            </button>
          </div>
        )}

        {/* Repo content */}
        {gitStatus?.isRepo && (
          <>
            {/* No remote */}
            {!gitStatus.hasRemote && (
              <div className="px-3 py-2 border-b border-[#30363d]">
                <div className="flex items-center gap-2 text-[#d29922] text-xs mb-2">
                  <AlertCircle size={12} />
                  <span>未设置 Remote</span>
                </div>
                <button
                  onClick={() => setShowRemoteDialog(true)}
                  className="text-xs text-[#388bfd] hover:underline"
                >
                  设置 Remote URL
                </button>
              </div>
            )}

            {/* Changes section */}
            <div className="border-b border-[#30363d]">
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-xs text-[#8b949e] uppercase tracking-wide">
                  变更 ({gitStatus.changes.length})
                </span>
                {gitStatus.changes.length > 0 && (
                  <button
                    onClick={toggleAll}
                    className="text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors"
                  >
                    {selectedFiles.size === gitStatus.changes.length ? '取消全选' : '全选'}
                  </button>
                )}
              </div>

              {gitStatus.changes.length === 0 ? (
                <div className="px-3 py-2 text-xs text-[#8b949e]">无变更</div>
              ) : (
                <ul className="pb-1">
                  {gitStatus.changes.map((change) => (
                    <li key={change.file}>
                      <label className="flex items-center gap-2 px-3 py-1 hover:bg-[#161b22] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedFiles.has(change.file)}
                          onChange={() => toggleFile(change.file)}
                          className="accent-[#388bfd] shrink-0"
                        />
                        <StatusIcon status={change.status} />
                        <span className={`text-xs truncate flex-1 ${statusColor(change.status)}`} title={change.file}>
                          {change.file}
                        </span>
                        <span className={`text-[10px] font-mono shrink-0 ${statusColor(change.status)}`}>
                          {statusLabel(change.status)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Commit section */}
            <div className="px-3 py-2 border-b border-[#30363d]">
              <textarea
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="提交信息..."
                rows={2}
                className="w-full bg-[#161b22] border border-[#30363d] rounded-lg text-xs text-[#e6edf3] placeholder-[#8b949e] px-2 py-1.5 resize-none focus:outline-none focus:border-[#388bfd] transition-colors"
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => handleCommit(false)}
                  disabled={isCommitting || gitStatus.changes.length === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed text-white px-2 py-1.5 rounded-lg transition-colors"
                >
                  <GitCommit size={12} />
                  {isCommitting ? '提交中...' : 'Commit'}
                </button>
                <button
                  onClick={() => handleCommit(true)}
                  disabled={isCommitting || isPushing || gitStatus.changes.length === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-[#388bfd] hover:bg-[#58a6ff] disabled:opacity-50 disabled:cursor-not-allowed text-white px-2 py-1.5 rounded-lg transition-colors"
                >
                  <Upload size={12} />
                  {isCommitting || isPushing ? '处理中...' : 'Commit & Push'}
                </button>
              </div>
            </div>

            {/* Push section */}
            <div className="px-3 py-2 border-b border-[#30363d]">
              <button
                onClick={handlePush}
                disabled={isPushing || !gitStatus.hasRemote}
                className="w-full flex items-center justify-center gap-1.5 text-xs bg-[#388bfd] hover:bg-[#58a6ff] disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors"
                title={!gitStatus.hasRemote ? '请先设置 Remote' : '推送到远端'}
              >
                <Upload size={12} />
                {isPushing ? '推送中...' : 'Push'}
              </button>
              {gitStatus.remoteUrl && (
                <div className="flex items-center gap-1 mt-1.5">
                  <span className="text-[10px] text-[#8b949e] truncate">{gitStatus.remoteUrl}</span>
                  <button
                    onClick={() => setShowRemoteDialog(true)}
                    className="text-[10px] text-[#388bfd] hover:underline shrink-0"
                  >
                    修改
                  </button>
                </div>
              )}
            </div>

            {/* History section */}
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#161b22] transition-colors"
              >
                {showHistory ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <span className="uppercase tracking-wide">提交历史</span>
              </button>

              {showHistory && (
                <ul className="pb-2">
                  {commits.length === 0 ? (
                    <li className="px-3 py-1 text-xs text-[#8b949e]">暂无提交记录</li>
                  ) : (
                    commits.map((commit) => (
                      <li key={commit.hash} className="px-3 py-1.5 hover:bg-[#161b22] transition-colors">
                        <div className="flex items-start gap-2">
                          <Check size={11} className="text-[#3fb950] mt-0.5 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs text-[#e6edf3] truncate">{commit.message}</p>
                            <p className="text-[10px] text-[#8b949e] mt-0.5">
                              <span className="font-mono text-[#388bfd]">{commit.shortHash}</span>
                              {' · '}{commit.author}
                              {' · '}{new Date(commit.date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {/* Token Dialog */}
      {showTokenDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 w-72 shadow-xl">
            <h3 className="text-sm font-semibold text-[#e6edf3] mb-1">GitHub Personal Access Token</h3>
            <p className="text-xs text-[#8b949e] mb-3">
              Token 仅保存在服务器内存中，不会写入文件。
            </p>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="ghp_..."
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-[#e6edf3] placeholder-[#8b949e] px-3 py-2 focus:outline-none focus:border-[#388bfd] transition-colors mb-3"
              onKeyDown={(e) => e.key === 'Enter' && handleSaveToken()}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowTokenDialog(false); setTokenInput(''); }}
                className="text-xs text-[#8b949e] hover:text-[#e6edf3] px-3 py-1.5 rounded-lg hover:bg-[#21262d] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSaveToken}
                className="text-xs bg-[#238636] hover:bg-[#2ea043] text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remote URL Dialog */}
      {showRemoteDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 w-80 shadow-xl">
            <h3 className="text-sm font-semibold text-[#e6edf3] mb-3">设置 Remote URL</h3>
            <input
              type="text"
              value={remoteUrlInput}
              onChange={(e) => setRemoteUrlInput(e.target.value)}
              placeholder="https://github.com/user/repo.git"
              className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-[#e6edf3] placeholder-[#8b949e] px-3 py-2 focus:outline-none focus:border-[#388bfd] transition-colors mb-3"
              onKeyDown={(e) => e.key === 'Enter' && handleSetRemote()}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowRemoteDialog(false); setRemoteUrlInput(''); }}
                className="text-xs text-[#8b949e] hover:text-[#e6edf3] px-3 py-1.5 rounded-lg hover:bg-[#21262d] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSetRemote}
                className="text-xs bg-[#388bfd] hover:bg-[#58a6ff] text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                确定
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
