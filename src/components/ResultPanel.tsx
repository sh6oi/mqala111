import { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  XCircle,
} from 'lucide-react';
import type { LookupResponse } from '../types.ts';

interface ResultPanelProps {
  isLoading: boolean;
  result: LookupResponse | null;
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

export function ResultPanel({ isLoading, result }: ResultPanelProps) {
  const [copiedKey, setCopiedKey] = useState<'doi' | 'citation' | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [showFullAbstract, setShowFullAbstract] = useState(false);

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
            'تعذّر التحميل عبر الوسيط الآلي نظراً لحماية الخادم المصدر. استخدم زر "فتح وتحميل عبر sci-hub.box" أدناه.'
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

  if (isLoading) {
    return (
      <section aria-live="polite" className="mx-auto max-w-4xl pb-10">
        <div className="rounded-xl border border-[#E4DFD5] bg-white p-6 sm:p-8">
          <div className="flex items-center gap-3 mb-5">
            <Loader2 className="h-5 w-5 animate-spin text-[#1E3A8A]" />
            <h2 className="text-base font-semibold text-[#1C1917]">
              جارٍ فحص الرابط واستخراج البيانات...
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 border-t border-[#F0ECE3] pt-5 text-sm text-[#57534E]">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-semibold text-[#1E3A8A] tabular-nums">01</span>
              <span>تحليل صفحة المقالة واستخراج معرّف DOI</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-xs font-semibold text-[#1E3A8A] tabular-nums">02</span>
              <span>البحث عن المقالة في sci-hub.box والتحقق من PDF</span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (!result) {
    return null;
  }

  // Case 1: DOI extraction failed
  if (!result.doi) {
    return (
      <section aria-live="polite" className="mx-auto max-w-4xl pb-10">
        <div className="rounded-xl border border-[#E4DFD5] bg-white p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-[#9A3412] shrink-0 mt-0.5" />
            <div>
              <h2 className="text-base font-semibold text-[#1C1917]">
                لم يتم العثور على معرّف DOI في هذا الرابط
              </h2>
              <p className="mt-1.5 text-sm text-[#57534E] leading-relaxed">
                {result.error ??
                  'تعذّر استخراج معرّف DOI من الرابط المدخل. حاول نسخ معرّف DOI (مثل 10.1038/nature12373) ولصقه مباشرة في خانة البحث.'}
              </p>
              {result.metadata.title && (
                <p className="mt-3 text-xs text-[#57534E]">
                  العنوان المستخرج من الصفحة: <span className="text-[#1C1917] font-medium">{result.metadata.title}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  const { doi, doiSource, metadata, sciHub } = result;
  const available = Boolean(sciHub?.available);
  const directPdfUrl = isSafeExternalUrl(sciHub?.pdfUrl) ? sciHub.pdfUrl : null;
  const sciHubBoxUrl = isSafeExternalUrl(sciHub?.sciHubBoxUrl)
    ? sciHub.sciHubBoxUrl
    : `https://sci-hub.box/${encodeURI(doi)}`;

  const abstractText = metadata.abstract ?? '';
  const isLongAbstract = abstractText.length > 320;
  const displayedAbstract =
    isLongAbstract && !showFullAbstract ? `${abstractText.slice(0, 320)}...` : abstractText;

  return (
    <section aria-live="polite" className="mx-auto max-w-4xl pb-10">
      <div className="rounded-xl border border-[#E4DFD5] bg-white overflow-hidden">
        {/* Availability Status Bar */}
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-5 border-b border-[#E4DFD5] ${
            available ? 'bg-[#F0FDF4]/60' : 'bg-[#FAF7F2]'
          }`}
        >
          <div className="flex items-start gap-3">
            {available ? (
              <CheckCircle2 className="h-5 w-5 text-[#15803D] shrink-0 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-[#9A3412] shrink-0 mt-0.5" />
            )}
            <div>
              <h2 className="text-base font-bold text-[#1C1917]">
                {available ? 'المقالة متوفرة بصيغة PDF' : 'المقالة غير متوفرة حالياً للتحميل المباشر'}
              </h2>
              <p className="mt-1 text-sm text-[#57534E] leading-relaxed">
                {sciHub?.message}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {available && directPdfUrl && (
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
                <span>{downloading ? 'جارٍ تحضير الملف...' : 'تحميل ملف PDF'}</span>
              </button>
            )}

            <a
              href={sciHubBoxUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                available && !directPdfUrl
                  ? 'bg-[#1E3A8A] text-white hover:bg-[#172E6E]'
                  : 'border border-[#D6CEBE] bg-white text-[#1C1917] hover:bg-[#F3EFE7]'
              }`}
            >
              <ExternalLink className="h-4 w-4" />
              <span>{available && !directPdfUrl ? 'تحميل من sci-hub.box' : 'فتح في sci-hub.box'}</span>
            </a>
          </div>
        </div>

        {/* Download feedback or fallback notice */}
        {downloadNotice && (
          <div className="px-6 py-3 border-b border-[#E4DFD5] bg-[#FBF9F5] flex flex-wrap items-center justify-between gap-3 text-sm text-[#1C1917]">
            <span>{downloadNotice}</span>
            {directPdfUrl && (
              <a
                href={directPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1E3A8A] font-medium hover:underline underline-offset-4 whitespace-nowrap"
              >
                فتح رابط PDF الأصلي مباشرة
              </a>
            )}
          </div>
        )}

        {/* Article Metadata & DOI Details */}
        <div className="p-6 sm:p-8">
          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#57534E] mb-2">
              {metadata.journal && <span className="font-medium text-[#1C1917]">{metadata.journal}</span>}
              {metadata.journal && metadata.year && <span aria-hidden="true">·</span>}
              {metadata.year && <span className="tabular-nums">{metadata.year}</span>}
              {(metadata.journal || metadata.year) && doiSource && <span aria-hidden="true">·</span>}
              {doiSource && <span>مصدر الاستخراج: {doiSource}</span>}
            </div>

            <h3 dir="auto" className="font-serif text-2xl sm:text-3xl font-bold text-[#1C1917] leading-snug">
              {metadata.title ?? `مقالة علمية (${doi})`}
            </h3>

            {metadata.authors.length > 0 && (
              <p dir="auto" className="mt-2.5 text-sm text-[#57534E]">
                {metadata.authors.join(' · ')}
              </p>
            )}
          </div>

          <dl className="divide-y divide-[#F0ECE3] border-t border-b border-[#F0ECE3] text-sm">
            <div className="py-3.5 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
              <dt className="font-medium text-[#57534E]">معرّف DOI المستخرج</dt>
              <dd className="sm:col-span-3 flex flex-wrap items-center justify-between gap-2">
                <span dir="ltr" className="font-mono text-[#1C1917] font-medium break-all">
                  {doi}
                </span>
                <button
                  type="button"
                  onClick={() => handleCopy(doi, 'doi')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#E4DFD5] px-2.5 py-1 text-xs font-medium text-[#57534E] hover:bg-[#F3EFE7] hover:text-[#1C1917] transition-colors cursor-pointer"
                >
                  {copiedKey === 'doi' ? <Check className="h-3.5 w-3.5 text-[#15803D]" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey === 'doi' ? 'تم النسخ' : 'نسخ DOI'}</span>
                </button>
              </dd>
            </div>

            {sciHub?.fileSize && (
              <div className="py-3.5 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                <dt className="font-medium text-[#57534E]">حجم ملف PDF</dt>
                <dd dir="ltr" className="sm:col-span-3 font-mono text-[#1C1917] tabular-nums text-right sm:text-left">
                  {sciHub.fileSize}
                </dd>
              </div>
            )}

            {sciHub?.sha256 && (
              <div className="py-3.5 grid grid-cols-1 sm:grid-cols-4 gap-2 items-center">
                <dt className="font-medium text-[#57534E]">بصمة الملف (SHA256)</dt>
                <dd dir="ltr" className="sm:col-span-3 font-mono text-xs text-[#57534E] break-all">
                  {sciHub.sha256}
                </dd>
              </div>
            )}

            {metadata.citation && (
              <div className="py-3.5 grid grid-cols-1 sm:grid-cols-4 gap-2 items-start">
                <dt className="font-medium text-[#57534E] pt-0.5">الاقتباس الأكاديمي</dt>
                <dd className="sm:col-span-3 flex flex-col gap-2">
                  <span dir="ltr" className="text-xs text-[#57534E] leading-relaxed text-left">
                    {metadata.citation}
                  </span>
                  <div>
                    <button
                      type="button"
                      onClick={() => handleCopy(metadata.citation!, 'citation')}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#E4DFD5] px-2.5 py-1 text-xs font-medium text-[#57534E] hover:bg-[#F3EFE7] hover:text-[#1C1917] transition-colors cursor-pointer"
                    >
                      {copiedKey === 'citation' ? (
                        <Check className="h-3.5 w-3.5 text-[#15803D]" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      <span>{copiedKey === 'citation' ? 'تم نسخ الاقتباس' : 'نسخ الاقتباس'}</span>
                    </button>
                  </div>
                </dd>
              </div>
            )}
          </dl>

          {abstractText && (
            <div className="mt-5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#57534E] mb-2">
                <FileText className="h-3.5 w-3.5" />
                <span>ملخص المقالة (Abstract)</span>
              </div>
              <p dir="auto" className="text-sm text-[#44403C] leading-relaxed max-w-prose">
                {displayedAbstract}
              </p>
              {isLongAbstract && (
                <button
                  type="button"
                  onClick={() => setShowFullAbstract((prev) => !prev)}
                  className="mt-2 text-xs font-medium text-[#1E3A8A] hover:underline underline-offset-4 cursor-pointer"
                >
                  {showFullAbstract ? 'عرض أقل' : 'قراءة الملخص كاملاً'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
