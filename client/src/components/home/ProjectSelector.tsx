import { useState, useEffect } from 'react';
import { FolderOpen, Loader2, AlertCircle, Clock, Code2, Cpu, ChevronRight, Github, Plus, Trash2, Sparkles, Zap, GitBranch, Layers, Download } from 'lucide-react';
import { fetchFileTree } from '../../api/filesApi';
import { analyzeProject } from '../../api/aiApi';
import { fetchTemplates } from '../../api/templateApi';
import { cloneRepo } from '../../api/gitApi';
import { useAppStore } from '../../store/appStore';
import { useNavigate } from 'react-router-dom';
import type { Template } from '../../types';
import TemplateGrid from './TemplateGrid';
import CreateProjectModal from './CreateProjectModal';

const RECENT_PROJECTS_KEY = 'deepseek_recent_projects';
const APP_VERSION = '1.0.0';

interface RecentProject {
  path: string;
  name: string;
  lastOpened: string;
}

function getRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY) || '[]';
    const parsed = JSON.parse(raw);
    return parsed.map((item: string | RecentProject) =>
      typeof item === 'string'
        ? { path: item, name: item.split('/').pop() || item, lastOpened: '' }
        : item
    );
  } catch {
    return [];
  }
}

function addRecentProject(path: string) {
  const recent = getRecentProjects().filter(p => p.path !== path);
  const name = path.split('/').pop() || path;
  recent.unshift({ path, name, lastOpened: new Date().toISOString() });
  localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(recent.slice(0, 10)));
}

function removeRecentProject(path: string) {
  const recent = getRecentProjects().filter(p => p.path !== path);
  localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(recent));
}

