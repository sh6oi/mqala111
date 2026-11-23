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

  // Reset preview & notice when result changes
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
            'تعذّر التحميل عبر الوسيط الآلي نظراً لحماية الخادم المصدر. استخدم زر "فتح في sci-hub.box" أدناه.'
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
      <section aria-live="polite" className="mx-auto max-w-5xl pb-10">
        <div className="rounded-xl border border-[#E4DFD5] dark:border-[#272B33] bg-white dark:bg-[#181B21] p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-5">
            <Loader2 className="h-5 w-5 animate-spin text-[#1E3A8A] dark:text-[#60A5FA]" />
            <h2 className="text-base font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
              جارٍ فحص الرابط واستخراج البيانات...
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 border-t border-[#F0ECE3] dark:border-[#272B33] pt-5 text-sm text-[#57534E] dark:text-[#A8A29E]">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA] tabular-nums">
                01
              </span>
              <span>تحليل صفحة المقالة واستخراج معرّف DOI</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-semibold text-[#1E3A8A] dark:text-[#60A5FA] tabular-nums">
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
      <section aria-live="polite" className="mx-auto max-w-5xl pb-10">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="rounded-xl border border-[#E4DFD5] dark:border-[#272B33] bg-white dark:bg-[#181B21] p-6 sm:p-8"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-[#9A3412] dark:text-[#FB923C] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
                لم يتم العثور على معرّف DOI في هذا الرابط
              </h2>
              <p className="mt-1.5 text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                {result.error ??
                  'تعذّر استخراج معرّف DOI من الرابط المدخل. حاول نسخ معرّف DOI (مثل 10.1038/nature12373) ولصقه مباشرة في خانة البحث.'}
              </p>
              {result.metadata.title && (
                <p className="mt-3 text-xs text-[#57534E] dark:text-[#A8A29E]">
                  العنوان المستخرج من الصفحة:{' '}
                  <span className="text-[#1C1917] dark:text-[#F5F2EB] font-medium">
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
    <section aria-live="polite" className="mx-auto max-w-5xl pb-10">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
        className="rounded-xl border border-[#E4DFD5] dark:border-[#272B33] bg-white dark:bg-[#181B21] overflow-hidden"
      >
        {/* Availability Status Bar */}
        <div
          className={`flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-6 py-5 border-b border-[#E4DFD5] dark:border-[#272B33] ${
            available
              ? 'bg-[#F0FDF4]/70 dark:bg-[#13251B]/60'
              : 'bg-[#FAF7F2] dark:bg-[#15181E]'
          }`}
        >
          <div className="flex items-start gap-3">
            {available ? (
              <CheckCircle2 className="h-5 w-5 text-[#15803D] dark:text-[#4ADE80] shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-[#9A3412] dark:text-[#FB923C] shrink-0 mt-0.5" />
            )}
            <div>
              <h2 className="text-base font-bold text-[#1C1917] dark:text-[#F5F2EB]">
                {available ? 'المقالة متوفرة بصيغة PDF' : 'المقالة غير متوفرة حالياً للتحميل المباشر'}
              </h2>
              <p className="mt-1 text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">
                {sciHub?.message}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {available && directPdfUrl && (
              <>
                <button
                  type="button"
                  onClick={() => handleDownloadPdf(directPdfUrl, doi)}
                  disabled={downloading}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#15803D] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#166534] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#15803D] disabled:opacity-60 whitespace-nowrap cursor-pointer"
                >
                  {downloading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  <span>{downloading ? 'جارٍ التحضير...' : 'تحميل ملف PDF'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTogglePreview(directPdfUrl, doi)}
                  className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-[#D6CEBE] dark:border-[#323741] bg-white dark:bg-[#181B21] px-4 py-2.5 text-sm font-medium text-[#1C1917] dark:text-[#F5F2EB] hover:bg-[#F3EFE7] dark:hover:bg-[#232730] transition-colors whitespace-nowrap cursor-pointer"
                >
                  {previewOpen ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  <span>{previewOpen ? 'إخفاء المعاينة' : 'معاينة PDF'}</span>
                </button>
              </>
            )}

            <a
              href={sciHubBoxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                available && !directPdfUrl
                  ? 'bg-[#1E3A8A] dark:bg-[#3B82F6] text-white hover:bg-[#172E6E] dark:hover:bg-[#2563EB]'
                  : 'border border-[#D6CEBE] dark:border-[#323741] bg-white dark:bg-[#181B21] text-[#1C1917] dark:text-[#F5F2EB] hover:bg-[#F3EFE7] dark:hover:bg-[#232730]'
              }`}
            >
              <ExternalLink className="h-4 w-4" />
              <span>{available && !directPdfUrl ? 'تحميل من sci-hub.box' : 'فتح في sci-hub.box'}</span>
            </a>

            <button
              type="button"
              onClick={() => onToggleBookmark(doi)}
              aria-label={isBookmarked ? 'إزالة من المحفوظات' : 'حفظ في المحفوظات'}
              title={isBookmarked ? 'إزالة من المحفوظات' : 'حفظ في المحفوظات'}
              className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border px-3.5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                isBookmarked
                  ? 'border-[#1E3A8A] dark:border-[#60A5FA] bg-[#1E3A8A]/10 dark:bg-[#3B82F6]/15 text-[#1E3A8A] dark:text-[#60A5FA]'
                  : 'border-[#D6CEBE] dark:border-[#323741] bg-white dark:bg-[#181B21] text-[#57534E] dark:text-[#A8A29E] hover:bg-[#F3EFE7] dark:hover:bg-[#232730]'
              }`}
            >
              <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-current' : ''}`} />
              <span>{isBookmarked ? 'محفوظة' : 'حفظ'}</span>
            </button>
          </div>
        </div>

        {/* Download feedback */}
        {downloadNotice && (
          <div className="px-6 py-3 border-b border-[#E4DFD5] dark:border-[#272B33] bg-[#FBF9F5] dark:bg-[#15181E] flex flex-wrap items-center justify-between gap-3 text-sm text-[#1C1917] dark:text-[#F5F2EB]">
            <span>{downloadNotice}</span>
            {directPdfUrl && (
              <a
                href={directPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A8A] dark:text-[#60A5FA] font-medium hover:underline underline-offset-4 whitespace-nowrap"
              >
                فتح رابط PDF الأصلي مباشرة
              </a>
            )}
          </div>
        )}

        {/* Inline PDF Preview Drawer */}
        {previewOpen && (
          <div className="border-b border-[#E4DFD5] dark:border-[#272B33] bg-[#F3EFE7] dark:bg-[#111317] p-4 sm:p-6">
            {previewLoading ? (
              <div className="flex items-center justify-center gap-2.5 py-16 text-sm text-[#57534E] dark:text-[#A8A29E]">
                <Loader2 className="h-5 w-5 animate-spin text-[#1E3A8A] dark:text-[#60A5FA]" />
                <span>جارٍ تجهيز معاينة ملف PDF...</span>
              </div>
            ) : previewError ? (
              <div className="rounded-lg border border-[#E4DFD5] dark:border-[#272B33] bg-white dark:bg-[#181B21] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                <span className="text-[#57534E] dark:text-[#A8A29E]">{previewError}</span>
                <a
                  href={sciHubBoxUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 font-semibold text-[#1E3A8A] dark:text-[#60A5FA] hover:underline whitespace-nowrap"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>فتح عبر sci-hub.box</span>
                </a>
              </div>
            ) : previewUrl ? (
              <div className="rounded-lg overflow-hidden border border-[#D6CEBE] dark:border-[#323741] bg-white">
                <iframe
                  src={previewUrl}
                  title={`معاينة ${doi}`}
                  className="w-full h-[560px]"
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Editorial Article Metadata & DOI Details */}
        <div className="p-6 sm:p-8">
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#57534E] dark:text-[#A8A29E] mb-2.5">
              {metadata.journal && (
                <span className="font-semibold text-[#1C1917] dark:text-[#F5F2EB]">
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
              {typeof metadata.citedByCount === 'number' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    الاستشهادات: {metadata.citedByCount.toLocaleString('en-US')}
                  </span>
                </>
              )}
              {doiSource && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>المصدر: {doiSource}</span>
                </>
              )}
            </div>

            <h3
              dir="auto"
              className="font-serif text-2xl sm:text-3xl font-bold text-[#1C1917] dark:text-[#F5F2EB] leading-snug"
            >
              {metadata.title ?? `مقالة علمية (${doi})`}
            </h3>

            {metadata.authors.length > 0 && (
              <p dir="auto" className="mt-2.5 text-sm text-[#57534E] dark:text-[#A8A29E]">
                {metadata.authors.join(' · ')}
              </p>
            )}
          </div>

          <dl className="divide-y divide-[#F0ECE3] dark:divide-[#272B33] border-t border-b border-[#F0ECE3] dark:border-[#272B33] text-sm">
            <div className="py-3.5 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
              <dt className="font-medium text-[#57534E] dark:text-[#A8A29E]">معرّف DOI المستخرج</dt>
              <dd className="sm:col-span-3 flex flex-wrap items-center justify-between gap-2">
                <span
                  dir="ltr"
                  className="font-mono text-[#1C1917] dark:text-[#F5F2EB] font-medium break-all"
                >
                  {doi}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(doi, 'doi')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#E4DFD5] dark:border-[#323741] px-2.5 py-1 text-xs font-medium text-[#57534E] dark:text-[#D6D3CD] hover:bg-[#F3EFE7] dark:hover:bg-[#232730] hover:text-[#1C1917] dark:hover:text-[#F5F2EB] transition-colors cursor-pointer"
                >
                  {copiedKey === 'doi' ? (
                    <Check className="h-3.5 w-3.5 text-[#15803D] dark:text-[#4ADE80]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedKey === 'doi' ? 'تم النسخ' : 'نسخ DOI'}</span>
                </button>
              </dd>
            </div>

            {metadata.publisher && (
              <div className="py-3.5 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                <dt className="font-medium text-[#57534E] dark:text-[#A8A29E]">الناشر</dt>
                <dd dir="auto" className="sm:col-span-3 text-[#1C1917] dark:text-[#F5F2EB]">
                  {metadata.publisher}
                </dd>
              </div>
            )}

            {sciHub?.fileSize && (
              <div className="py-3.5 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                <dt className="font-medium text-[#57534E] dark:text-[#A8A29E]">حجم ملف PDF</dt>
                <dd
                  dir="ltr"
                  className="sm:col-span-3 font-mono text-[#1C1917] dark:text-[#F5F2EB] tabular-nums text-right sm:text-left"
                >
                  {sciHub.fileSize}
                </dd>
              </div>
            )}

            {sciHub?.sha256 && (
              <div className="py-3.5 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                <dt className="font-medium text-[#57534E] dark:text-[#A8A29E]">بصمة الملف (SHA256)</dt>
                <dd
                  dir="ltr"
                  className="sm:col-span-3 font-mono text-xs text-[#57534E] dark:text-[#A8A29E] break-all"
                >
                  {sciHub.sha256}
                </dd>
              </div>
            )}

            {/* Multi-format Citation Generator */}
            <div className="py-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-start">
              <dt className="font-medium text-[#57534E] dark:text-[#A8A29E] pt-1">
                الاقتباس الأكاديمي
              </dt>
              <dd className="sm:col-span-3 flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div
                    role="tablist"
                    aria-label="صيغة الاقتباس"
                    className="inline-flex items-center gap-1 rounded-lg bg-[#F3EFE7] dark:bg-[#111317] p-1"
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
                            ? 'bg-white dark:bg-[#232730] text-[#1C1917] dark:text-[#F5F2EB] shadow-xs'
                            : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EB]'
                        }`}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(formattedCitation, 'citation')}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#E4DFD5] dark:border-[#323741] px-2.5 py-1 text-xs font-medium text-[#57534E] dark:text-[#D6D3CD] hover:bg-[#F3EFE7] dark:hover:bg-[#232730] hover:text-[#1C1917] dark:hover:text-[#F5F2EB] transition-colors cursor-pointer"
                    >
                      {copiedKey === 'citation' ? (
                        <Check className="h-3.5 w-3.5 text-[#15803D] dark:text-[#4ADE80]" />
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
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#E4DFD5] dark:border-[#323741] px-2.5 py-1 text-xs font-medium text-[#57534E] dark:text-[#D6D3CD] hover:bg-[#F3EFE7] dark:hover:bg-[#232730] hover:text-[#1C1917] dark:hover:text-[#F5F2EB] transition-colors cursor-pointer"
                    >
                      <FileCode2 className="h-3.5 w-3.5" />
                      <span>تنزيل .bib</span>
                    </button>
                  </div>
                </div>

                <pre
                  dir="ltr"
                  className="rounded-lg border border-[#E4DFD5] dark:border-[#272B33] bg-[#FBF9F5] dark:bg-[#111317] p-3 text-xs text-[#44403C] dark:text-[#D6D3CD] leading-relaxed text-left whitespace-pre-wrap font-mono"
                >
                  {formattedCitation}
                </pre>
              </dd>
            </div>
          </dl>

          {abstractText && (
            <div className="mt-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#57534E] dark:text-[#A8A29E] mb-2">
                <FileText className="h-3.5 w-3.5" />
                <span>ملخص المقالة (Abstract)</span>
              </div>
              <p
                dir="auto"
                className="text-sm text-[#44403C] dark:text-[#D6D3CD] leading-relaxed max-w-prose"
              >
                {displayedAbstract}
              </p>
              {isLongAbstract && (
                <button
                  type="button"
                  onClick={() => setShowFullAbstract((prev) => !prev)}
                  className="mt-2 text-xs font-medium text-[#1E3A8A] dark:text-[#60A5FA] hover:underline underline-offset-4 cursor-pointer"
                >
                  {showFullAbstract ? 'عرض أقل' : 'قراءة الملخص كاملاً'}
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </section>
  );
}
