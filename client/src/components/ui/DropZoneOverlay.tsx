import { Upload } from 'lucide-react';

export default function DropZoneOverlay() {
  return (
    <div className="absolute inset-0 z-50 bg-[#0d1117]/90 backdrop-blur-sm flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#388bfd]/20 flex items-center justify-center">
          <Upload size={32} className="text-[#388bfd]" />
        </div>
        <p className="text-lg font-semibold text-[#e6edf3]">松开以上传文件</p>
        <p className="text-sm text-[#8b949e]">支持 ZIP、图片、代码文件</p>
      </div>
    </div>
  );
}
