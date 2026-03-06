import { useState, useRef } from 'react';
import { FileArchive, Upload, Loader2, Check, X } from 'lucide-react';
import { uploadZip } from '../../api/filesApi';

interface ZipUploadProps {
  targetDir: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function ZipUpload({ targetDir, onSuccess, onClose }: ZipUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await uploadZip(file, targetDir);
      setResult(res);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 shadow-xl mx-4 max-w-sm w-full">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FileArchive size={16} className="text-[#d29922]" />
            <span className="text-sm font-semibold text-[#e6edf3]">解压 ZIP 文件</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#6e7681] hover:text-[#e6edf3] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <p className="text-xs text-[#8b949e] mb-3">
          解压到：<span className="font-mono text-[#e6edf3]">{targetDir}</span>
        </p>

        {result ? (
          <div className="flex items-center gap-2 text-xs text-[#3fb950]">
            <Check size={14} />
            <span>{result.message}</span>
          </div>
        ) : error ? (
          <div className="text-xs text-[#f85149] mb-3">{error}</div>
        ) : null}

        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          onChange={handleFileChange}
          className="hidden"
          disabled={uploading}
        />

        {!result && (
          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2 bg-[#21262d] hover:bg-[#30363d] text-[#e6edf3] text-xs rounded-lg transition-colors disabled:opacity-50 border border-[#30363d] border-dashed"
          >
            {uploading ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>解压中...</span>
              </>
            ) : (
              <>
                <Upload size={14} />
                <span>点击选择 ZIP 文件</span>
              </>
            )}
          </button>
        )}

        <span className="block text-[10px] text-[#6e7681] mt-2 text-center">最大 100MB</span>
      </div>
    </div>
  );
}
