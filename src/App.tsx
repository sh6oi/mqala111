import { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header.tsx';
import { SearchForm, type SearchMode } from './components/SearchForm.tsx';
import { ResultPanel } from './components/ResultPanel.tsx';
import { BatchResultsPanel } from './components/BatchResultsPanel.tsx';
import { HistorySection } from './components/HistorySection.tsx';
import { WorkflowSection } from './components/WorkflowSection.tsx';
import type { BatchItemResult, HistoryItem, LookupResponse } from './types.ts';

const HISTORY_STORAGE_KEY = 'academic_doi_scihub_history_v1';
const THEME_STORAGE_KEY = 'academic_doi_theme_v1';
const MAX_HISTORY_ITEMS = 25;

function loadSavedHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadSavedTheme(): boolean {
  try {
    return localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
  } catch {
    return false;
  }
}

export default function App() {
  const [mode, setMode] = useState<SearchMode>('single');
  const [isDark, setIsDark] = useState<boolean>(() => loadSavedTheme());
  const [input, setInput] = useState('');
  const [batchInput, setBatchInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [batchResults, setBatchResults] = useState<BatchItemResult[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>(() => loadSavedHistory());
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Ignore storage error
    }
  }, [isDark]);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  const upsertHistory = (query: string, data: LookupResponse) => {
    if (!data.success || !data.doi || !data.sciHub) return;
    setHistory((prev) => {
      const existing = prev.find((item) => item.doi === data.doi);
      const nextItem: HistoryItem = {
        id: `${data.doi}-${Date.now()}`,
        input: query,
        doi: data.doi!,
        title: data.metadata.title,
        journal: data.metadata.journal,
        year: data.metadata.year,
        available: data.sciHub!.available,
        pdfUrl: data.sciHub!.pdfUrl,
        sciHubBoxUrl: data.sciHub!.sciHubBoxUrl,
        checkedAt: new Date().toISOString(),
        bookmarked: existing?.bookmarked ?? false,
      };
      const filtered = prev.filter((item) => item.doi !== data.doi);
      return [nextItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    });
  };

  const handleLookupSingle = async (overrideInput?: string) => {
    const query = (overrideInput ?? input).trim();
    if (!query || isLoading) return;

    setMode('single');
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: query }),
      });

      const data: LookupResponse = await response.json();
      setResult(data);
      upsertHistory(query, data);
    } catch {
      setResult({
        success: false,
        input: query,
        doi: null,
        doiSource: null,
        articleUrl: null,
        metadata: {
          title: null,
          authors: [],
          journal: null,
          year: null,
          publisher: null,
          abstract: null,
          citation: null,
        },
        sciHub: null,
        error: 'تعذّر الاتصال بالخادم حالياً. يرجى المحاولة مرة أخرى.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLookupBatch = async () => {
    const lines = batchInput
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 10);

    if (lines.length === 0 || isLoading) return;

    setIsLoading(true);
    setBatchResults(lines.map((line) => ({ input: line, status: 'pending' })));

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      setBatchResults((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'loading' } : item))
      );

      try {
        const res = await fetch('/api/lookup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: line }),
        });
        const data: LookupResponse = await res.json();
        upsertHistory(line, data);
        setBatchResults((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'done', data } : item))
        );
      } catch {
        setBatchResults((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: 'error' } : item))
        );
      }
    }

    setIsLoading(false);
  };

  const handleNewSearch = () => {
    setMode('single');
    setInput('');
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const handleReSearch = (savedInput: string) => {
    setInput(savedInput);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    handleLookupSingle(savedInput);
  };

  const handleToggleBookmark = (doi: string) => {
    setHistory((prev) =>
      prev.map((item) =>
        item.doi === doi ? { ...item, bookmarked: !item.bookmarked } : item
      )
    );
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  const currentIsBookmarked = Boolean(
    result?.doi && history.some((item) => item.doi === result.doi && item.bookmarked)
  );

  const stats = {
    total: history.length,
    available: history.filter((i) => i.available).length,
    bookmarked: history.filter((i) => i.bookmarked).length,
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#090B10] text-[#0F172A] dark:text-[#F8FAFC] transition-colors">
      <Header onNewSearch={handleNewSearch} />

      <main className="flex-1">
        <SearchForm
          mode={mode}
          onModeChange={setMode}
          isDark={isDark}
          onToggleTheme={() => setIsDark((prev) => !prev)}
          input={input}
          onInputChange={setInput}
          batchInput={batchInput}
          onBatchInputChange={setBatchInput}
          onSubmitSingle={handleLookupSingle}
          onSubmitBatch={handleLookupBatch}
          isLoading={isLoading}
          inputRef={inputRef}
          stats={stats}
        />

        {mode === 'single' ? (
          <ResultPanel
            isLoading={isLoading}
            result={result}
            isBookmarked={currentIsBookmarked}
            onToggleBookmark={handleToggleBookmark}
          />
        ) : (
          <BatchResultsPanel items={batchResults} isRunning={isLoading} />
        )}

        <HistorySection
          items={history}
          onReSearch={handleReSearch}
          onToggleBookmark={handleToggleBookmark}
          onClearHistory={handleClearHistory}
        />

        <WorkflowSection />
      </main>

      <footer className="border-t border-[#E2E8F0] dark:border-[#1F2737] bg-[#F8FAFC] dark:bg-[#090B10] py-6 px-6 transition-colors">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
          <span>المستكشف الأكاديمي · أداة استخراج DOI والبحث عبر sci-hub.box</span>
          <a
            href="https://sci-hub.box/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:underline underline-offset-4 transition-colors"
          >
            الانتقال إلى sci-hub.box
          </a>
        </div>
      </footer>
    </div>
  );
}
