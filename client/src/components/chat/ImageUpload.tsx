import { useRef } from 'react';
import { ImagePlus, X } from 'lucide-react';

const MAX_IMAGES = 5;
const MAX_SIZE_MB = 50;

export interface UploadedImage {
  url: string;
  name: string;
}

interface ImageUploadProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
}

export default function ImageUpload({ images, onChange }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) return;

    const newImages: UploadedImage[] = [];
    for (const file of Array.from(files).slice(0, remaining)) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) continue;
      const url = await fileToBase64(file);
      newImages.push({ url, name: file.name });
    }
    onChange([...images, ...newImages]);
  }

  function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function removeImage(index: number) {
    onChange(images.filter((_, i) => i !== index));
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {images.map((img, i) => (
        <div key={i} className="relative group">
          <img
            src={img.url}
            alt={img.name}
            className="w-10 h-10 object-cover rounded-lg border border-[var(--border-primary)]"
            title={img.name}
          />
          <button
            onClick={() => removeImage(i)}
            className="absolute -top-1 -right-1 w-4 h-4 bg-[#f85149] rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={8} className="text-white" />
          </button>
        </div>
      ))}
      {images.length < MAX_IMAGES && (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-10 h-10 flex items-center justify-center border border-dashed border-[var(--border-primary)] rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-primary)] transition-colors"
            title="添加图片（最多5张，每张≤50MB）"
          >
            <ImagePlus size={15} />
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={e => { if (e.target.files) void handleFiles(e.target.files); }}
          />
        </>
      )}
    </div>
  );
}
