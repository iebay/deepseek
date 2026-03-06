import { useState } from 'react';
import { FolderOpen, Loader2, AlertCircle } from 'lucide-react';
import { fetchFileTree } from '../../api/filesApi';
import { analyzeProject } from '../../api/aiApi';
import { useAppStore } from '../../store/appStore';
import { useNavigate } from 'react-router-dom';

const RECENT_PROJECTS_KEY = 'deepseek_recent_projects';

function getRecentProjects(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_PROJECTS_KEY) || '[]');
  } catch {
    return [];
  }
}

function addRecentProject(path: string) {
  const recent = getRecentProjects().filter(p => p !== path);
  recent.unshift(path);
  localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(recent.slice(0, 10)));
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
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#388bfd]/10 rounded-2xl mb-4">
            <FolderOpen size={32} className="text-[#388bfd]" />
          </div>
          <h1 className="text-2xl font-bold text-[#e6edf3] mb-2">DeepSeek Code</h1>
          <p className="text-[#8b949e]">由 AI 驱动的代码编辑平台</p>
        </div>

        <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6">
          <label className="block text-sm text-[#8b949e] mb-2">项目路径</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleOpen()}
              placeholder="例如: /home/user/my-project"
              className="flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2.5 text-sm text-[#e6edf3] placeholder-[#6e7681] focus:outline-none focus:border-[#388bfd] transition-colors"
            />
            <button
              onClick={() => handleOpen()}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#388bfd] hover:bg-[#58a6ff] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
              打开
            </button>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 text-sm text-[#f85149]">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {recentProjects.length > 0 && (
            <div className="mt-5">
              <p className="text-xs text-[#6e7681] mb-2 font-medium uppercase tracking-wider">最近项目</p>
              <div className="space-y-1">
                {recentProjects.map((p) => (
                  <button
                    key={p}
                    onClick={() => handleOpen(p)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors truncate"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
