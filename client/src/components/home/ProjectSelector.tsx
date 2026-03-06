import { useState } from 'react';
import { FolderOpen, Loader2, AlertCircle, Clock, Code2, Cpu, ChevronRight, Github } from 'lucide-react';
import { fetchFileTree } from '../../api/filesApi';
import { analyzeProject } from '../../api/aiApi';
import { useAppStore } from '../../store/appStore';
import { useNavigate } from 'react-router-dom';

const RECENT_PROJECTS_KEY = 'deepseek_recent_projects';

interface RecentProject {
  path: string;
  name: string;
  lastOpened: string;
}

function getRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem(RECENT_PROJECTS_KEY) || '[]';
    const parsed = JSON.parse(raw);
    // Support both old format (string[]) and new format (RecentProject[])
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

export default function ProjectSelector() {
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setFileTree, setCurrentProject } = useAppStore();
  const navigate = useNavigate();
  const recentProjects = getRecentProjects();

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

  return (
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[#388bfd]/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-[#238636]/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-xl relative">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#388bfd]/20 to-[#388bfd]/5 rounded-2xl mb-4 border border-[#388bfd]/20">
            <Cpu size={28} className="text-[#388bfd]" />
          </div>
          <h1 className="text-3xl font-bold text-[#e6edf3] mb-2 tracking-tight">
            DeepSeek <span className="text-[#388bfd]">Code</span>
          </h1>
          <p className="text-[#8b949e]">由 AI 驱动的智能代码编辑平台</p>
        </div>

        {/* Open project card */}
        <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-6 shadow-xl mb-4">
          <div className="flex items-center gap-2 mb-4">
            <FolderOpen size={16} className="text-[#388bfd]" />
            <span className="text-sm font-semibold text-[#e6edf3]">打开项目</span>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleOpen()}
              placeholder="输入项目路径，例如: /home/user/my-project"
              className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-2.5 text-sm text-[#e6edf3] placeholder-[#6e7681] focus:outline-none focus:border-[#388bfd] transition-colors"
            />
            <button
              onClick={() => handleOpen()}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#388bfd] hover:bg-[#58a6ff] disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors shrink-0"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
              打开
            </button>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-[#f85149] bg-[#f85149]/10 rounded-lg px-3 py-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Recent projects */}
        {recentProjects.length > 0 && (
          <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-3 px-1">
              <Clock size={13} className="text-[#8b949e]" />
              <span className="text-xs text-[#8b949e] font-semibold uppercase tracking-widest">最近项目</span>
            </div>
            <div className="space-y-1">
              {recentProjects.map((project) => (
                <button
                  key={project.path}
                  onClick={() => handleOpen(project.path)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#21262d] transition-colors group text-left"
                >
                  <div className="w-8 h-8 bg-[#21262d] group-hover:bg-[#30363d] rounded-lg flex items-center justify-center shrink-0 transition-colors">
                    <Code2 size={14} className="text-[#388bfd]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#e6edf3] font-medium truncate">
                      {project.name || project.path.split('/').pop()}
                    </div>
                    <div className="text-xs text-[#6e7681] truncate">{project.path}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {project.lastOpened && (
                      <span className="text-[10px] text-[#6e7681]">{formatLastOpened(project.lastOpened)}</span>
                    )}
                    <ChevronRight size={13} className="text-[#6e7681] opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-[#6e7681]">
          <a
            href="https://github.com/iebay/deepseek"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-[#e6edf3] transition-colors"
          >
            <Github size={12} />
            GitHub
          </a>
          <span>·</span>
          <span>DeepSeek Code Platform</span>
        </div>
      </div>
    </div>
  );
}
