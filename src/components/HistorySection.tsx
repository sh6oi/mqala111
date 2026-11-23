import { useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import type { HistoryItem } from '../types.ts';

type HistoryFilter = 'all' | 'available' | 'bookmarked';

interface HistorySectionProps {
  items: HistoryItem[];
  onReSearch: (input: string) => void;
  onToggleBookmark: (doi: string) => void;
  onClearHistory: () => void;
}

export function HistorySection({
  items,
  onReSearch,
  onToggleBookmark,
  onClearHistory,
}: HistorySectionProps) {
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [query, setQuery] = useState('');

  const filteredItems = items.filter((item) => {
    if (filter === 'available' && !item.available) return false;
    if (filter === 'bookmarked' && !item.bookmarked) return false;
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      const hay = `${item.title ?? ''} ${item.doi} ${item.journal ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const bookmarkedCount = items.filter((i) => i.bookmarked).length;
  const availableCount = items.filter((i) => i.available).length;

  return (
    <section id="history" className="mx-auto max-w-5xl py-8 border-t border-[#E4DFD5] dark:border-[#272B33]">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#1C1917] dark:text-[#F5F2EB]">
            سجل المقالات والمحفوظات
          </h2>
          <p className="text-sm text-[#57534E] dark:text-[#A8A29E] mt-1">
            عمليات البحث والمراجع المحفوظة محلياً على جهازك.
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DFD5] dark:border-[#272B33] bg-white dark:bg-[#181B21] px-3 py-2 text-xs font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE7] dark:hover:bg-[#232730] hover:text-[#1C1917] dark:hover:text-[#F5F2EB] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>مسح السجل</span>
          </button>
        )}
      </div>

      {items.length > 0 && (
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="تصفية السجل"
            className="inline-flex items-center gap-1 rounded-lg border border-[#E4DFD5] dark:border-[#272B33] bg-[#F3EFE7] dark:bg-[#181B21] p-1 self-start"
          >
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              onClick={() => setFilter('all')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
                filter === 'all'
                  ? 'bg-white dark:bg-[#232730] text-[#1C1917] dark:text-[#F5F2EB] shadow-xs'
                  : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EB]'
              }`}
            >
              الكل ({items.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'available'}
              onClick={() => setFilter('available')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
                filter === 'available'
                  ? 'bg-white dark:bg-[#232730] text-[#1C1917] dark:text-[#F5F2EB] shadow-xs'
                  : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EB]'
              }`}
            >
              متوفرة PDF ({availableCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'bookmarked'}
              onClick={() => setFilter('bookmarked')}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
                filter === 'bookmarked'
                  ? 'bg-white dark:bg-[#232730] text-[#1C1917] dark:text-[#F5F2EB] shadow-xs'
                  : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EB]'
              }`}
            >
              المحفوظات ({bookmarkedCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#78716C]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="تصفية بالعنوان أو DOI..."
              className="w-full min-h-[38px] rounded-lg border border-[#E4DFD5] dark:border-[#272B33] bg-white dark:bg-[#181B21] pr-9 pl-3 py-1.5 text-xs text-[#1C1917] dark:text-[#F5F2EB] placeholder:text-[#78716C] focus:border-[#1E3A8A] dark:focus:border-[#3B82F6] focus:outline-none"
            />
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-[#E4DFD5] dark:border-[#272B33] bg-white dark:bg-[#181B21] px-6 py-8 text-center text-sm text-[#57534E] dark:text-[#A8A29E]">
          لا توجد مقالات في السجل بعد. أدخل رابط مقالة علمية في الأعلى لبدء البحث.
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-[#E4DFD5] dark:border-[#272B33] bg-white dark:bg-[#181B21] px-6 py-8 text-center text-sm text-[#57534E] dark:text-[#A8A29E]">
          لا توجد مقالات مطابقة للتصفية الحالية.
        </div>
      ) : (
        <div className="rounded-xl border border-[#E4DFD5] dark:border-[#272B33] bg-white dark:bg-[#181B21] divide-y divide-[#F0ECE3] dark:divide-[#272B33]">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#57534E] dark:text-[#A8A29E] mb-1">
                  <span className="inline-flex items-center gap-1 font-medium">
                    {item.available ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#15803D] dark:text-[#4ADE80]" />
                        <span className="text-[#15803D] dark:text-[#4ADE80]">متوفرة بصيغة PDF</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-[#9A3412] dark:text-[#FB923C]" />
                        <span className="text-[#9A3412] dark:text-[#FB923C]">غير متوفرة</span>
                      </>
                    )}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span dir="ltr" className="font-mono text-[#1C1917] dark:text-[#F5F2EB]">
                    {item.doi}
                  </span>
                  {item.year && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{item.year}</span>
                    </>
                  )}
                </div>

                <p dir="auto" className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EB] truncate">
                  {item.title ?? item.doi}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onToggleBookmark(item.doi)}
                  aria-label={item.bookmarked ? 'إزالة من المحفوظات' : 'حفظ في المحفوظات'}
                  title={item.bookmarked ? 'إزالة من المحفوظات' : 'حفظ في المحفوظات'}
                  className={`inline-flex min-h-[38px] w-[38px] items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                    item.bookmarked
                      ? 'border-[#1E3A8A] dark:border-[#60A5FA] bg-[#1E3A8A]/10 dark:bg-[#3B82F6]/15 text-[#1E3A8A] dark:text-[#60A5FA]'
                      : 'border-[#E4DFD5] dark:border-[#323741] bg-[#FBF9F5] dark:bg-[#111317] text-[#57534E] dark:text-[#A8A29E] hover:bg-[#EBE6DF] dark:hover:bg-[#232730]'
                  }`}
                >
                  <Bookmark className={`h-3.5 w-3.5 ${item.bookmarked ? 'fill-current' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => onReSearch(item.input)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#D6CEBE] dark:border-[#323741] bg-[#FBF9F5] dark:bg-[#111317] px-3 py-1.5 text-xs font-medium text-[#1C1917] dark:text-[#F5F2EB] hover:bg-[#EBE6DF] dark:hover:bg-[#232730] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>إعادة الفحص</span>
                </button>

                <a
                  href={item.sciHubBoxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#1E3A8A] dark:bg-[#3B82F6] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#172E6E] dark:hover:bg-[#2563EB] transition-colors whitespace-nowrap"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>sci-hub.box</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
