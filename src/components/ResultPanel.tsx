import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Bookmark,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileCode2,
  FileText,
  Loader2,
  XCircle,
} from 'lucide-react';
import type { LookupResponse } from '../types.ts';
import { formatCitation, type CitationFormat } from '../utils/citations.ts';

interface ResultPanelProps {
  isLoading: boolean;
  result: LookupResponse | null;
  isBookmarked: boolean;
  onToggleBookmark: (doi: string) => void;
}

function isSafeExternalUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

const CITATION_FORMATS: { id: CitationFormat; label: string }[] = [
  { id: 'apa', label: 'APA' },
  { id: 'ieee', label: 'IEEE' },
  { id: 'mla', label: 'MLA' },
  { id: 'bibtex', label: 'BibTeX' },
];

export function ResultPanel({
  isLoading,
  result,
  isBookmarked,
  onToggleBookmark,
}: ResultPanelProps) {
  const [copiedKey, setCopiedKey] = useState<'doi' | 'citation' | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [showFullAbstract, setShowFullAbstract] = useState(false);
  const [citationFormat, setCitationFormat] = useState<CitationFormat>('apa');

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    setDownloadNotice(null);
    setShowFullAbstract(false);
    setPreviewOpen(false);
    setPreviewError(null);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [result?.doi]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleCopy = async (text: string, key: 'doi' | 'citation') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleDownloadPdf = async (pdfUrl: string, doi: string) => {
    setDownloading(true);
    setDownloadNotice(null);
    try {
      const endpoint = `/api/download?url=${encodeURIComponent(pdfUrl)}&doi=${encodeURIComponent(doi)}`;
      const response = await fetch(endpoint);
      const contentType = (response.headers.get('content-type') ?? '').toLowerCase();

      if (response.ok && contentType.includes('application/pdf')) {
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `${doi.replace(/[^a-zA-Z0-9._-]+/g, '_')}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
        setDownloadNotice('بدأ تحميل ملف PDF بنجاح.');
      } else {
        const errData = await response.json().catch(() => null);
        setDownloadNotice(
          errData?.error ??
            'تعذّر التحميل عبر الوسيط الآلي نظراً لحماية الخادم المصدر. استخدم زر "فتح في sci-hub.box".'
        );
      }
    } catch {
      setDownloadNotice(
        'حدث خطأ أثناء محاولة التحميل المباشر. يمكنك فتح المقالة وتحميلها مباشرة عبر sci-hub.box.'
      );
    } finally {
      setDownloading(false);
    }
  };

  const handleTogglePreview = async (pdfUrl: string, doi: string) => {
    if (previewOpen) {
      setPreviewOpen(false);
      return;
    }
    setPreviewOpen(true);
    if (previewUrl) return;

    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const endpoint = `/api/download?url=${encodeURIComponent(pdfUrl)}&doi=${encodeURIComponent(doi)}&inline=1`;
      const response = await fetch(endpoint);
      const contentType = (response.headers.get('content-type') ?? '').toLowerCase();
      if (response.ok && contentType.includes('application/pdf')) {
        const blob = await response.blob();
        const obj = URL.createObjectURL(blob);
        setPreviewUrl(obj);
      } else {
        const errData = await response.json().catch(() => null);
        setPreviewError(
          errData?.error ??
            'يتطلب الخادم المصدر فتح الملف مباشرة عبر المتصفح. استخدم زر "فتح في sci-hub.box".'
        );
      }
    } catch {
      setPreviewError('تعذّر تحميل المعاينة الداخلية. يمكنك فتح الملف عبر sci-hub.box.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownloadBibtex = (doi: string, text: string) => {
    const blob = new Blob([text], { type: 'application/x-bibtex;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doi.replace(/[^a-zA-Z0-9._-]+/g, '_')}.bib`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  if (isLoading) {
    return (
      <section aria-live="polite" className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 pb-4">
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] p-6 sm:p-8 shadow-sm shadow-slate-900/[0.03]">
          <div className="flex items-center gap-3 mb-5">
            <Loader2 className="h-5 w-5 animate-spin text-[#2563EB] dark:text-[#60A5FA]" />
            <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              جارٍ فحص الرابط واستخراج البيانات...
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 border-t border-[#F1F5F9] dark:border-[#1F2737] pt-5 text-sm text-[#475569] dark:text-[#94A3B8]">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-semibold text-[#2563EB] dark:text-[#60A5FA] tabular-nums">
                01
              </span>
              <span>تحليل صفحة المقالة واستخراج معرّف DOI</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-semibold text-[#2563EB] dark:text-[#60A5FA] tabular-nums">
                02
              </span>
              <span>البحث عن المقالة في sci-hub.box والتحقق من PDF</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!result) return null;

  if (!result.doi) {
    return (
      <section aria-live="polite" className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 pb-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] p-6 sm:p-8 shadow-sm shadow-slate-900/[0.03]"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-[#C2410C] dark:text-[#FB923C] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                لم يتم العثور على معرّف DOI في هذا الرابط
              </h2>
              <p className="mt-1.5 text-sm text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                {result.error ??
                  'تعذّر استخراج معرّف DOI من الرابط المدخل. حاول نسخ معرّف DOI (مثل 10.1038/nature12373) ولصقه مباشرة في خانة البحث.'}
              </p>
              {result.metadata.title && (
                <p className="mt-3 text-xs text-[#64748B] dark:text-[#94A3B8]">
                  العنوان المستخرج من الصفحة:{' '}
                  <span className="text-[#0F172A] dark:text-[#F8FAFC] font-medium">
                    {result.metadata.title}
                  </span>
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </section>
    );
  }

  const { doi, doiSource, metadata, sciHub } = result;
  const available = Boolean(sciHub?.available);
  const directPdfUrl = isSafeExternalUrl(sciHub?.pdfUrl) ? sciHub.pdfUrl : null;
  const sciHubBoxUrl = isSafeExternalUrl(sciHub?.sciHubBoxUrl)
    ? sciHub.sciHubBoxUrl
    : `https://sci-hub.box/${encodeURI(doi)}`;

  const formattedCitation = formatCitation(doi, metadata, citationFormat);
  const abstractText = metadata.abstract ?? '';
  const isLongAbstract = abstractText.length > 320;
  const displayedAbstract =
    isLongAbstract && !showFullAbstract ? `${abstractText.slice(0, 320)}...` : abstractText;

  const volIssuePages = [
    metadata.volume ? `المجلد ${metadata.volume}` : null,
    metadata.issue ? `العدد ${metadata.issue}` : null,
    metadata.pages ? `ص ${metadata.pages}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section aria-live="polite" className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 pb-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] overflow-hidden shadow-sm shadow-slate-900/[0.03]"
      >
        {/* Top Availability Banner */}
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 border-b border-[#E2E8F0] dark:border-[#1F2737] ${
            available
              ? 'bg-[#ECFDF5]/80 dark:bg-[#0B2219]/70'
              : 'bg-[#F8FAFC] dark:bg-[#0F131C]'
          }`}
        >
          <div className="flex items-start gap-3">
            {available ? (
              <CheckCircle2 className="h-5 w-5 text-[#059669] dark:text-[#34D399] shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-[#C2410C] dark:text-[#FB923C] shrink-0 mt-0.5" />
            )}
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                {available ? 'المقالة متوفرة بصيغة PDF' : 'المقالة غير متوفرة حالياً للتحميل المباشر'}
              </h2>
              <p className="mt-0.5 text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8]">
                {sciHub?.message}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onToggleBookmark(doi)}
            aria-label={isBookmarked ? 'إزالة من المحفوظات' : 'حفظ في المحفوظات'}
            className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap self-start sm:self-center cursor-pointer ${
              isBookmarked
                ? 'border-[#2563EB] dark:border-[#60A5FA] bg-[#2563EB]/10 dark:bg-[#3B82F6]/15 text-[#2563EB] dark:text-[#60A5FA]'
                : 'border-[#CBD5E1] dark:border-[#2A3346] bg-white dark:bg-[#11151E] text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#181D29]'
            }`}
          >
            <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
            <span>{isBookmarked ? 'محفوظة' : 'حفظ المقالة'}</span>
          </button>
        </div>

        {/* Download feedback */}
        {downloadNotice && (
          <div className="px-6 py-3 border-b border-[#E2E8F0] dark:border-[#1F2737] bg-[#F8FAFC] dark:bg-[#0F131C] flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC]">
            <span>{downloadNotice}</span>
            {directPdfUrl && (
              <a
                href={directPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#2563EB] dark:text-[#60A5FA] font-semibold hover:underline underline-offset-4 whitespace-nowrap"
              >
                فتح رابط PDF الأصلي مباشرة
              </a>
            )}
          </div>
        )}

        {/* Inline PDF Preview Drawer */}
        {previewOpen && (
          <div className="border-b border-[#E2E8F0] dark:border-[#1F2737] bg-[#F1F5F9] dark:bg-[#090B10] p-4 sm:p-6">
            {previewLoading ? (
              <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-[#475569] dark:text-[#94A3B8]">
                <Loader2 className="h-5 w-5 animate-spin text-[#2563EB] dark:text-[#60A5FA]" />
                <span>جارٍ تجهيز معاينة ملف PDF...</span>
              </div>
            ) : previewError ? (
              <div className="rounded-xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                <span className="text-[#475569] dark:text-[#94A3B8]">{previewError}</span>
                <a
                  href={sciHubBoxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:underline whitespace-nowrap"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>فتح عبر sci-hub.box</span>
                </a>
              </div>
            ) : previewUrl ? (
              <div className="rounded-xl overflow-hidden border border-[#CBD5E1] dark:border-[#2A3346] bg-white">
                <iframe
                  src={previewUrl}
                  title={`معاينة ${doi}`}
                  className="w-full h-[560px]"
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Asymmetric 12-Column Result Workbench */}
        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x lg:divide-x-reverse divide-[#E2E8F0] dark:divide-[#1F2737]">
          {/* Main Content Column (8 cols) */}
          <div className="lg:col-span-8 p-6 sm:p-8 flex flex-col gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#64748B] dark:text-[#94A3B8] mb-2.5">
                {metadata.journal && (
                  <span className="font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                    {metadata.journal}
                  </span>
                )}
                {metadata.journal && metadata.year && <span aria-hidden="true">·</span>}
                {metadata.year && <span className="tabular-nums">{metadata.year}</span>}
                {volIssuePages && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{volIssuePages}</span>
                  </>
                )}
                {doiSource && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{doiSource}</span>
                  </>
                )}
              </div>

              <h3
                dir="auto"
                className="font-display text-2xl sm:text-[1.75rem] font-bold text-[#0F172A] dark:text-[#F8FAFC] leading-snug tracking-tight"
              >
                {metadata.title ?? `مقالة علمية (${doi})`}
              </h3>

              {metadata.authors.length > 0 && (
                <p dir="auto" className="mt-3 text-sm text-[#475569] dark:text-[#94A3B8] leading-relaxed">
                  {metadata.authors.join(' · ')}
                </p>
              )}
            </div>

            {abstractText && (
              <div className="pt-5 border-t border-[#F1F5F9] dark:border-[#1F2737]">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#475569] dark:text-[#94A3B8] mb-2">
                  <FileText className="h-3.5 w-3.5" />
                  <span>ملخص المقالة (Abstract)</span>
                </div>
                <p
                  dir="auto"
                  className="text-sm text-[#334155] dark:text-[#CBD5E1] leading-relaxed max-w-prose"
                >
                  {displayedAbstract}
                </p>
                {isLongAbstract && (
                  <button
                    type="button"
                    onClick={() => setShowFullAbstract((prev) => !prev)}
                    className="mt-2 text-xs font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:underline underline-offset-4 cursor-pointer"
                  >
                    {showFullAbstract ? 'عرض أقل' : 'قراءة الملخص كاملاً'}
                  </button>
                )}
              </div>
            )}

            {/* Citation Generator Workbench */}
            <div className="pt-5 border-t border-[#F1F5F9] dark:border-[#1F2737]">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <span className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  توليد الاقتباس الأكاديمي
                </span>

                <div className="flex flex-wrap items-center gap-2">
                  <div
                    role="tablist"
                    aria-label="صيغة الاقتباس"
                    className="inline-flex items-center gap-1 rounded-lg bg-[#F1F5F9] dark:bg-[#090B10] p-1"
                  >
                    {CITATION_FORMATS.map((fmt) => (
                      <button
                        key={fmt.id}
                        type="button"
                        role="tab"
                        aria-selected={citationFormat === fmt.id}
                        onClick={() => setCitationFormat(fmt.id)}
                        className={`rounded-md px-2.5 py-1 font-mono text-xs font-semibold transition-colors cursor-pointer ${
                          citationFormat === fmt.id
                            ? 'bg-white dark:bg-[#1E2534] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs'
                            : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                        }`}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleCopy(formattedCitation, 'citation')}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#2A3346] px-2.5 py-1.5 text-xs font-medium text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#181D29] transition-colors cursor-pointer"
                  >
                    {copiedKey === 'citation' ? (
                      <Check className="h-3.5 w-3.5 text-[#059669] dark:text-[#34D399]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    <span>{copiedKey === 'citation' ? 'تم النسخ' : 'نسخ'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadBibtex(doi, formatCitation(doi, metadata, 'bibtex'))
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#2A3346] px-2.5 py-1.5 text-xs font-medium text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#181D29] transition-colors cursor-pointer"
                  >
                    <FileCode2 className="h-3.5 w-3.5" />
                    <span>تنزيل .bib</span>
                  </button>
                </div>
              </div>

              <pre
                dir="ltr"
                className="rounded-xl border border-[#E2E8F0] dark:border-[#1F2737] bg-[#F8FAFC] dark:bg-[#090B10] p-3.5 text-xs text-[#334155] dark:text-[#CBD5E1] leading-relaxed text-left whitespace-pre-wrap font-mono"
              >
                {formattedCitation}
              </pre>
            </div>
          </div>

          {/* Action & Specification Sidebar (4 cols) */}
          <aside className="lg:col-span-4 bg-[#F8FAFC]/70 dark:bg-[#0D1017]/80 p-6 flex flex-col gap-5">
            <div className="flex flex-col gap-2.5">
              {available && directPdfUrl && (
                <>
                  <button
                    type="button"
                    onClick={() => handleDownloadPdf(directPdfUrl, doi)}
                    disabled={downloading}
                    className="w-full inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#059669] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#047857] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#059669] disabled:opacity-60 whitespace-nowrap cursor-pointer"
                  >
                    {downloading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    <span>{downloading ? 'جارٍ تحضير الملف...' : 'تحميل ملف PDF'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTogglePreview(directPdfUrl, doi)}
                    className="w-full inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-[#CBD5E1] dark:border-[#2A3346] bg-white dark:bg-[#11151E] px-4 py-2.5 text-sm font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#181D29] transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {previewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span>{previewOpen ? 'إخفاء المعاينة' : 'معاينة سريعة للـ PDF'}</span>
                  </button>
                </>
              )}

              <a
                href={sciHubBoxUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                  available && !directPdfUrl
                    ? 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
                    : 'border border-[#CBD5E1] dark:border-[#2A3346] bg-white dark:bg-[#11151E] text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#181D29]'
                }`}
              >
                <ExternalLink className="h-4 w-4" />
                <span>{available && !directPdfUrl ? 'تحميل من sci-hub.box' : 'فتح في sci-hub.box'}</span>
              </a>
            </div>

            <dl className="divide-y divide-[#E2E8F0] dark:divide-[#1F2737] border-t border-[#E2E8F0] dark:border-[#1F2737] text-xs">
              <div className="py-3 flex flex-col gap-1.5">
                <dt className="text-[#64748B] dark:text-[#94A3B8] font-medium">معرّف DOI</dt>
                <dd className="flex items-center justify-between gap-2">
                  <span dir="ltr" className="font-mono text-[#0F172A] dark:text-[#F8FAFC] font-semibold break-all">
                    {doi}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(doi, 'doi')}
                    aria-label="نسخ معرّف DOI"
                    className="shrink-0 rounded-md border border-[#E2E8F0] dark:border-[#2A3346] bg-white dark:bg-[#11151E] px-2 py-1 text-[11px] font-medium text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#181D29] cursor-pointer"
                  >
                    {copiedKey === 'doi' ? 'تم النسخ' : 'نسخ'}
                  </button>
                </dd>
              </div>

              {typeof metadata.citedByCount === 'number' && (
                <div className="py-3 flex items-center justify-between gap-2">
                  <dt className="text-[#64748B] dark:text-[#94A3B8] font-medium">الاستشهادات</dt>
                  <dd className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                    {metadata.citedByCount.toLocaleString('en-US')}
                  </dd>
                </div>
              )}

              {metadata.publisher && (
                <div className="py-3 flex items-center justify-between gap-3">
                  <dt className="text-[#64748B] dark:text-[#94A3B8] font-medium shrink-0">الناشر</dt>
                  <dd dir="auto" className="text-[#0F172A] dark:text-[#F8FAFC] font-medium text-left truncate">
                    {metadata.publisher}
                  </dd>
                </div>
              )}

              {sciHub?.fileSize && (
                <div className="py-3 flex items-center justify-between gap-2">
                  <dt className="text-[#64748B] dark:text-[#94A3B8] font-medium">حجم الملف</dt>
                  <dd dir="ltr" className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                    {sciHub.fileSize}
                  </dd>
                </div>
              )}

              {sciHub?.sha256 && (
                <div className="py-3 flex flex-col gap-1">
                  <dt className="text-[#64748B] dark:text-[#94A3B8] font-medium">بصمة SHA256</dt>
                  <dd dir="ltr" className="font-mono text-[11px] text-[#475569] dark:text-[#94A3B8] break-all">
                    {sciHub.sha256}
                  </dd>
                </div>
              )}
            </dl>
          </aside>
        </div>
      </motion.div>
    </section>
  );
}
