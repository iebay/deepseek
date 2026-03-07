import { useState, useEffect, useCallback } from 'react';
import {
  Package, RefreshCw, Plus, Trash2, ArrowUpCircle, ChevronDown, ChevronRight,
  AlertTriangle, X, Loader2,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import {
  fetchDependencies,
  installPackages,
  uninstallPackages,
  updatePackages,
  checkOutdated,
} from '../../api/npmApi';
import type { DependencyInfo, OutdatedInfo } from '../../api/npmApi';

export default function NpmPanel() {
  const { currentProject, showToast, setFileTree, toggleNpmPanel } = useAppStore();
  const root = currentProject?.path ?? '';

  const [deps, setDeps] = useState<DependencyInfo[]>([]);
  const [devDeps, setDevDeps] = useState<DependencyInfo[]>([]);
  const [outdated, setOutdated] = useState<OutdatedInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const [installInput, setInstallInput] = useState('');
  const [installDev, setInstallDev] = useState(false);

  const [showProd, setShowProd] = useState(true);
  const [showDev, setShowDev] = useState(true);
  const [showOutdated, setShowOutdated] = useState(true);

  const [confirmUninstall, setConfirmUninstall] = useState<string | null>(null);
  const [noPackageJson, setNoPackageJson] = useState(false);

  const loadData = useCallback(async () => {
    if (!root) return;
    setLoading(true);
    setNoPackageJson(false);
    try {
      const data = await fetchDependencies(root);
      setDeps(data.dependencies);
      setDevDeps(data.devDependencies);
      // Load outdated in the background
      checkOutdated(root)
        .then(list => setOutdated(list))
        .catch(() => setOutdated([]));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('package.json')) {
        setNoPackageJson(true);
      } else {
        showToast(`加载依赖失败: ${msg}`, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [root, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function refreshFileTree() {
    if (!currentProject) return;
    try {
      const { fetchFileTree } = await import('../../api/filesApi');
      const tree = await fetchFileTree(currentProject.path);
      setFileTree(tree);
    } catch (e) {
      console.warn('[NpmPanel] Failed to refresh file tree:', e);
    }
  }

  async function handleInstall() {
    const name = installInput.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      await installPackages(root, [name], installDev);
      showToast(`✅ 已安装 ${name}`, 'success');
      setInstallInput('');
      await loadData();
      await refreshFileTree();
    } catch (e) {
      showToast(`安装失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleUninstall(pkgName: string) {
    if (busy) return;
    setBusy(true);
    setConfirmUninstall(null);
    try {
      await uninstallPackages(root, [pkgName]);
      showToast(`🗑 已卸载 ${pkgName}`, 'success');
      await loadData();
      await refreshFileTree();
    } catch (e) {
      showToast(`卸载失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdate(pkgName: string) {
    if (busy) return;
    setBusy(true);
    try {
      await updatePackages(root, [pkgName]);
      showToast(`⬆ 已升级 ${pkgName}`, 'success');
      await loadData();
    } catch (e) {
      showToast(`升级失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateAll() {
    if (busy || outdated.length === 0) return;
    setBusy(true);
    try {
      await updatePackages(root, outdated.map(o => o.name));
      showToast('⬆ 已升级全部可更新依赖', 'success');
      await loadData();
    } catch (e) {
      showToast(`升级失败: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setBusy(false);
    }
  }

  function DependencyRow({ dep }: { dep: DependencyInfo }) {
    const isOutdated = outdated.find(o => o.name === dep.name);
    return (
      <div
        className="group flex items-center justify-between px-3 py-1.5 hover:bg-[#21262d] rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-[#e6edf3] truncate">{dep.name}</span>
          {isOutdated && (
            <span className="text-[10px] text-[#d29922] shrink-0">•</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] text-[#8b949e] mr-1">{dep.version}</span>
          <button
            onClick={() => handleUpdate(dep.name)}
            disabled={busy}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#8b949e] hover:text-[#388bfd] hover:bg-[#388bfd]/10 transition-all disabled:opacity-30"
            title={`升级 ${dep.name}`}
          >
            <ArrowUpCircle size={13} />
          </button>
          <button
            onClick={() => setConfirmUninstall(dep.name)}
            disabled={busy}
            className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#8b949e] hover:text-[#f85149] hover:bg-[#f85149]/10 transition-all disabled:opacity-30"
            title={`卸载 ${dep.name}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#e6edf3] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#30363d] shrink-0">
        <div className="flex items-center gap-2">
          <Package size={15} className="text-[#388bfd]" />
          <span className="text-sm font-semibold">依赖管理</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => void loadData()}
            disabled={loading || busy}
            className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors disabled:opacity-40"
            title="刷新"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={toggleNpmPanel}
            className="p-1.5 rounded-lg text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
            title="关闭"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {noPackageJson ? (
        <div className="flex flex-col items-center justify-center flex-1 gap-3 text-[#8b949e] px-4 text-center">
          <Package size={32} className="opacity-40" />
          <span className="text-sm">当前项目没有 package.json</span>
        </div>
      ) : (
        <div className="flex flex-col flex-1 overflow-y-auto gap-1 py-2">
          {/* Install input */}
          <div className="px-3 pb-2 border-b border-[#30363d] shrink-0">
            <div className="flex gap-1.5">
              <input
                type="text"
                value={installInput}
                onChange={e => setInstallInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') void handleInstall(); }}
                placeholder="搜索或安装包... (如: axios@1.7.0)"
                disabled={busy}
                className="flex-1 bg-[#21262d] border border-[#30363d] text-[#e6edf3] text-xs rounded-lg px-2.5 py-1.5 placeholder-[#484f58] focus:outline-none focus:border-[#388bfd] transition-colors disabled:opacity-50"
              />
              <button
                onClick={() => void handleInstall()}
                disabled={!installInput.trim() || busy}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-[#238636] hover:bg-[#2ea043] text-white text-xs rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                title="安装"
              >
                {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                安装
              </button>
            </div>
            <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={installDev}
                onChange={e => setInstallDev(e.target.checked)}
                className="rounded accent-[#388bfd]"
              />
              <span className="text-[11px] text-[#8b949e]">开发依赖 (devDependency)</span>
            </label>
          </div>

          {loading ? (
            <div className="flex items-center justify-center flex-1 gap-2 text-[#8b949e]">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">加载中...</span>
            </div>
          ) : (
            <>
              {/* Production dependencies */}
              <div>
                <button
                  className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
                  onClick={() => setShowProd(v => !v)}
                >
                  {showProd ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  生产依赖
                  <span className="ml-1 text-[10px] bg-[#30363d] px-1.5 py-0.5 rounded-full">
                    {deps.length}
                  </span>
                </button>
                {showProd && deps.map(dep => (
                  <DependencyRow key={dep.name} dep={dep} />
                ))}
              </div>

              {/* Dev dependencies */}
              <div>
                <button
                  className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
                  onClick={() => setShowDev(v => !v)}
                >
                  {showDev ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                  开发依赖
                  <span className="ml-1 text-[10px] bg-[#30363d] px-1.5 py-0.5 rounded-full">
                    {devDeps.length}
                  </span>
                </button>
                {showDev && devDeps.map(dep => (
                  <DependencyRow key={dep.name} dep={dep} />
                ))}
              </div>

              {/* Outdated */}
              {outdated.length > 0 && (
                <div>
                  <button
                    className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs font-medium text-[#d29922] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors"
                    onClick={() => setShowOutdated(v => !v)}
                  >
                    {showOutdated ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    <AlertTriangle size={12} />
                    可升级
                    <span className="ml-1 text-[10px] bg-[#d29922]/20 text-[#d29922] px-1.5 py-0.5 rounded-full">
                      {outdated.length}
                    </span>
                  </button>
                  {showOutdated && (
                    <>
                      {outdated.map(o => (
                        <div
                          key={o.name}
                          className="group flex items-center justify-between px-3 py-1.5 hover:bg-[#21262d] rounded-lg transition-colors"
                        >
                          <div className="min-w-0">
                            <span className="text-xs text-[#e6edf3] truncate block">{o.name}</span>
                            <span className="text-[10px] text-[#8b949e]">
                              {o.current} → <span className="text-[#3fb950]">{o.latest}</span>
                            </span>
                          </div>
                          <button
                            onClick={() => handleUpdate(o.name)}
                            disabled={busy}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded text-[#8b949e] hover:text-[#388bfd] hover:bg-[#388bfd]/10 transition-all disabled:opacity-30"
                            title={`升级 ${o.name}`}
                          >
                            <ArrowUpCircle size={13} />
                          </button>
                        </div>
                      ))}
                      <div className="px-3 pt-1">
                        <button
                          onClick={() => void handleUpdateAll()}
                          disabled={busy}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {busy ? <Loader2 size={12} className="animate-spin" /> : <ArrowUpCircle size={12} />}
                          全部升级
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Uninstall confirm dialog */}
      {confirmUninstall && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50">
          <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5 mx-4 max-w-xs w-full shadow-2xl">
            <p className="text-sm text-[#e6edf3] mb-4">
              确定要卸载 <span className="font-semibold text-[#f85149]">{confirmUninstall}</span> 吗？
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmUninstall(null)}
                className="px-3 py-1.5 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] rounded-lg transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => void handleUninstall(confirmUninstall)}
                className="px-3 py-1.5 text-xs bg-[#da3633] hover:bg-[#f85149] text-white rounded-lg transition-colors"
              >
                卸载
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
