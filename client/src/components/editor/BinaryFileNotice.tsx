import { FileX } from 'lucide-react';

interface BinaryFileNoticeProps {
  filename: string;
}

export default function BinaryFileNotice({ filename }: BinaryFileNoticeProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center max-w-xs px-6">
        <div className="w-16 h-16 bg-[#30363d]/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FileX size={28} className="text-[#6e7681]" />
        </div>
        <h3 className="text-[#e6edf3] font-semibold mb-1.5">无法预览二进制文件</h3>
        <p className="text-[#8b949e] text-sm leading-relaxed">
          <span className="font-mono text-[#e6edf3]">{filename}</span> 是二进制文件，无法在编辑器中显示。
        </p>
      </div>
    </div>
  );
}
