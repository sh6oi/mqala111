import { CheckCircle2, ExternalLink, RotateCcw, Trash2, XCircle } from 'lucide-react';
import type { HistoryItem } from '../types.ts';

interface HistorySectionProps {
  items: HistoryItem[];
  onReSearch: (input: string) => void;
  onClearHistory: () => void;
}

export function HistorySection({ items, onReSearch, onClearHistory }: HistorySectionProps) {
  return (
    <section id="history" className="mx-auto max-w-4xl py-8 border-t border-[#E4DFD5]">
      <div className="flex items-center justify-between gap-4 mb-5">
        <div>
          <h2 className="font-serif text-2xl font-bold text-[#1C1917]">سجل المقالات الأخيرة</h2>
          <p className="text-sm text-[#57534E] mt-1">
            عمليات البحث السابقة المحفوظة محلياً على جهازك للوصول السريع.
          </p>
        </div>

        {items.length > 0 && (
          <button
            type="button"
            onClick={onClearHistory}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E4DFD5] bg-white px-3 py-2 text-xs font-medium text-[#57534E] hover:bg-[#F3EFE7] hover:text-[#1C1917] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>مسح السجل</span>
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-[#E4DFD5] bg-white px-6 py-8 text-center text-sm text-[#57534E]">
          لا توجد مقالات في السجل بعد. أدخل رابط مقالة علمية في الأعلى لبدء البحث.
        </div>
      ) : (
        <div className="rounded-xl border border-[#E4DFD5] bg-white divide-y divide-[#F0ECE3]">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#57534E] mb-1">
                  <span className="inline-flex items-center gap-1 font-medium">
                    {item.available ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#15803D]" />
                        <span className="text-[#15803D]">متوفرة بصيغة PDF</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3.5 w-3.5 text-[#9A3412]" />
                        <span className="text-[#9A3412]">غير متوفرة</span>
                      </>
                    )}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span dir="ltr" className="font-mono text-[#1C1917]">
                    {item.doi}
                  </span>
                  {item.year && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{item.year}</span>
                    </>
                  )}
                </div>

                <p dir="auto" className="text-sm font-semibold text-[#1C1917] truncate">
                  {item.title ?? item.doi}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onReSearch(item.input)}
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] px-3 py-1.5 text-xs font-medium text-[#1C1917] hover:bg-[#EBE6DF] transition-colors whitespace-nowrap cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>إعادة الفحص</span>
                </button>

                <a
                  href={item.sciHubBoxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#1E3A8A] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#172E6E] transition-colors whitespace-nowrap"
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
