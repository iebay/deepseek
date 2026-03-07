import { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen, Star, Clock, Search, Plus, Trash2, Loader2,
  AlertCircle, Code2, ChevronRight, Cpu, Github, Sparkles,
  Zap, GitBranch, Layers,
} from 'lucide-react';
import { fetchProjects, toggleFavorite, removeProject, openProjectByPath, recordRecentProject } from '../../api/projectsApi';
import type { ProjectInfo } from '../../api/projectsApi';
import { fetchFileTree } from '../../api/filesApi';
import { analyzeProject } from '../../api/aiApi';
import { useAppStore } from '../../store/appStore';
import { useNavigate } from 'react-router-dom';

const APP_VERSION = '1.0.0';

const features = [
  { icon: Sparkles, label: 'AI 驱动' },
  { icon: Zap, label: '极速编码' },
  { icon: GitBranch, label: '智能分析' },
  { icon: Layers, label: '模板系统' },
];

function formatRelativeTime(timestamp: number | null): string {
  if (!timestamp) return '';
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  if (diff < 86400 * 2) return '昨天';
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} 天前`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400 / 7)} 周前`;
  return `${Math.floor(diff / 86400 / 30)} 个月前`;
}

interface ProjectCardProps {
  project: ProjectInfo;
  onOpen: (p: ProjectInfo) => void;
  onToggleFavorite: (p: ProjectInfo) => void;
  onRemove: (p: ProjectInfo) => void;
}

