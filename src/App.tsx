import { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header.tsx';
import { SearchForm } from './components/SearchForm.tsx';
import { ResultPanel } from './components/ResultPanel.tsx';
import { HistorySection } from './components/HistorySection.tsx';
import { WorkflowSection } from './components/WorkflowSection.tsx';
import type { HistoryItem, LookupResponse } from './types.ts';

const HISTORY_STORAGE_KEY = 'academic_doi_scihub_history_v1';
const MAX_HISTORY_ITEMS = 10;

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

export default function App() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<LookupResponse | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>(() => loadSavedHistory());
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  const handleLookup = async (overrideInput?: string) => {
    const query = (overrideInput ?? input).trim();
    if (!query || isLoading) return;

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

      if (data.success && data.doi && data.sciHub) {
        const nextItem: HistoryItem = {
          id: `${data.doi}-${Date.now()}`,
          input: query,
          doi: data.doi,
          title: data.metadata.title,
          journal: data.metadata.journal,
          year: data.metadata.year,
          available: data.sciHub.available,
          pdfUrl: data.sciHub.pdfUrl,
          sciHubBoxUrl: data.sciHub.sciHubBoxUrl,
          checkedAt: new Date().toISOString(),
        };

        setHistory((prev) => {
          const filtered = prev.filter((item) => item.doi !== data.doi);
          return [nextItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
        });
      }
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

  const handleNewSearch = () => {
    setInput('');
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => inputRef.current?.focus(), 150);
  };

  const handleReSearch = (savedInput: string) => {
    setInput(savedInput);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    handleLookup(savedInput);
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FBF9F5] text-[#1C1917]">
      <Header onNewSearch={handleNewSearch} />

      <main className="flex-1 px-4 sm:px-6">
        <SearchForm
          input={input}
          onInputChange={setInput}
          onSubmit={handleLookup}
          isLoading={isLoading}
          inputRef={inputRef}
        />

        <ResultPanel isLoading={isLoading} result={result} />

        <HistorySection
          items={history}
          onReSearch={handleReSearch}
          onClearHistory={handleClearHistory}
        />

        <WorkflowSection />
      </main>

      <footer className="border-t border-[#E4DFD5] bg-[#FBF9F5] py-6 px-6">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#57534E]">
          <span>المستكشف الأكاديمي · أداة استخراج DOI والبحث عبر sci-hub.box</span>
          <a
            href="https://sci-hub.box/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors"
          >
            الانتقال إلى sci-hub.box
          </a>
        </div>
      </footer>
    </div>
  );
}
