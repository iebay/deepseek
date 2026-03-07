import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, ChevronRight, ChevronDown, X, Replace, RotateCcw,
  CaseSensitive, Regex, Filter, Loader2,
} from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { searchFiles, replaceInFiles } from '../../api/filesApi';
import type { SearchResult, SearchMatch } from '../../api/filesApi';
import { fetchFileContent } from '../../api/filesApi';

export default function SearchPanel() {
  const { currentProject, openTab, setActiveTab, openTabs, updateTabContent, showToast } = useAppStore();

  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [includePattern, setIncludePattern] = useState('');
  const [excludePattern, setExcludePattern] = useState('');

  const [results, setResults] = useState<SearchResult[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [filesSearched, setFilesSearched] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  const [replacingAll, setReplacingAll] = useState(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (!currentProject?.path || !q.trim()) {
      setResults([]);
      setTotalMatches(0);
      setFilesSearched(0);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const data = await searchFiles(currentProject.path, q, {
        caseSensitive,
        useRegex,
        includePattern: includePattern || undefined,
        excludePattern: excludePattern || undefined,
      });
      setResults(data.results);
      setTotalMatches(data.totalMatches);
      setFilesSearched(data.filesSearched);
      setHasSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject, caseSensitive, useRegex, includePattern, excludePattern]);

  // Debounced search on query/option changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(query);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, caseSensitive, useRegex, includePattern, excludePattern, doSearch]);

  const handleOpenFile = useCallback(async (filePath: string, match?: SearchMatch) => {
    const existing = openTabs.find(t => t.path === filePath);
    if (existing) {
      setActiveTab(filePath);
    } else {
      try {
        const content = await fetchFileContent(filePath);
        const name = filePath.split(/[\\/]/).pop() || filePath;
        openTab({ path: filePath, name, content, isDirty: false });
        setActiveTab(filePath);
      } catch {
        showToast('无法打开文件', 'error');
      }
    }
    // Emit a custom event so the editor can jump to the line
    if (match) {
      window.dispatchEvent(new CustomEvent('search:jump', { detail: { filePath, line: match.line, column: match.column } }));
    }
  }, [openTabs, openTab, setActiveTab, showToast]);

  const handleReplaceAll = useCallback(async () => {
    if (!query.trim() || results.length === 0) return;
    setReplacingAll(true);
    try {
      const replacements = results.map(r => ({
        filePath: r.filePath,
        searchText: query,
        replaceWith: replaceText,
        useRegex,
        caseSensitive,
      }));
      const { replacedCount, filesModified } = await replaceInFiles(replacements);

      // Update any open tabs with the new content
      for (const result of results) {
        const tab = openTabs.find(t => t.path === result.filePath);
        if (tab) {
          try {
            const newContent = await fetchFileContent(result.filePath);
            updateTabContent(result.filePath, newContent, false);
          } catch {
            // ignore
          }
        }
      }

      showToast(`已替换 ${replacedCount} 处，共 ${filesModified} 个文件`, 'success');
      // Re-run search to refresh results
      await doSearch(query);
    } catch (err) {
      showToast(err instanceof Error ? err.message : '替换失败', 'error');
    } finally {
      setReplacingAll(false);
    }
  }, [query, replaceText, results, useRegex, caseSensitive, openTabs, updateTabContent, showToast, doSearch]);

  const toggleFileCollapse = useCallback((filePath: string) => {
    setCollapsedFiles(prev => {
      const next = new Set(prev);
      if (next.has(filePath)) next.delete(filePath);
      else next.add(filePath);
      return next;
    });
  }, []);

  const highlightMatch = (text: string, matchStart: number, matchEnd: number) => {
    const before = text.slice(0, matchStart);
    const matched = text.slice(matchStart, matchEnd);
    const after = text.slice(matchEnd);
    return (
      <span className="text-[#8b949e] text-xs font-mono truncate">
        <span>{before}</span>
        <span className="bg-[#f0a937]/30 text-[#f0a937] rounded-sm px-px">{matched}</span>
        <span>{after}</span>
      </span>
    );
  };

  const btnBase = 'p-1 rounded transition-colors text-xs';
  const btnActive = `${btnBase} text-[#388bfd] bg-[#388bfd]/10`;
  const btnInactive = `${btnBase} text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d]`;

  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-[#e6edf3] overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-[#30363d] space-y-2 shrink-0">
        {/* Search row */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowReplace(v => !v)}
            className="text-[#8b949e] hover:text-[#e6edf3] transition-colors shrink-0"
            title="展开替换"
          >
            {showReplace ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
          <div className="relative flex-1">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#6e7681] pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜索"
              className="w-full bg-[#161b22] border border-[#30363d] rounded-md pl-6 pr-2 py-1.5 text-xs text-[#e6edf3] placeholder-[#6e7681] focus:outline-none focus:border-[#388bfd] transition-colors"
            />
          </div>
          <button
            onClick={() => setCaseSensitive(v => !v)}
            className={caseSensitive ? btnActive : btnInactive}
            title="区分大小写 (Aa)"
          >
            <CaseSensitive size={14} />
          </button>
          <button
            onClick={() => setUseRegex(v => !v)}
            className={useRegex ? btnActive : btnInactive}
            title="使用正则表达式 (.*)"
          >
            <Regex size={14} />
          </button>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={showFilters ? btnActive : btnInactive}
            title="文件过滤"
          >
            <Filter size={14} />
          </button>
        </div>

        {/* Replace row */}
        {showReplace && (
          <div className="flex items-center gap-1 pl-4">
            <div className="relative flex-1">
              <Replace size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#6e7681] pointer-events-none" />
              <input
                type="text"
                value={replaceText}
                onChange={e => setReplaceText(e.target.value)}
                placeholder="替换"
                className="w-full bg-[#161b22] border border-[#30363d] rounded-md pl-6 pr-2 py-1.5 text-xs text-[#e6edf3] placeholder-[#6e7681] focus:outline-none focus:border-[#388bfd] transition-colors"
              />
            </div>
            <button
              onClick={handleReplaceAll}
              disabled={!query.trim() || results.length === 0 || replacingAll}
              className="flex items-center gap-1 px-2 py-1.5 text-xs rounded-md bg-[#21262d] border border-[#30363d] text-[#e6edf3] hover:bg-[#30363d] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              title="全部替换"
            >
              {replacingAll ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
              全部替换
            </button>
          </div>
        )}

        {/* Filters row */}
        {showFilters && (
          <div className="pl-4 space-y-1">
            <input
              type="text"
              value={includePattern}
              onChange={e => setIncludePattern(e.target.value)}
              placeholder="包含文件 (e.g. *.ts,*.tsx)"
              className="w-full bg-[#161b22] border border-[#30363d] rounded-md px-2 py-1.5 text-xs text-[#e6edf3] placeholder-[#6e7681] focus:outline-none focus:border-[#388bfd] transition-colors"
            />
            <input
              type="text"
              value={excludePattern}
              onChange={e => setExcludePattern(e.target.value)}
              placeholder="排除文件 (e.g. node_modules,dist)"
              className="w-full bg-[#161b22] border border-[#30363d] rounded-md px-2 py-1.5 text-xs text-[#e6edf3] placeholder-[#6e7681] focus:outline-none focus:border-[#388bfd] transition-colors"
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      {hasSearched && !isLoading && !error && (
        <div className="px-3 py-1.5 text-[10px] text-[#6e7681] border-b border-[#30363d] shrink-0">
          {totalMatches > 0
            ? `${totalMatches} 个结果，来自 ${results.length} 个文件（已搜索 ${filesSearched} 个文件）`
            : `未找到匹配项（已搜索 ${filesSearched} 个文件）`}
          {totalMatches >= 500 && <span className="text-[#f0a937] ml-1">（结果已截断至 500 条）</span>}
        </div>
      )}

      {/* Results list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center gap-2 px-3 py-4 text-xs text-[#8b949e]">
            <Loader2 size={14} className="animate-spin" />
            搜索中…
          </div>
        )}

        {error && (
          <div className="px-3 py-3 text-xs text-[#f85149]">{error}</div>
        )}

        {!isLoading && !error && hasSearched && results.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-[#6e7681]">未找到匹配项</div>
        )}

        {!isLoading && !currentProject && (
          <div className="px-3 py-8 text-center text-xs text-[#6e7681]">请先打开一个项目</div>
        )}

        {results.map(result => {
          const isCollapsed = collapsedFiles.has(result.filePath);
          return (
            <div key={result.filePath} className="border-b border-[#21262d]">
              {/* File header */}
              <button
                onClick={() => toggleFileCollapse(result.filePath)}
                className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-[#161b22] transition-colors text-left"
              >
                {isCollapsed
                  ? <ChevronRight size={12} className="text-[#6e7681] shrink-0" />
                  : <ChevronDown size={12} className="text-[#6e7681] shrink-0" />
                }
                <span className="text-xs text-[#58a6ff] truncate flex-1 min-w-0">{result.relativePath}</span>
                <span className="text-[10px] text-[#6e7681] bg-[#21262d] px-1.5 py-0.5 rounded-full shrink-0">
                  {result.matches.length}
                </span>
              </button>

              {/* Match lines */}
              {!isCollapsed && result.matches.map((match, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOpenFile(result.filePath, match)}
                  className="w-full flex items-start gap-2 px-3 py-1 hover:bg-[#161b22] transition-colors text-left group"
                >
                  <span className="text-[10px] text-[#6e7681] shrink-0 w-8 text-right mt-0.5 tabular-nums">
                    {match.line}
                  </span>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    {highlightMatch(match.text.trimStart(), match.matchStart - (match.text.length - match.text.trimStart().length), match.matchEnd - (match.text.length - match.text.trimStart().length))}
                  </div>
                  <X
                    size={10}
                    className="text-[#6e7681] opacity-0 group-hover:opacity-100 shrink-0 mt-1 transition-opacity"
                  />
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
