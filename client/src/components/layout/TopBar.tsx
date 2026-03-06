import { Cpu, Home, Eye, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/appStore';

const MODELS = [
  { value: 'deepseek-chat', label: 'DeepSeek Chat (快速)' },
  { value: 'deepseek-reasoner', label: 'DeepSeek Reasoner (深度)' },
];

export default function TopBar() {
  const navigate = useNavigate();
  const { currentProject, selectedModel, setSelectedModel, togglePreview, showPreview } = useAppStore();

  return (
    <header className="h-12 bg-[#161b22] border-b border-[#30363d] flex items-center px-4 gap-3 shrink-0">
      <div className="flex items-center gap-2">
        <Cpu size={18} className="text-[#388bfd]" />
        <span className="text-sm font-semibold text-[#e6edf3]">DeepSeek</span>
      </div>
      <div className="h-4 w-px bg-[#30363d]" />
      {currentProject && (
        <span className="text-sm text-[#8b949e] truncate max-w-xs">{currentProject.name}</span>
      )}
      <div className="flex-1" />
      <select
        value={selectedModel}
        onChange={e => setSelectedModel(e.target.value)}
        className="bg-[#21262d] border border-[#30363d] text-[#e6edf3] text-xs rounded px-2 py-1 focus:outline-none focus:border-[#388bfd]"
      >
        {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
      </select>
      <button
        onClick={togglePreview}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded transition-colors ${showPreview ? 'bg-[#388bfd]/20 text-[#388bfd]' : 'text-[#8b949e] hover:text-[#e6edf3]'}`}
      >
        <Eye size={14} /> 预览
      </button>
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#e6edf3] px-3 py-1.5 rounded transition-colors"
      >
        <Home size={14} /> 首页
      </button>
    </header>
  );
}
