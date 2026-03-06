import { useRef, useEffect, useState } from 'react';
import { RefreshCw, ExternalLink } from 'lucide-react';

interface LivePreviewProps {
  url?: string;
  srcDoc?: string;
}

export default function LivePreview({ url, srcDoc }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (srcDoc && iframeRef.current) {
      iframeRef.current.srcdoc = srcDoc;
    }
  }, [srcDoc]);

  function refresh() {
    setKey(k => k + 1);
  }

  const previewUrl = url || 'http://localhost:5173';

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#30363d] shrink-0">
        <span className="text-xs text-[#8b949e] flex-1 truncate">{previewUrl}</span>
        <button
          onClick={refresh}
          className="text-[#6e7681] hover:text-[#e6edf3] transition-colors"
          title="刷新"
        >
          <RefreshCw size={14} />
        </button>
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#6e7681] hover:text-[#e6edf3] transition-colors"
          title="在新标签页打开"
        >
          <ExternalLink size={14} />
        </a>
      </div>
      <div className="flex-1 bg-white">
        {srcDoc ? (
          <iframe
            key={key}
            ref={iframeRef}
            srcDoc={srcDoc}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title="Live Preview"
          />
        ) : (
          <iframe
            key={key}
            ref={iframeRef}
            src={previewUrl}
            className="w-full h-full border-0"
            title="Live Preview"
          />
        )}
      </div>
    </div>
  );
}
