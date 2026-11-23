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
    <section id="history" className="mx-auto max-w-6xl px-4 sm:px-6 py-10">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            سجل المقالات والمحفوظات
          </h2>
          <p className="text-sm text-[#475569] dark:text-[#94A3B8] mt-1">
            عمليات البحث والمراجع المحفوظة محلياً على جهازك.
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] px-3 py-2 text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#181D29] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
            className="inline-flex items-center gap-1 rounded-xl border border-[#E2E8F0] dark:border-[#1F2737] bg-[#F1F5F9] dark:bg-[#11151E] p-1 self-start"
          >
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              onClick={() => setFilter('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
                filter === 'all'
                  ? 'bg-white dark:bg-[#1E2534] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs'
                  : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
              }`}
            >
              الكل ({items.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'available'}
              onClick={() => setFilter('available')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
                filter === 'available'
                  ? 'bg-white dark:bg-[#1E2534] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs'
                  : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
              }`}
            >
              متوفرة PDF ({availableCount})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'bookmarked'}
              onClick={() => setFilter('bookmarked')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap tabular-nums cursor-pointer ${
                filter === 'bookmarked'
                  ? 'bg-white dark:bg-[#1E2534] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs'
                  : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
              }`}
            >
              المحفوظات ({bookmarkedCount})
            </button>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#64748B]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="تصفية بالعنوان أو DOI..."
              className="w-full min-h-[38px] rounded-xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] pr-9 pl-3 py-1.5 text-xs text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#2563EB] dark:focus:border-[#3B82F6] focus:outline-none"
            />
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] px-6 py-9 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
          لا توجد مقالات في السجل بعد. أدخل رابط مقالة علمية أو اختر أحد الأمثلة السريعة لبدء البحث.
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] px-6 py-9 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">
          لا توجد مقالات مطابقة للتصفية الحالية.
        </div>
      ) : (
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] divide-y divide-[#F1F5F9] dark:divide-[#1F2737] shadow-sm shadow-slate-900/[0.02]">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4 hover:bg-[#F8FAFC]/70 dark:hover:bg-[#181D29]/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#64748B] dark:text-[#94A3B8] mb-1">
                  <span className="inline-flex items-center gap-1 font-medium">
                    {item.available ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#059669] dark:text-[#34D399]" />
                        <span className="text-[#059669] dark:text-[#34D399]">متوفرة بصيغة PDF</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-[#C2410C] dark:text-[#FB923C]" />
                        <span className="text-[#C2410C] dark:text-[#FB923C]">غير متوفرة</span>
                      </>
                    )}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span dir="ltr" className="font-mono text-[#0F172A] dark:text-[#E2E8F0]">
                    {item.doi}
                  </span>
                  {item.year && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{item.year}</span>
                    </>
                  )}
                </div>

                <p dir="auto" className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
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
                      ? 'border-[#2563EB] dark:border-[#60A5FA] bg-[#2563EB]/10 dark:bg-[#3B82F6]/15 text-[#2563EB] dark:text-[#60A5FA]'
                      : 'border-[#E2E8F0] dark:border-[#2A3346] bg-[#F8FAFC] dark:bg-[#090B10] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#181D29]'
                  }`}
                >
                  <Bookmark className={`h-3.5 w-3.5 ${item.bookmarked ? 'fill-current' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => onReSearch(item.input)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2A3346] bg-[#F8FAFC] dark:bg-[#090B10] px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#181D29] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>إعادة الفحص</span>
                </button>

                <a
                  href={item.sciHubBoxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1D4ED8] transition-colors whitespace-nowrap"
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
