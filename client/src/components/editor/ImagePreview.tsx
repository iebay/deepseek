import { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCw } from 'lucide-react';

interface ImagePreviewProps {
  path: string;
}

export default function ImagePreview({ path }: ImagePreviewProps) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  const imageUrl = `/api/files/raw?path=${encodeURIComponent(path)}`;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#30363d] shrink-0 bg-[#161b22]">
        <span className="text-xs text-[#8b949e]">图片预览</span>
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setZoom(z => Math.max(25, z - 25))}
            className="p-1 text-[#8b949e] hover:text-[#e6edf3] transition-colors"
            title="缩小"
          >
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-[#8b949e] min-w-[40px] text-center">{zoom}%</span>
          <button
            onClick={() => setZoom(z => Math.min(400, z + 25))}
            className="p-1 text-[#8b949e] hover:text-[#e6edf3] transition-colors"
            title="放大"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={() => setRotation(r => (r + 90) % 360)}
            className="p-1 text-[#8b949e] hover:text-[#e6edf3] transition-colors"
            title="旋转"
          >
            <RotateCw size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto flex items-center justify-center bg-[#0d1117] p-4">
        <img
          src={imageUrl}
          alt={path}
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transition: 'transform 0.2s',
            maxWidth: '100%',
            maxHeight: '100%',
          }}
          className="rounded-lg shadow-lg"
        />
      </div>
    </div>
  );
}
