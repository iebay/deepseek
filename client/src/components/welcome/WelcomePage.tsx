import { useState, useEffect, useCallback } from 'react';
import { FolderOpen, Plus, GitBranch, Clock, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { fetchProjects, openProjectByPath, recordRecentProject } from '../../api/projectsApi';
import type { ProjectInfo } from '../../api/projectsApi';
import { fetchFileTree } from '../../api/filesApi';
import { analyzeProject } from '../../api/aiApi';
import { fetchTemplates, createProjectFromTemplate } from '../../api/templateApi';
import { cloneRepo } from '../../api/gitApi';
import type { Template } from '../../types';

type ActivePanel = 'open' | 'template' | 'clone' | null;

export default function WelcomePage() {
  const { setFileTree, setCurrentProject } = useAppStore();

  const [activePanel, setActivePanel] = useState<ActivePanel>(null);
  const [recentProjects, setRecentProjects] = useState<ProjectInfo[]>([]);
  const [recentLoading, setRecentLoading] = useState(true);

  // Open project panel state
  const [openPath, setOpenPath] = useState('');
  const [openLoading, setOpenLoading] = useState(false);
  const [openError, setOpenError] = useState('');

  // Template panel state
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [projectName, setProjectName] = useState('');
  const [targetPath, setTargetPath] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // Clone panel state
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloneTarget, setCloneTarget] = useState('');
  const [cloneLoading, setCloneLoading] = useState(false);
  const [cloneError, setCloneError] = useState('');

  const loadRecentProjects = useCallback(() => {
    setRecentLoading(true);
    fetchProjects()
      .then((projects) => {
        const sorted = [...projects]
          .filter((p) => p.lastOpened !== null)
          .sort((a, b) => (b.lastOpened ?? 0) - (a.lastOpened ?? 0))
          .slice(0, 5);
        setRecentProjects(sorted);
      })
      .catch(() => setRecentProjects([]))
      .finally(() => setRecentLoading(false));
  }, []);

  useEffect(() => {
    loadRecentProjects();
  }, [loadRecentProjects]);

  useEffect(() => {
    if (activePanel === 'template' && templates.length === 0 && !templatesLoading) {
      setTemplatesLoading(true);
      setTemplatesError('');
      fetchTemplates()
        .then(setTemplates)
        .catch(() => setTemplatesError('加载模板列表失败'))
        .finally(() => setTemplatesLoading(false));
    }
  }, [activePanel, templates.length, templatesLoading]);

  async function openProject(projectPath: string) {
    setOpenLoading(true);
    setOpenError('');
    try {
      await recordRecentProject(projectPath);
      const [tree, info] = await Promise.all([
        fetchFileTree(projectPath),
        analyzeProject(projectPath),
      ]);
      setFileTree(tree);
      setCurrentProject(info);
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
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : '打开项目失败');
    } finally {
      setOpenLoading(false);
    }
  }

  async function handleCreateFromTemplate() {
    if (!selectedTemplate) { setCreateError('请选择模板'); return; }
    const name = projectName.trim();
    const target = targetPath.trim();
    if (!name) { setCreateError('请输入项目名称'); return; }
    if (!target) { setCreateError('请输入目标路径'); return; }
    setCreateLoading(true);
    setCreateError('');
    try {
      const result = await createProjectFromTemplate(selectedTemplate.id, name, target);
      const [tree, info] = await Promise.all([
        fetchFileTree(result.projectPath),
        analyzeProject(result.projectPath),
      ]);
      setFileTree(tree);
      setCurrentProject(info);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : '创建项目失败');
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleClone() {
    const url = cloneUrl.trim();
    const target = cloneTarget.trim();
    if (!url) { setCloneError('请输入仓库 URL'); return; }
    if (!target) { setCloneError('请输入克隆目标路径'); return; }
    setCloneLoading(true);
    setCloneError('');
    try {
      const result = await cloneRepo(url, target);
      const [tree, info] = await Promise.all([
        fetchFileTree(result.path),
        analyzeProject(result.path),
      ]);
      setFileTree(tree);
      setCurrentProject(info);
    } catch (e) {
      setCloneError(e instanceof Error ? e.message : '克隆失败');
    } finally {
      setCloneLoading(false);
    }
  }

  function togglePanel(panel: ActivePanel) {
    setActivePanel((prev) => (prev === panel ? null : panel));
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <div className="flex-1 flex flex-col items-center justify-center px-8 py-12 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="w-16 h-16 bg-[var(--accent-bg)] rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg viewBox="0 0 24 24" className="w-8 h-8 text-[var(--accent-primary)]" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-1">欢迎使用 DeepSeek Code</h1>
          <p className="text-[var(--text-secondary)] text-sm">打开或创建一个项目开始编码</p>
        </div>

        {/* Quick Actions */}
        <div className="w-full space-y-2 mb-8">
          {/* Open Project */}
          <div className="rounded-lg border border-[var(--border-primary)] overflow-hidden">
            <button
              onClick={() => togglePanel('open')}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-left"
            >
              <div className="w-8 h-8 bg-[var(--accent-bg)] rounded-lg flex items-center justify-center shrink-0">
                <FolderOpen size={16} className="text-[var(--accent-primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)]">打开项目</div>
                <div className="text-xs text-[var(--text-secondary)]">输入本地路径打开已有项目</div>
              </div>
              <ChevronRight
                size={16}
                className={`text-[var(--text-tertiary)] transition-transform ${activePanel === 'open' ? 'rotate-90' : ''}`}
              />
            </button>
            {activePanel === 'open' && (
              <div className="px-4 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-primary)]">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={openPath}
                    onChange={(e) => setOpenPath(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleOpenByPath()}
                    placeholder="/path/to/your/project"
                    className="flex-1 px-3 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                  <button
                    onClick={handleOpenByPath}
                    disabled={openLoading}
                    className="px-3 py-1.5 text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded transition-colors disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {openLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                    打开
                  </button>
                </div>
                {openError && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--error)]">
                    <AlertCircle size={12} />
                    {openError}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Create from Template */}
          <div className="rounded-lg border border-[var(--border-primary)] overflow-hidden">
            <button
              onClick={() => togglePanel('template')}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-left"
            >
              <div className="w-8 h-8 bg-[var(--accent-bg)] rounded-lg flex items-center justify-center shrink-0">
                <Plus size={16} className="text-[var(--accent-primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)]">从模板新建</div>
                <div className="text-xs text-[var(--text-secondary)]">选择模板快速创建新项目</div>
              </div>
              <ChevronRight
                size={16}
                className={`text-[var(--text-tertiary)] transition-transform ${activePanel === 'template' ? 'rotate-90' : ''}`}
              />
            </button>
            {activePanel === 'template' && (
              <div className="px-4 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] space-y-3">
                {templatesLoading ? (
                  <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                    <Loader2 size={14} className="animate-spin" />
                    加载模板中...
                  </div>
                ) : templatesError ? (
                  <div className="flex items-center gap-1.5 text-xs text-[var(--error)]">
                    <AlertCircle size={12} />
                    {templatesError}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-1.5">
                      {templates.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setSelectedTemplate(selectedTemplate?.id === t.id ? null : t)}
                          className={`flex items-center gap-2 px-3 py-2 rounded text-left text-sm transition-colors border ${
                            selectedTemplate?.id === t.id
                              ? 'border-[var(--accent-primary)] bg-[var(--accent-bg)] text-[var(--accent-primary)]'
                              : 'border-[var(--border-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                          }`}
                        >
                          <span className="text-base leading-none">{t.icon}</span>
                          <span className="truncate font-medium">{t.name}</span>
                        </button>
                      ))}
                    </div>
                    {selectedTemplate && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={projectName}
                          onChange={(e) => setProjectName(e.target.value)}
                          placeholder="项目名称"
                          className="w-full px-3 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                        />
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={targetPath}
                            onChange={(e) => setTargetPath(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateFromTemplate()}
                            placeholder="目标目录路径（如 /home/user/projects）"
                            className="flex-1 px-3 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                          />
                          <button
                            onClick={handleCreateFromTemplate}
                            disabled={createLoading}
                            className="px-3 py-1.5 text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded transition-colors disabled:opacity-60 flex items-center gap-1.5 whitespace-nowrap"
                          >
                            {createLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                            创建
                          </button>
                        </div>
                      </div>
                    )}
                    {createError && (
                      <div className="flex items-center gap-1.5 text-xs text-[var(--error)]">
                        <AlertCircle size={12} />
                        {createError}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Clone Repository */}
          <div className="rounded-lg border border-[var(--border-primary)] overflow-hidden">
            <button
              onClick={() => togglePanel('clone')}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors text-left"
            >
              <div className="w-8 h-8 bg-[var(--accent-bg)] rounded-lg flex items-center justify-center shrink-0">
                <GitBranch size={16} className="text-[var(--accent-primary)]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-[var(--text-primary)]">克隆仓库</div>
                <div className="text-xs text-[var(--text-secondary)]">从 Git URL 克隆远程仓库</div>
              </div>
              <ChevronRight
                size={16}
                className={`text-[var(--text-tertiary)] transition-transform ${activePanel === 'clone' ? 'rotate-90' : ''}`}
              />
            </button>
            {activePanel === 'clone' && (
              <div className="px-4 py-3 border-t border-[var(--border-primary)] bg-[var(--bg-primary)] space-y-2">
                <input
                  type="text"
                  value={cloneUrl}
                  onChange={(e) => setCloneUrl(e.target.value)}
                  placeholder="https://github.com/user/repo.git"
                  className="w-full px-3 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={cloneTarget}
                    onChange={(e) => setCloneTarget(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleClone()}
                    placeholder="目标目录路径"
                    className="flex-1 px-3 py-1.5 text-sm bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)]"
                  />
                  <button
                    onClick={handleClone}
                    disabled={cloneLoading}
                    className="px-3 py-1.5 text-sm bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white rounded transition-colors disabled:opacity-60 flex items-center gap-1.5"
                  >
                    {cloneLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                    克隆
                  </button>
                </div>
                {cloneError && (
                  <div className="flex items-center gap-1.5 text-xs text-[var(--error)]">
                    <AlertCircle size={12} />
                    {cloneError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Recent Projects */}
        <div className="w-full">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-[var(--text-secondary)]" />
            <span className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">最近项目</span>
          </div>
          {recentLoading ? (
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] py-2">
              <Loader2 size={14} className="animate-spin" />
              加载中...
            </div>
          ) : recentProjects.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)] py-2">暂无最近项目</p>
          ) : (
            <div className="space-y-1">
              {recentProjects.map((project) => (
                <button
                  key={project.path}
                  onClick={() => openProject(project.path)}
                  disabled={openLoading}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors text-left group disabled:opacity-60"
                >
                  <FolderOpen size={14} className="text-[var(--text-tertiary)] shrink-0 group-hover:text-[var(--accent-primary)]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">{project.name}</div>
                    <div className="text-xs text-[var(--text-tertiary)] truncate">{project.path}</div>
                  </div>
                  {project.lastOpened && (
                    <span className="text-xs text-[var(--text-tertiary)] shrink-0">
                      {new Date(project.lastOpened).toLocaleDateString('zh-CN')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