function formatLastOpened(iso: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diff < 60) return '刚刚';
  if (diff < 3600) return `${Math.floor(diff / 60)} 分钟前`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} 小时前`;
  return `${Math.floor(diff / 86400)} 天前`;
}

const features = [
  { icon: Sparkles, label: 'AI 驱动' },
  { icon: Zap, label: '极速编码' },
  { icon: GitBranch, label: '智能分析' },
  { icon: Layers, label: '模板系统' },
];

export default function ProjectSelector() {
  const [tab, setTab] = useState<'open' | 'clone' | 'new'>('open');
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>(getRecentProjects);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneTarget, setCloneTarget] = useState('');
  const { setFileTree, setCurrentProject } = useAppStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (tab === 'new' && templates.length === 0) {
      setTemplatesLoading(true);
      setTemplatesError('');
      fetchTemplates()
        .then(setTemplates)
        .catch((err) => {
          console.error('加载模板失败:', err);
          setTemplatesError('加载模板失败，请确认服务已启动');
        })
        .finally(() => setTemplatesLoading(false));
    }
  }, [tab, templates.length]);

  async function handleClone() {
    const url = cloneUrl.trim();
    const target = cloneTarget.trim();
    if (!url) { setError('请输入 GitHub 仓库 URL'); return; }
    if (!target) { setError('请输入克隆目标路径'); return; }
    setError('');
    setLoading(true);
    try {
      const result = await cloneRepo(url, target);
      const [tree, info] = await Promise.all([
        fetchFileTree(result.path),
        analyzeProject(result.path),
      ]);
      setFileTree(tree);
      setCurrentProject(info);
      addRecentProject(result.path);
      navigate('/editor');
    } catch (e) {
      setError(e instanceof Error ? e.message : '克隆失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleOpen(projectPath?: string) {
    const target = (projectPath || path).trim();
    if (!target) {
      setError('请输入项目路径');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const [tree, info] = await Promise.all([
        fetchFileTree(target),
        analyzeProject(target),
      ]);
      setFileTree(tree);
      setCurrentProject(info);
      addRecentProject(target);
      navigate('/editor');
    } catch (e) {
      setError(e instanceof Error ? e.message : '打开项目失败');
    } finally {
      setLoading(false);
    }
  }

  function handleRemoveRecent(e: React.MouseEvent, projectPath: string) {
    e.stopPropagation();
    removeRecentProject(projectPath);
    setRecentProjects(getRecentProjects());
  }

  async function handleProjectCreated(projectPath: string) {
    setSelectedTemplate(null);
    setLoading(true);
    try {
      const [tree, info] = await Promise.all([
        fetchFileTree(projectPath),
        analyzeProject(projectPath),
      ]);
      setFileTree(tree);
      setCurrentProject(info);
      addRecentProject(projectPath);
      navigate('/editor');
    } catch (e) {
      setError(e instanceof Error ? e.message : '打开新项目失败');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col items-center justify-start p-4 pt-12 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[var(--accent-bg)] rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#238636]/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-[#8957e5]/3 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-2xl relative">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#388bfd]/20 to-[#388bfd]/5 rounded-2xl mb-4 border border-[var(--accent-bg)]">
            <Cpu size={28} className="text-[var(--accent-primary)]" />
          </div>
          <h1 className="text-4xl font-bold mb-2 tracking-tight">
            <span className="bg-gradient-to-r from-[#e6edf3] via-[#58a6ff] to-[#388bfd] bg-clip-text text-transparent">
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

        {/* Tab switcher */}
        <div className="flex gap-1 bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl p-1 mb-4">
          <button
            onClick={() => { setTab('open'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'open'
                ? 'bg-[var(--accent-primary)] text-white shadow-lg shadow-[#388bfd]/20'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <FolderOpen size={15} />
            打开项目
          </button>
          <button
            onClick={() => { setTab('clone'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'clone'
                ? 'bg-[var(--accent-primary)] text-white shadow-lg shadow-[#388bfd]/20'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Download size={15} />
            克隆仓库
          </button>
          <button
            onClick={() => { setTab('new'); setError(''); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'new'
                ? 'bg-[var(--accent-primary)] text-white shadow-lg shadow-[#388bfd]/20'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Plus size={15} />
            新建项目
          </button>
        </div>

        {/* Tab content */}
        {tab === 'open' ? (
          <div className="space-y-4">
            {/* Open project card */}
            <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl p-5 shadow-xl">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleOpen()}
                  placeholder="输入项目路径，例如: /home/user/my-project"
                  className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
                />
                <button
                  onClick={() => handleOpen()}
                  disabled={loading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
                  打开
                </button>
              </div>

              {error && (
                <div className="mt-3 flex items-center gap-2 text-sm text-[var(--error)] bg-[var(--error-bg)] rounded-lg px-3 py-2">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}
            </div>

            {/* Recent projects */}
            {recentProjects.length > 0 && (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Clock size={13} className="text-[var(--text-secondary)]" />
                  <span className="text-xs text-[var(--text-secondary)] font-semibold uppercase tracking-widest">最近项目</span>
                </div>
                <div className="grid grid-cols-1 gap-1">
                  {recentProjects.map((project) => (
                    <div
                      key={project.path}
                      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--bg-hover)] transition-colors"
                      title={project.path}
                    >
                      <button
                        className="flex items-center gap-3 flex-1 min-w-0 text-left"
                        onClick={() => handleOpen(project.path)}
                      >
                        <div className="w-9 h-9 bg-[var(--bg-tertiary)] group-hover:bg-[var(--bg-hover)] rounded-xl flex items-center justify-center shrink-0 transition-colors">
                          <Code2 size={15} className="text-[var(--accent-primary)]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-[var(--text-primary)] font-medium truncate">
                            {project.name || project.path.split('/').pop()}
                          </div>
                          <div className="text-xs text-[var(--text-tertiary)] truncate">{project.path}</div>
                        </div>
                      </button>
                      <div className="flex items-center gap-2 shrink-0">
                        {project.lastOpened && (
                          <span className="text-[10px] text-[var(--text-tertiary)]">{formatLastOpened(project.lastOpened)}</span>
                        )}
                        <button
                          onClick={(e) => handleRemoveRecent(e, project.path)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--error)] hover:bg-[var(--error)]/10 transition-all"
                          title="从列表移除"
                        >
                          <Trash2 size={12} />
                        </button>
                        <ChevronRight size={13} className="text-[var(--text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : tab === 'clone' ? (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl p-5 shadow-xl space-y-3">
            <p className="text-xs text-[var(--text-secondary)] px-1">从 GitHub 克隆仓库到本地目录</p>
            <input
              type="text"
              value={cloneUrl}
              onChange={(e) => setCloneUrl(e.target.value)}
              placeholder="仓库 URL，例如: https://github.com/user/repo.git"
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
            />
            <div className="flex gap-2">
              <input
                type="text"
                value={cloneTarget}
                onChange={(e) => setCloneTarget(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleClone()}
                placeholder="克隆目标路径，例如: /home/user/my-project"
                className="flex-1 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
              />
              <button
                onClick={handleClone}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2.5 bg-[#238636] hover:bg-[#2ea043] disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                克隆
              </button>
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-[var(--error)] bg-[var(--error-bg)] rounded-lg px-3 py-2">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl p-4 shadow-xl">
            <p className="text-xs text-[var(--text-secondary)] mb-3 px-1">选择一个模板快速开始</p>
            {templatesError ? (
              <div className="flex items-center gap-2 text-sm text-[var(--error)] bg-[var(--error-bg)] rounded-lg px-3 py-3">
                <AlertCircle size={14} />
                {templatesError}
              </div>
            ) : (
              <TemplateGrid
                templates={templates}
                loading={templatesLoading}
                onSelect={setSelectedTemplate}
              />
            )}
          </div>
        )}

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

      {/* Create project modal */}
      {selectedTemplate && (
        <CreateProjectModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onCreated={handleProjectCreated}
        />
      )}
    </div>
  );
}
