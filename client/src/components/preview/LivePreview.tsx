import { useRef, useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, Monitor, Tablet, Smartphone, Globe } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

interface LivePreviewProps {
  srcDoc?: string;
}

const DEVICE_SIZES = [
  { label: '桌面', icon: Monitor, width: '100%' },
  { label: '平板', icon: Tablet, width: '768px' },
  { label: '手机', icon: Smartphone, width: '375px' },
] as const;

export default function LivePreview({ srcDoc }: LivePreviewProps) {
  const { previewUrl, setPreviewUrl } = useAppStore();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [inputValue, setInputValue] = useState(previewUrl);
  const [deviceIdx, setDeviceIdx] = useState(0);
  const [key, setKey] = useState(0);

  // Keep input in sync when store changes externally
  useEffect(() => {
    setInputValue(previewUrl);
  }, [previewUrl]);

  function handleLoad() {
    const trimmed = inputValue.trim();
    const normalized =
      trimmed && !trimmed.match(/^https?:\/\//i) ? `http://${trimmed}` : trimmed;
    setPreviewUrl(normalized);
    setKey((k) => k + 1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleLoad();
  }

  function refresh() {
    setKey((k) => k + 1);
  }

  const hasSrcDoc = Boolean(srcDoc);
  const hasUrl = Boolean(previewUrl);
  const deviceWidth = DEVICE_SIZES[deviceIdx].width;

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* URL input row */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#30363d] shrink-0">
        <div className="flex flex-1 items-center gap-1 bg-[#161b22] border border-[#30363d] rounded-md px-2 min-w-0">
          <Globe size={12} className="text-[#6e7681] shrink-0" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入项目 dev server 地址，如 http://localhost:3000"
            className="flex-1 bg-transparent text-xs text-[#e6edf3] placeholder-[#484f58] outline-none py-1 min-w-0"
          />
        </div>
        <button
          onClick={handleLoad}
          className="shrink-0 px-2 py-1 text-xs bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] rounded-md border border-[#30363d] transition-colors"
        >
          加载
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-[#30363d] shrink-0">
        <span className="text-xs text-[#8b949e] flex-1 truncate">
          {hasSrcDoc ? 'HTML 文件预览' : previewUrl || '未设置预览地址'}
        </span>
        {/* Device size buttons */}
        <div className="flex items-center gap-0.5 mr-1">
          {DEVICE_SIZES.map((d, i) => {
            const Icon = d.icon;
            return (
              <button
                key={d.label}
                onClick={() => setDeviceIdx(i)}
                title={`${d.label}（${d.width}）`}
                className={`p-1 rounded transition-colors ${
                  deviceIdx === i
                    ? 'text-[#388bfd] bg-[#388bfd]/10'
                    : 'text-[#6e7681] hover:text-[#e6edf3] hover:bg-[#21262d]'
                }`}
              >
                <Icon size={13} />
              </button>
            );
          })}
        </div>
        <button
          onClick={refresh}
          disabled={!hasUrl && !hasSrcDoc}
          className="text-[#6e7681] hover:text-[#e6edf3] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          title="刷新"
        >
          <RefreshCw size={13} />
        </button>
        {hasUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#6e7681] hover:text-[#e6edf3] transition-colors"
            title="在新标签页打开"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-auto flex justify-center bg-[#161b22]">
        {hasSrcDoc ? (
          <iframe
            key={key}
            ref={iframeRef}
            srcDoc={srcDoc}
            style={{ width: deviceWidth, maxWidth: '100%' }}
            className="h-full border-0 bg-white"
            sandbox="allow-scripts allow-same-origin"
            title="Live Preview"
          />
        ) : hasUrl ? (
          <iframe
            key={key}
            ref={iframeRef}
            src={previewUrl}
            style={{ width: deviceWidth, maxWidth: '100%' }}
            className="h-full border-0 bg-white"
            title="Live Preview"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
            <Globe size={40} className="text-[#30363d]" />
            <div className="space-y-1">
              <p className="text-sm text-[#8b949e] font-medium">暂无预览内容</p>
              <p className="text-xs text-[#484f58] leading-relaxed">
                在上方输入项目的 dev server 地址（如{' '}
                <code className="text-[#6e7681]">http://localhost:3000</code>
                ）即可加载外部预览
              </p>
              <p className="text-xs text-[#484f58]">或打开一个 HTML 文件自动预览其内容</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
