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
    success: <CheckCircle size={16} className="text-[var(--success)]" />,
    error: <XCircle size={16} className="text-[var(--error)]" />,
    info: <Info size={16} className="text-[var(--accent-primary)]" />,
  };

  const borders = {
    success: 'border-[var(--success-border)]',
    error: 'border-[var(--error-border)]',
    info: 'border-[var(--accent-border)]',
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
      <div className={`flex items-center gap-3 px-4 py-3 bg-[var(--bg-secondary)] border ${borders[toast.type]} rounded-xl shadow-2xl text-sm text-[var(--text-primary)] min-w-[200px] max-w-[420px]`}>
        {icons[toast.type]}
        <span className="flex-1">{toast.message}</span>
        <button onClick={clearToast} className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
