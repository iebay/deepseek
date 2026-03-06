import { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';

interface ImageUploadProps {
  images: string[]; // base64 data URLs
  onAdd: (dataUrl: string) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  maxImages?: number;
}

export default function ImageUpload({ images, onAdd, onRemove, disabled, maxImages = 5 }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 50 * 1024 * 1024) return; // 50MB limit
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onAdd(reader.result);
        }
      };
      reader.readAsDataURL(file);
    });
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      {images.length > 0 && (
        <div className="flex gap-2 px-3 py-2 overflow-x-auto">
          {images.map((img, i) => (
            <div key={i} className="relative shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-[#30363d]">
              <img src={img} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => onRemove(i)}
                className="absolute top-0.5 right-0.5 w-4 h-4 bg-black/70 rounded-full flex items-center justify-center"
              >
                <X size={10} className="text-white" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled || images.length >= maxImages}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={disabled || images.length >= maxImages}
        className="p-1.5 rounded-lg text-[#6e7681] hover:text-[#e6edf3] hover:bg-[#21262d] transition-colors disabled:opacity-40"
        title={`上传图片（最多 ${maxImages} 张）`}
      >
        <ImagePlus size={16} />
      </button>
    </div>
  );
}
