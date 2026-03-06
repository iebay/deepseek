export function SkeletonLine({ width = '100%' }: { width?: string }) {
  return (
    <div
      className="h-3 bg-[#21262d] rounded animate-pulse"
      style={{ width }}
    />
  );
}

export function FileTreeSkeleton() {
  const items = [
    { indent: 0, width: '75%' },
    { indent: 1, width: '60%' },
    { indent: 2, width: '80%' },
    { indent: 2, width: '55%' },
    { indent: 1, width: '70%' },
    { indent: 0, width: '65%' },
    { indent: 1, width: '85%' },
    { indent: 1, width: '50%' },
  ];

  return (
    <div className="p-3 space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center gap-2"
          style={{ paddingLeft: `${item.indent * 12}px` }}
        >
          <div className="w-4 h-4 bg-[#21262d] rounded animate-pulse shrink-0" />
          <SkeletonLine width={item.width} />
        </div>
      ))}
    </div>
  );
}
