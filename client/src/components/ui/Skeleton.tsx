export function FileTreeSkeleton() {
  const rows = [
    { depth: 0, width: 'w-24' },
    { depth: 1, width: 'w-20' },
    { depth: 1, width: 'w-16' },
    { depth: 2, width: 'w-28' },
    { depth: 2, width: 'w-20' },
    { depth: 0, width: 'w-20' },
    { depth: 1, width: 'w-24' },
    { depth: 1, width: 'w-16' },
  ];

  return (
    <div className="p-2 space-y-1 animate-pulse">
      {rows.map((row, i) => (
        <div
          key={i}
          className="flex items-center gap-2 py-1"
          style={{ paddingLeft: `${8 + row.depth * 14}px` }}
        >
          <div className="w-3 h-3 bg-[#21262d] rounded shrink-0" />
          <div className={`h-3 bg-[#21262d] rounded ${row.width}`} />
        </div>
      ))}
    </div>
  );
}
