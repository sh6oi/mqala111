import { CheckCircle2, Download, ExternalLink, FileSpreadsheet, FileText, Loader2, XCircle } from 'lucide-react';
import type { BatchItemResult } from '../types.ts';
import { formatCitation } from '../utils/citations.ts';

interface BatchResultsPanelProps {
  items: BatchItemResult[];
  isRunning: boolean;
}

export function BatchResultsPanel({ items, isRunning }: BatchResultsPanelProps) {
  if (items.length === 0) return null;

  const completed = items.filter((i) => i.status === 'done' || i.status === 'error').length;
  const availableCount = items.filter((i) => i.data?.sciHub?.available).length;

  const handleExportCsv = () => {
    const headers = ['Input', 'DOI', 'Title', 'Journal', 'Year', 'Available', 'SciHubBoxURL', 'PDFURL'];
    const escapeCsv = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const rows = items.map((item) => {
      const d = item.data;
      return [
        item.input,
        d?.doi ?? '',
        d?.metadata.title ?? '',
        d?.metadata.journal ?? '',
        d?.metadata.year ?? '',
        d?.sciHub?.available ? 'Yes' : 'No',
        d?.sciHub?.sciHubBoxUrl ?? '',
        d?.sciHub?.pdfUrl ?? '',
      ]
        .map(escapeCsv)
        .join(',');
    });
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `articles-batch-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const handleExportBibtex = () => {
    const entries = items
      .filter((i) => i.data?.doi)
      .map((i) => formatCitation(i.data!.doi!, i.data!.metadata, 'bibtex'));
    if (entries.length === 0) return;
    const blob = new Blob([entries.join('\n\n')], { type: 'application/x-bibtex;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `references-${Date.now()}.bib`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  return (
    <section aria-live="polite" className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 pb-4">
      <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] overflow-hidden shadow-sm shadow-slate-900/[0.03]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-[#E2E8F0] dark:border-[#1F2737] bg-[#F8FAFC] dark:bg-[#0F131C]">
          <div>
            <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              نتائج الفحص المتعدد
            </h2>
            <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8] tabular-nums">
              المكتمل: {completed} من {items.length} · المتوفرة للتحميل: {availableCount}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleExportBibtex}
              disabled={isRunning || items.every((i) => !i.data?.doi)}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2A3346] bg-white dark:bg-[#11151E] px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#181D29] disabled:opacity-45 whitespace-nowrap cursor-pointer"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>تصدير BibTeX</span>
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isRunning || completed === 0}
              className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2A3346] bg-white dark:bg-[#11151E] px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#181D29] disabled:opacity-45 whitespace-nowrap cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>تصدير CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] dark:border-[#1F2737] text-xs text-[#64748B] dark:text-[#94A3B8] bg-[#F8FAFC] dark:bg-[#0D1017]">
                <th className="py-3 px-4 font-semibold w-12 tabular-nums">#</th>
                <th className="py-3 px-4 font-semibold">المقالة / DOI</th>
                <th className="py-3 px-4 font-semibold">الحالة</th>
                <th className="py-3 px-4 font-semibold text-left">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9] dark:divide-[#1F2737]">
              {items.map((item, idx) => {
                const d = item.data;
                const doi = d?.doi;
                const available = Boolean(d?.sciHub?.available);
                const pdfUrl = d?.sciHub?.pdfUrl;
                const sciHubBoxUrl = d?.sciHub?.sciHubBoxUrl;

                return (
                  <tr key={`${item.input}-${idx}`} className="hover:bg-[#F8FAFC]/80 dark:hover:bg-[#181D29]/60">
                    <td className="py-3.5 px-4 font-mono text-xs text-[#64748B] dark:text-[#94A3B8] tabular-nums align-top">
                      {String(idx + 1).padStart(2, '0')}
                    </td>

                    <td className="py-3.5 px-4 min-w-[260px] max-w-md align-top">
                      {item.status === 'pending' || item.status === 'loading' ? (
                        <p dir="ltr" className="font-mono text-xs text-[#64748B] dark:text-[#94A3B8] truncate text-left">
                          {item.input}
                        </p>
                      ) : (
                        <>
                          <p dir="auto" className="font-semibold text-[#0F172A] dark:text-[#F8FAFC] line-clamp-1">
                            {d?.metadata.title ?? doi ?? item.input}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-[#64748B] dark:text-[#94A3B8]">
                            {doi ? (
                              <span dir="ltr" className="font-mono text-[#2563EB] dark:text-[#60A5FA]">
                                {doi}
                              </span>
                            ) : (
                              <span className="text-[#C2410C] dark:text-[#FB923C]">تعذّر استخراج DOI</span>
                            )}
                            {d?.metadata.year && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="tabular-nums">{d.metadata.year}</span>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap align-top">
                      {item.status === 'pending' && (
                        <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">في الانتظار</span>
                      )}
                      {item.status === 'loading' && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2563EB] dark:text-[#60A5FA]">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>جارٍ الفحص</span>
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#C2410C] dark:text-[#FB923C]">
                          <XCircle className="h-3.5 w-3.5" />
                          <span>خطأ</span>
                        </span>
                      )}
                      {item.status === 'done' && (
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                            available
                              ? 'text-[#059669] dark:text-[#34D399]'
                              : 'text-[#C2410C] dark:text-[#FB923C]'
                          }`}
                        >
                          {available ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>متوفرة PDF</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5" />
                              <span>غير متوفرة</span>
                            </>
                          )}
                        </span>
                      )}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap align-top">
                      <div className="flex items-center justify-end gap-2">
                        {available && pdfUrl && doi && (
                          <a
                            href={`/api/download?url=${encodeURIComponent(pdfUrl)}&doi=${encodeURIComponent(doi)}`}
                            className="inline-flex min-h-[34px] items-center gap-1.5 rounded-lg bg-[#059669] px-3 py-1 text-xs font-semibold text-white hover:bg-[#047857] transition-colors"
                          >
                            <Download className="h-3.5 w-3.5" />
                            <span>PDF</span>
                          </a>
                        )}
                        {sciHubBoxUrl && (
                          <a
                            href={sciHubBoxUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-[#CBD5E1] dark:border-[#2A3346] px-2.5 py-1 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#181D29] transition-colors"
                          >
                            <ExternalLink className="h-3 w-3" />
                            <span>sci-hub.box</span>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
