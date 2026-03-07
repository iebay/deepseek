import { useState } from 'react';
import { X, FolderOpen, Loader2, AlertCircle } from 'lucide-react';
import type { Template } from '../../types';
import { createProjectFromTemplate } from '../../api/templateApi';

interface CreateProjectModalProps {
  template: Template;
  onClose: () => void;
  onCreated: (projectPath: string) => void;
}

export default function CreateProjectModal({ template, onClose, onCreated }: CreateProjectModalProps) {
  const [projectName, setProjectName] = useState('my-project');
  const [targetPath, setTargetPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate() {
    if (!projectName.trim()) { setError('请输入项目名称'); return; }
    if (!targetPath.trim()) { setError('请输入保存路径'); return; }
    setError('');
    setLoading(true);
    try {
      const { projectPath } = await createProjectFromTemplate(
        template.id,
        projectName.trim(),
        targetPath.trim()
      );
      onCreated(projectPath);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建项目失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{template.icon}</span>
            <div>
              <div className="text-sm font-semibold text-[var(--text-primary)]">基于模板创建项目</div>
              <div className="text-xs text-[var(--text-secondary)]">{template.name}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
              项目名称
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="my-project"
              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5 uppercase tracking-wider">
              保存路径
            </label>
            <input
              type="text"
              value={targetPath}
              onChange={(e) => setTargetPath(e.target.value)}
              placeholder="/home/user/projects"              className="w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors"
            />
            <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">
              项目将创建在: <code className="text-[var(--text-secondary)]">{targetPath}/{projectName}</code>
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {template.tags.map((tag) => (
              <span key={tag} className="text-[11px] px-2 py-0.5 bg-[var(--accent-bg)] text-[var(--accent-hover)] rounded-md border border-[var(--accent-border)]">
                {tag}
              </span>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-[var(--error)] bg-[var(--error-bg)] rounded-lg px-3 py-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 px-5 py-4 border-t border-[var(--border-primary)]">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] text-sm font-medium rounded-xl transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleCreate}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors"
          >
            {loading ? (
              <><Loader2 size={14} className="animate-spin" /> 创建中...</>
            ) : (
              <><FolderOpen size={14} /> 创建项目</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
