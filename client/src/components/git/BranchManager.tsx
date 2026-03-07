import { useState, useEffect, useCallback, useRef } from 'react';
import {
  GitBranch, Plus, Trash2, GitMerge, ChevronDown,
  RefreshCw, ArrowDown, ArrowUp, Check,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import {
  fetchBranches,
  createBranch,
  checkoutBranch,
  mergeBranch,
  deleteBranch,
  pullBranch,
  pushBranch,
} from '../../api/gitApi';
import type { BranchInfo, BranchesResponse } from '../../api/gitApi';

interface BranchManagerProps {
  root: string;
  onBranchChange?: () => void;
}

export default function BranchManager({ root, onBranchChange }: BranchManagerProps) {
  const { showToast, setCurrentBranch } = useAppStore();

  const [branches, setBranches] = useState<BranchesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState<BranchInfo | null>(null);
  const [showMergeDialog, setShowMergeDialog] = useState<BranchInfo | null>(null);
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchBase, setNewBranchBase] = useState('');
  const [newBranchCheckout, setNewBranchCheckout] = useState(true);
  const [forceDelete, setForceDelete] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [showLocal, setShowLocal] = useState(true);
  const [showRemote, setShowRemote] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const loadBranches = useCallback(async () => {
    if (!root) return;
    setLoading(true);
    try {
      const data = await fetchBranches(root);
      setBranches(data);
      if (data.current) setCurrentBranch(data.current);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load branches';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [root, showToast, setCurrentBranch]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    if (showDropdown) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  async function handleCheckout(name: string) {
    setShowDropdown(false);
    try {
      await checkoutBranch(root, name);
      showToast(`已切换到 ${name}`, 'success');
      await loadBranches();
      onBranchChange?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Checkout failed';
      showToast(msg, 'error');
    }
  }

  async function handleCreate() {
    if (!newBranchName.trim() || !newBranchBase) return;
    setIsCreating(true);
    try {
      await createBranch(root, newBranchName.trim(), newBranchBase, newBranchCheckout);
      showToast(`分支 ${newBranchName.trim()} 已创建`, 'success');
      setShowCreateDialog(false);
      setNewBranchName('');
      await loadBranches();
      if (newBranchCheckout) onBranchChange?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Create branch failed';
      showToast(msg, 'error');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete() {
    if (!showDeleteDialog) return;
    setIsDeleting(true);
    try {
      await deleteBranch(root, showDeleteDialog.name, forceDelete);
      showToast(`分支 ${showDeleteDialog.name} 已删除`, 'success');
      setShowDeleteDialog(null);
      setForceDelete(false);
      await loadBranches();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Delete branch failed';
      showToast(msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleMerge() {
    if (!showMergeDialog || !branches) return;
    setIsMerging(true);
    try {
      const result = await mergeBranch(root, showMergeDialog.name, branches.current);
      if (result.success) {
        showToast(`已将 ${showMergeDialog.name} 合并到 ${branches.current}`, 'success');
        setShowMergeDialog(null);
        await loadBranches();
        onBranchChange?.();
      } else {
        const conflictInfo = result.conflicts?.length
          ? `\n冲突文件: ${result.conflicts.join(', ')}`
          : '';
        showToast(`合并失败: ${result.message}${conflictInfo}`, 'error');
        setShowMergeDialog(null);
        await loadBranches();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Merge failed';
      showToast(msg, 'error');
    } finally {
      setIsMerging(false);
    }
  }

  async function handlePull() {
    if (!branches?.current) return;
    setIsPulling(true);
    try {
      await pullBranch(root, 'origin', branches.current);
      showToast('拉取成功', 'success');
      await loadBranches();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Pull failed';
      showToast(msg, 'error');
    } finally {
      setIsPulling(false);
    }
  }

  async function handlePush() {
    if (!branches?.current) return;
    setIsPushing(true);
    try {
      // Check if upstream exists
      const hasUpstream = branches.remote.some(
        (r) => r.name === `origin/${branches.current}`
      );
      await pushBranch(root, 'origin', branches.current, !hasUpstream);
      showToast('推送成功', 'success');
      await loadBranches();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Push failed';
      showToast(msg, 'error');
    } finally {
      setIsPushing(false);
    }
  }

  function openCreateDialog() {
    setNewBranchBase(branches?.current ?? '');
    setNewBranchName('');
    setNewBranchCheckout(true);
    setShowCreateDialog(true);
  }

  if (!branches) {
    return (
      <div className="px-3 py-2 border-b border-[#30363d]">
        <div className="flex items-center gap-2 text-[#8b949e] text-xs">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>加载分支中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-[#30363d]">
      {/* Current branch + actions */}
      <div className="px-3 py-2 flex items-center gap-2">
        {/* Branch switcher dropdown */}
        <div className="relative flex-1 min-w-0" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown((v) => !v)}
            className="flex items-center gap-1.5 w-full min-w-0 bg-[#161b22] border border-[#30363d] rounded-lg px-2 py-1 text-xs hover:border-[#388bfd] transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] shrink-0" />
            <span className="text-[#e6edf3] truncate flex-1 text-left">{branches.current || '(no branch)'}</span>
            <ChevronDown size={11} className="text-[#8b949e] shrink-0" />
          </button>

          {showDropdown && (
            <div className="absolute top-full left-0 mt-1 w-full bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
              {branches.local.map((b) => (
                <button
                  key={b.name}
                  onClick={() => !b.isCurrent && handleCheckout(b.name)}
                  className={`flex items-center gap-2 w-full px-2.5 py-1.5 text-xs hover:bg-[#21262d] transition-colors ${b.isCurrent ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {b.isCurrent
                    ? <Check size={11} className="text-[#3fb950] shrink-0" />
                    : <span className="w-2.5 h-2.5 shrink-0" />
                  }
                  <span className={`truncate ${b.isCurrent ? 'text-[#3fb950]' : 'text-[#e6edf3]'}`}>
                    {b.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Pull / Push / New / Refresh */}
        <button
          onClick={handlePull}
          disabled={isPulling}
          className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors disabled:opacity-50"
          title="拉取 (Pull)"
        >
          <ArrowDown size={13} className={isPulling ? 'animate-pulse' : ''} />
        </button>
        <button
          onClick={handlePush}
          disabled={isPushing}
          className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors disabled:opacity-50"
          title="推送 (Push)"
        >
          <ArrowUp size={13} className={isPushing ? 'animate-pulse' : ''} />
        </button>
        <button
          onClick={openCreateDialog}
          className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
          title="新建分支"
        >
          <Plus size={13} />
        </button>
        <button
          onClick={loadBranches}
          disabled={loading}
          className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors disabled:opacity-50"
          title="刷新分支列表"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Local branches */}
      <div>
        <button
          onClick={() => setShowLocal((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-1 text-xs text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#161b22] transition-colors"
        >
          <ChevronDown size={11} className={`transition-transform ${showLocal ? '' : '-rotate-90'}`} />
          <GitBranch size={11} />
          <span className="uppercase tracking-wide">本地分支</span>
          <span className="ml-auto text-[10px]">{branches.local.length}</span>
        </button>

        {showLocal && (
          <ul className="pb-1">
            {branches.local.map((b) => (
              <BranchRow
                key={b.name}
                branch={b}
                currentBranch={branches.current}
                onCheckout={() => handleCheckout(b.name)}
                onDelete={() => { setForceDelete(false); setShowDeleteDialog(b); }}
                onMerge={() => setShowMergeDialog(b)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Remote branches */}
      {branches.remote.length > 0 && (
        <div className="border-t border-[#30363d]">
          <button
            onClick={() => setShowRemote((v) => !v)}
            className="w-full flex items-center gap-2 px-3 py-1 text-xs text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#161b22] transition-colors"
          >
            <ChevronDown size={11} className={`transition-transform ${showRemote ? '' : '-rotate-90'}`} />
            <GitBranch size={11} />
            <span className="uppercase tracking-wide">远程分支</span>
            <span className="ml-auto text-[10px]">{branches.remote.length}</span>
          </button>

          {showRemote && (
            <ul className="pb-1">
              {branches.remote.map((r) => (
                <li key={r.name} className="flex items-center gap-2 px-3 py-1 text-xs text-[#8b949e] hover:bg-[#161b22] transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#8b949e] shrink-0" />
                  <span className="truncate flex-1">{r.name}</span>
                  <span className="font-mono text-[10px] text-[#388bfd]">{r.lastCommit}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Create Branch Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 w-80 shadow-xl">
            <h3 className="text-sm font-semibold text-[#e6edf3] mb-3 flex items-center gap-2">
              <Plus size={14} className="text-[#388bfd]" />
              新建分支
            </h3>
            <div className="space-y-2 mb-3">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="分支名称 (如 feature/my-feature)"
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-[#e6edf3] placeholder-[#8b949e] px-3 py-2 focus:outline-none focus:border-[#388bfd] transition-colors"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                autoFocus
              />
              <select
                value={newBranchBase}
                onChange={(e) => setNewBranchBase(e.target.value)}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded-lg text-xs text-[#e6edf3] px-3 py-2 focus:outline-none focus:border-[#388bfd] transition-colors"
              >
                {branches.local.map((b) => (
                  <option key={b.name} value={b.name}>{b.name}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-[#8b949e] cursor-pointer">
                <input
                  type="checkbox"
                  checked={newBranchCheckout}
                  onChange={(e) => setNewBranchCheckout(e.target.checked)}
                  className="accent-[#388bfd]"
                />
                创建后自动切换
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="text-xs text-[#8b949e] hover:text-[#e6edf3] px-3 py-1.5 rounded-lg hover:bg-[#21262d] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating || !newBranchName.trim()}
                className="text-xs bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                {isCreating ? '创建中...' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Branch Dialog */}
      {showDeleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 w-72 shadow-xl">
            <h3 className="text-sm font-semibold text-[#e6edf3] mb-2 flex items-center gap-2">
              <Trash2 size={14} className="text-[#f85149]" />
              删除分支
            </h3>
            <p className="text-xs text-[#8b949e] mb-3">
              确定要删除分支 <span className="text-[#e6edf3] font-mono">{showDeleteDialog.name}</span> 吗？
            </p>
            <label className="flex items-center gap-2 text-xs text-[#d29922] cursor-pointer mb-3">
              <input
                type="checkbox"
                checked={forceDelete}
                onChange={(e) => setForceDelete(e.target.checked)}
                className="accent-[#d29922]"
              />
              强制删除（即使有未合并的提交）
            </label>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowDeleteDialog(null); setForceDelete(false); }}
                className="text-xs text-[#8b949e] hover:text-[#e6edf3] px-3 py-1.5 rounded-lg hover:bg-[#21262d] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="text-xs bg-[#da3633] hover:bg-[#f85149] disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                {isDeleting ? '删除中...' : '删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Merge Branch Dialog */}
      {showMergeDialog && branches && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 w-72 shadow-xl">
            <h3 className="text-sm font-semibold text-[#e6edf3] mb-2 flex items-center gap-2">
              <GitMerge size={14} className="text-[#bc8cff]" />
              合并分支
            </h3>
            <p className="text-xs text-[#8b949e] mb-3">
              将{' '}
              <span className="text-[#e6edf3] font-mono">{showMergeDialog.name}</span>
              {' '}合并到{' '}
              <span className="text-[#3fb950] font-mono">{branches.current}</span>？
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowMergeDialog(null)}
                className="text-xs text-[#8b949e] hover:text-[#e6edf3] px-3 py-1.5 rounded-lg hover:bg-[#21262d] transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleMerge}
                disabled={isMerging}
                className="text-xs bg-[#bc8cff]/80 hover:bg-[#bc8cff] disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                {isMerging ? '合并中...' : '合并'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface BranchRowProps {
  branch: BranchInfo;
  currentBranch: string;
  onCheckout: () => void;
  onDelete: () => void;
  onMerge: () => void;
}

function BranchRow({ branch, currentBranch, onCheckout, onDelete, onMerge }: BranchRowProps) {
  const isCurrent = branch.name === currentBranch;
  const [hovered, setHovered] = useState(false);

  return (
    <li
      className="flex items-center gap-1.5 px-3 py-1 hover:bg-[#161b22] transition-colors group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isCurrent
        ? <span className="w-1.5 h-1.5 rounded-full bg-[#3fb950] shrink-0" />
        : <span className="w-1.5 h-1.5 rounded-full border border-[#8b949e] shrink-0" />
      }
      <button
        onClick={!isCurrent ? onCheckout : undefined}
        className={`truncate text-xs flex-1 text-left ${isCurrent ? 'text-[#3fb950] cursor-default' : 'text-[#e6edf3] hover:text-[#58a6ff] cursor-pointer'}`}
        title={branch.lastCommitMessage || branch.name}
      >
        {branch.name}
      </button>
      {branch.lastCommit && (
        <span className="font-mono text-[10px] text-[#8b949e]/50 group-hover:text-[#8b949e] shrink-0 transition-colors">
          {branch.lastCommit}
        </span>
      )}
      {hovered && !isCurrent && (
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onMerge}
            className="p-1 rounded text-[#8b949e] hover:text-[#bc8cff] hover:bg-[#21262d] transition-colors"
            title={`合并到 ${currentBranch}`}
          >
            <GitMerge size={11} />
          </button>
          <button
            onClick={onDelete}
            className="p-1 rounded text-[#8b949e] hover:text-[#f85149] hover:bg-[#21262d] transition-colors"
            title="删除分支"
          >
            <Trash2 size={11} />
          </button>
        </div>
      )}
    </li>
  );
}