function ProjectCard({ project, onOpen, onToggleFavorite, onRemove }: ProjectCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      className="relative group bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-4 hover:border-[var(--accent-border)] transition-all duration-200 cursor-pointer"
      onClick={() => onOpen(project)}
      onContextMenu={(e) => { e.preventDefault(); setShowMenu(v => !v); }}
    >
      {/* Favorite button */}
      <button
        className={`absolute top-2 right-2 p-1 rounded-lg transition-all z-10 ${
          project.isFavorite
            ? 'text-[#f0b72f] opacity-100'
            : 'text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 hover:text-[#f0b72f]'
        }`}
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(project); }}
        title={project.isFavorite ? '取消收藏' : '收藏'}
      >
        <Star size={14} fill={project.isFavorite ? 'currentColor' : 'none'} />
      </button>

      {/* Icon */}
      <div className="w-10 h-10 bg-[var(--bg-tertiary)] group-hover:bg-[var(--bg-hover)] rounded-xl flex items-center justify-center mb-3 transition-colors">
        <Code2 size={18} className="text-[var(--accent-primary)]" />
      </div>

      {/* Name */}
      <div className="text-sm font-semibold text-[var(--text-primary)] truncate mb-1 pr-5">{project.name}</div>

      {/* Tech stack */}
      {project.techStack.length > 0 ? (
        <div className="flex flex-wrap gap-1 mb-2">
          {project.techStack.slice(0, 2).map(t => (
            <span key={t} className="text-[10px] text-[var(--accent-primary)] bg-[var(--accent-bg)] px-1.5 py-0.5 rounded">
              {t}
            </span>
          ))}
        </div>
      ) : (
        <div className="mb-2 h-5" />
      )}

      {/* Last opened */}
      {project.lastOpened && (
        <div className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary)]">
          <Clock size={10} />
          {formatRelativeTime(project.lastOpened)}
        </div>
      )}

      {/* Path tooltip on hover */}
      <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-20 pointer-events-none">
        <div className="bg-[var(--bg-tertiary)] border border-[var(--border-primary)] text-[10px] text-[var(--text-secondary)] px-2 py-1 rounded-lg max-w-[200px] truncate shadow-xl">
          {project.path}
        </div>
      </div>

      {/* Right-click context menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
          />
          <div className="absolute top-8 right-2 z-40 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl shadow-2xl py-1 min-w-[140px]">
            <button
              className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2 transition-colors"
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); onOpen(project); }}
            >
              <FolderOpen size={12} /> 打开项目
            </button>
            <button
              className="w-full text-left px-3 py-2 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] flex items-center gap-2 transition-colors"
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); onToggleFavorite(project); }}
            >
              <Star size={12} /> {project.isFavorite ? '取消收藏' : '收藏'}
            </button>
            <div className="h-px bg-[var(--bg-hover)] my-1" />
            <button
              className="w-full text-left px-3 py-2 text-xs text-[var(--error)] hover:bg-[var(--error-bg)] flex items-center gap-2 transition-colors"
              onClick={(e) => { e.stopPropagation(); setShowMenu(false); onRemove(project); }}
            >
              <Trash2 size={12} /> 从列表移除
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ProjectList() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [openPath, setOpenPath] = useState('');
  const [openLoading, setOpenLoading] = useState(false);
  const [openError, setOpenError] = useState('');
  const { setFileTree, setCurrentProject } = useAppStore();
  const navigate = useNavigate();

  const loadProjects = useCallback(() => {
    setLoading(true);
    setError('');
    fetchProjects()
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : '加载项目列表失败'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  async function handleOpen(project: ProjectInfo) {
    setOpenLoading(true);
    setOpenError('');
    try {
      await recordRecentProject(project.path);
      const [tree, info] = await Promise.all([
        fetchFileTree(project.path),
        analyzeProject(project.path),
      ]);
      setFileTree(tree);
      setCurrentProject(info);
      navigate('/editor');
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : '打开项目失败');
    } finally {
      setOpenLoading(false);
    }
  }

  async function handleOpenByPath() {
    const target = openPath.trim();
    if (!target) { setOpenError('请输入项目路径'); return; }
    setOpenLoading(true);
    setOpenError('');
    try {
      await openProjectByPath(target);
      const [tree, info] = await Promise.all([
        fetchFileTree(target),
        analyzeProject(target),
      ]);
      setFileTree(tree);
      setCurrentProject(info);
      navigate('/editor');
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : '打开项目失败');
    } finally {
      setOpenLoading(false);
    }
  }

  async function handleToggleFavorite(project: ProjectInfo) {
    const newFav = !project.isFavorite;
    setProjects(prev =>
      prev.map(p => p.path === project.path ? { ...p, isFavorite: newFav } : p)
    );
    try {
      await toggleFavorite(project.path, newFav);
    } catch {
      // revert
      setProjects(prev =>
        prev.map(p => p.path === project.path ? { ...p, isFavorite: !newFav } : p)
      );
    }
  }

  async function handleRemove(project: ProjectInfo) {
    setProjects(prev => prev.filter(p => p.path !== project.path));
    try {
      await removeProject(project.path);
    } catch {
      // restore
      setProjects(prev => [...prev, project]);
    }
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const favorites = filtered.filter(p => p.isFavorite);
  const recent = filtered
    .filter(p => !p.isFavorite && p.lastOpened)
    .sort((a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0))
    .slice(0, 6);
  const all = filtered.filter(p => !p.isFavorite);

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-start p-4 pt-10 relative overflow-auto">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--accent-bg)] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--success-solid)]/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#8957e5]/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-4xl relative">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[var(--accent-bg-heavy)] to-[var(--accent-bg)] rounded-2xl mb-4 border border-[var(--accent-border)]">
            <Cpu size={28} className="text-[var(--accent-primary)]" />
          </div>
          <h1 className="text-4xl font-bold mb-2 tracking-tight">
            <span className="bg-gradient-to-r from-[var(--text-primary)] via-[var(--accent-hover)] to-[#388bfd] bg-clip-text text-transparent">
              DeepSeek Code
            </span>
          </h1>
          <p className="text-[var(--text-secondary)]">AI 驱动的智能代码编辑平台</p>
          <div className="flex items-center justify-center gap-5 mt-4">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
                <Icon size={13} className="text-[var(--accent-primary)]" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-6">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索项目..."
            className="w-full bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl pl-10 pr-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-[var(--text-secondary)]">
            <Loader2 size={20} className="animate-spin mr-2" />
            加载项目列表...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-sm text-[var(--error)] bg-[var(--error-bg)] rounded-xl px-4 py-3 mb-6">
            <AlertCircle size={14} />
            {error}
            <button
              onClick={loadProjects}
              className="ml-auto text-xs underline hover:no-underline"
            >
              重试
            </button>
          </div>
        ) : (
          <>
            {/* Favorites */}
            {favorites.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Star size={14} className="text-[#f0b72f]" fill="currentColor" />
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">收藏项目</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {favorites.map(p => (
                    <ProjectCard
                      key={p.path}
                      project={p}
                      onOpen={handleOpen}
                      onToggleFavorite={handleToggleFavorite}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Recent */}
            {recent.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Clock size={14} className="text-[var(--text-secondary)]" />
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">最近项目</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {recent.map(p => (
                    <ProjectCard
                      key={p.path}
                      project={p}
                      onOpen={handleOpen}
                      onToggleFavorite={handleToggleFavorite}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* All projects */}
            {all.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen size={14} className="text-[var(--text-secondary)]" />
                  <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">所有项目</span>
                  <span className="text-xs text-[var(--text-tertiary)]">({all.length})</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {all.map(p => (
                    <ProjectCard
                      key={p.path}
                      project={p}
                      onOpen={handleOpen}
                      onToggleFavorite={handleToggleFavorite}
                      onRemove={handleRemove}
                    />
                  ))}
                </div>
              </section>
            )}

            {filtered.length === 0 && !loading && (
              <div className="text-center py-16 text-[var(--text-tertiary)]">
                <FolderOpen size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  {search ? `没有找到匹配 "${search}" 的项目` : '暂无项目，请打开一个项目目录'}
                </p>
              </div>
            )}
          </>
        )}

        {/* Open by path */}
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl p-4 shadow-xl mt-2">
          <div className="flex items-center gap-2 mb-3">
            <Plus size={14} className="text-[var(--text-secondary)]" />
            <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-widest">打开其他项目</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={openPath}
              onChange={(e) => setOpenPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleOpenByPath()}
              placeholder="输入项目路径，例如: /home/user/my-project"
              className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
            />
            <button
              onClick={handleOpenByPath}
              disabled={openLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
            >
              {openLoading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              打开
            </button>
          </div>
          {openError && (
            <div className="mt-3 flex items-center gap-2 text-sm text-[var(--error)] bg-[var(--error-bg)] rounded-lg px-3 py-2">
              <AlertCircle size={14} />
              {openError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-[var(--text-tertiary)]">
          <a
            href="https://github.com/iebay/deepseek"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors"
          >
            <Github size={12} />
            GitHub
          </a>
          <span>·</span>
          <span>v{APP_VERSION}</span>
          <span>·</span>
          <span>DeepSeek Code Platform</span>
        </div>
      </div>
    </div>
  );
}
