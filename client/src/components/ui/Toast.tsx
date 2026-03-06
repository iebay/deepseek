import { useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

export default function Toast() {
  const { toast, clearToast } = useAppStore();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(clearToast, 3500);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  const icons = {
    success: <CheckCircle size={16} className="text-[#3fb950]" />,
    error: <XCircle size={16} className="text-[#f85149]" />,
    info: <Info size={16} className="text-[#388bfd]" />,
  };

  const borders = {
    success: 'border-[#3fb950]/40',
    error: 'border-[#f85149]/40',
    info: 'border-[#388bfd]/40',
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className={`flex items-center gap-3 px-4 py-3 bg-[#161b22] border ${borders[toast.type]} rounded-xl shadow-2xl text-sm text-[#e6edf3] min-w-[200px] max-w-[420px]`}>
        {icons[toast.type]}
        <span className="flex-1">{toast.message}</span>
        <button onClick={clearToast} className="text-[#8b949e] hover:text-[#e6edf3] transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
