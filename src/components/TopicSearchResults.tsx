import { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  AlertTriangle,
  Bookmark,
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Loader2,
  Quote,
  ShieldAlert,
} from 'lucide-react';
import type {
  ArticlePdfCheckResponse,
  ArticleSearchResponse,
  SearchArticleResult,
} from '../types.ts';

interface TopicSearchResultsProps {
  isLoading: boolean;
  searchResult: ArticleSearchResponse | null;
  bookmarkedDois: Set<string>;
  onToggleBookmark: (article: SearchArticleResult, pdfStatus?: ArticlePdfCheckResponse) => void;
  onRecordDownloadAttempt: (article: SearchArticleResult, pdfStatus: ArticlePdfCheckResponse) => void;
}

type SortBy = 'relevance' | 'citations' | 'newest';

interface CardPdfState {
  status: 'idle' | 'checking' | 'downloaded' | 'sci-hub-manual' | 'paid-unavailable' | 'error';
  message?: string;
  sciHubBoxUrl?: string | null;
  pdfUrl?: string | null;
  doi?: string | null;
  fileSize?: string | null;
  sha256?: string | null;
  md5?: string | null;
  showInlinePreview?: boolean;
  isDownloadingFile?: boolean;
}

export function TopicSearchResults({
  isLoading,
  searchResult,
  bookmarkedDois,
  onToggleBookmark,
  onRecordDownloadAttempt,
}: TopicSearchResultsProps) {
  const [engineFilter, setEngineFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('relevance');
  const [pdfStates, setPdfStates] = useState<Record<string, CardPdfState>>({});
  const [copiedPdfId, setCopiedPdfId] = useState<string | null>(null);

  const triggerDirectBlobDownload = async (
    article: SearchArticleResult,
    pdfUrl: string,
    doi: string | null,
    isSciHubSource: boolean,
    meta?: { sciHubBoxUrl?: string | null; fileSize?: string | null; sha256?: string | null; md5?: string | null }
  ) => {
    const effectiveDoi = doi ?? article.doi ?? article.id;
    const dlEndpoint = `/api/download?url=${encodeURIComponent(pdfUrl)}&doi=${encodeURIComponent(effectiveDoi)}`;

    setPdfStates((prev) => ({
      ...prev,
      [article.id]: {
        ...(prev[article.id] ?? { status: 'checking' }),
        isDownloadingFile: true,
      },
    }));

    try {
      const dlRes = await fetch(dlEndpoint);
      const contentType = (dlRes.headers.get('content-type') ?? '').toLowerCase();

      if (dlRes.ok && contentType.includes('application/pdf')) {
        const blob = await dlRes.blob();
        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = `${effectiveDoi.replace(/[^a-zA-Z0-9._-]+/g, '_')}.pdf`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);

        setPdfStates((prev) => ({
          ...prev,
          [article.id]: {
            status: 'downloaded',
            message: isSciHubSource
              ? 'تم تحميل ملف PDF من Sci-Hub مباشرة إلى جهازك. يمكنك أيضاً معاينته وفحصه يدوياً أدناه.'
              : 'تم استخراج رابط PDF المباشر من المقالة وتحميل الملف مباشرة إلى جهازك.',
            sciHubBoxUrl: meta?.sciHubBoxUrl,
            pdfUrl,
            doi: effectiveDoi,
            fileSize: meta?.fileSize,
            sha256: meta?.sha256,
            md5: meta?.md5,
            showInlinePreview: prev[article.id]?.showInlinePreview ?? false,
            isDownloadingFile: false,
          },
        }));
      } else {
        setPdfStates((prev) => ({
          ...prev,
          [article.id]: {
            status: 'paid-unavailable',
            message: 'هذه المقالة غير مجانية، مدفوعة وغير مجانية ولا يمكن تحميلها بصيغة PDF.',
            sciHubBoxUrl: meta?.sciHubBoxUrl,
            doi: effectiveDoi,
            isDownloadingFile: false,
          },
        }));
      }
    } catch {
      setPdfStates((prev) => ({
        ...prev,
        [article.id]: {
          status: 'error',
          message: 'تعذّر تنزيل ملف PDF من الخادم. يرجى المحاولة مرة أخرى.',
          isDownloadingFile: false,
        },
      }));
    }
  };

  const handleDownloadArticlePdf = async (article: SearchArticleResult) => {
    setPdfStates((prev) => ({
      ...prev,
      [article.id]: {
        status: 'checking',
        message: 'جارٍ استخراج رابط PDF المباشر من المقالة والتحقق من الصلاحية...',
      },
    }));

    try {
      const checkRes = await fetch('/api/article-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doi: article.doi,
          articleUrl: article.articleUrl,
          title: article.title,
          openAccessPdfUrl: article.openAccessPdfUrl,
          pdfCandidates: article.pdfCandidates ?? [],
        }),
      });

      const data: ArticlePdfCheckResponse = await checkRes.json();
      onRecordDownloadAttempt(article, data);

      if (!data.available || !data.pdfUrl) {
        setPdfStates((prev) => ({
          ...prev,
          [article.id]: {
            status: 'paid-unavailable',
            message:
              'هذه المقالة غير مجانية، مدفوعة وغير مجانية ولا يمكن تحميلها (غير متوفرة مجاناً من المقالة أو في Sci-Hub بصيغة PDF).',
            sciHubBoxUrl: data.sciHubBoxUrl,
            doi: data.doi,
          },
        }));
        return;
      }

      // If sourced from Sci-Hub, present manual inspection & verification panel inside the page
      if (data.source === 'sci-hub' || data.requiresManualSciHubCheck) {
        setPdfStates((prev) => ({
          ...prev,
          [article.id]: {
            status: 'sci-hub-manual',
            message:
              'هذه النسخة مصدرها Sci-Hub وليس رابطاً مباشراً من الناشر — يمكنك فحصها ومعاينتها يدوياً هنا أو تحميلها مباشرة إلى جهازك.',
            sciHubBoxUrl: data.sciHubBoxUrl,
            pdfUrl: data.pdfUrl,
            doi: data.doi,
            fileSize: data.fileSize,
            sha256: data.sha256,
            md5: data.md5,
            showInlinePreview: false,
          },
        }));
        return;
      }

      // Direct PDF link from the article itself -> download immediately without leaving the page!
      await triggerDirectBlobDownload(article, data.pdfUrl, data.doi, false, {
        sciHubBoxUrl: data.sciHubBoxUrl,
      });
    } catch {
      setPdfStates((prev) => ({
        ...prev,
        [article.id]: {
          status: 'error',
          message: 'تعذّر الاتصال بالخادم أثناء استخراج رابط PDF. يرجى المحاولة مرة أخرى.',
        },
      }));
    }
  };

  const handleCopyDirectPdf = async (articleId: string, pdfUrl: string) => {
    try {
      await navigator.clipboard.writeText(pdfUrl);
      setCopiedPdfId(articleId);
      setTimeout(() => setCopiedPdfId(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const togglePreview = (articleId: string) => {
    setPdfStates((prev) => ({
      ...prev,
      [articleId]: {
        ...(prev[articleId] ?? { status: 'idle' }),
        showInlinePreview: !prev[articleId]?.showInlinePreview,
      },
    }));
  };

  if (isLoading) {
    return (
      <section aria-live="polite" className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 pb-4">
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] p-6 sm:p-8 shadow-sm shadow-slate-900/[0.03]">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="h-5 w-5 animate-spin text-[#2563EB] dark:text-[#60A5FA]" />
            <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">
              جارٍ البحث الدقيق في محركات المقالات العلمية...
            </h2>
          </div>
          <p className="text-sm text-[#475569] dark:text-[#94A3B8]">
            نبحث بالتوازي في OpenAlex وCrossref وEurope PMC وarXiv وDOAJ ونطابق العناوين ونطاق السنوات المحدد.
          </p>
        </div>
      </section>
    );
  }

  if (!searchResult) return null;

  if (!searchResult.success) {
    return (
      <section aria-live="polite" className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 pb-4">
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-[#C2410C] dark:text-[#FB923C] shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">تعذّر إتمام البحث</h2>
            <p className="mt-1 text-sm text-[#475569] dark:text-[#94A3B8]">{searchResult.error}</p>
          </div>
        </div>
      </section>
    );
  }

  const availableEngines = ['OpenAlex', 'Crossref', 'Europe PMC', 'arXiv', 'DOAJ'].filter((eng) =>
    searchResult.articles.some((a) => a.sourceEngine.includes(eng))
  );

  const filteredArticles = searchResult.articles
    .filter((a) => (engineFilter === 'all' ? true : a.sourceEngine.includes(engineFilter)))
    .sort((a, b) => {
      if (sortBy === 'citations') return (b.citedByCount ?? -1) - (a.citedByCount ?? -1);
      if (sortBy === 'newest') return Number(b.year ?? 0) - Number(a.year ?? 0);
      return b.similarityScore - a.similarityScore;
    });

  const yearLabel =
    searchResult.yearFrom || searchResult.yearTo
      ? `${searchResult.yearFrom ?? '...'} – ${searchResult.yearTo ?? '...'}`
      : null;

  return (
    <section aria-live="polite" className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 pb-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5">
        <div>
          <h2 className="font-display text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
            نتائج البحث عن المقالات العلمية
          </h2>
          <p className="text-sm text-[#475569] dark:text-[#94A3B8] mt-1 tabular-nums">
            تم العثور على {searchResult.totalResults} مقالة قريبة من «{searchResult.query}»
            {yearLabel && (
              <>
                {' '}
                · السنوات:{' '}
                <span dir="ltr" className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC]">
                  {yearLabel}
                </span>
              </>
            )}{' '}
            · عبر{' '}
            <span dir="ltr" className="font-mono text-xs text-[#0F172A] dark:text-[#CBD5E1]">
              {searchResult.enginesSearched.join(' · ')}
            </span>
          </p>
        </div>

        {searchResult.articles.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="ترتيب النتائج"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="min-h-[38px] rounded-xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] focus:border-[#2563EB] focus:outline-none cursor-pointer"
            >
              <option value="relevance">الأقرب لعنوان البحث</option>
              <option value="citations">الأكثر استشهاداً</option>
              <option value="newest">الأحدث نشراً</option>
            </select>
          </div>
        )}
      </div>

      {availableEngines.length > 1 && (
        <div className="mb-5 flex flex-wrap items-center gap-1 rounded-xl border border-[#E2E8F0] dark:border-[#1F2737] bg-[#F1F5F9] dark:bg-[#11151E] p-1 w-fit">
          <button
            type="button"
            onClick={() => setEngineFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
              engineFilter === 'all'
                ? 'bg-white dark:bg-[#1E2534] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs'
                : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
            }`}
          >
            جميع المحركات ({searchResult.articles.length})
          </button>
          {availableEngines.map((eng) => (
            <button
              key={eng}
              type="button"
              onClick={() => setEngineFilter(eng)}
              className={`rounded-lg px-3 py-1.5 font-mono text-xs font-medium transition-colors cursor-pointer ${
                engineFilter === eng
                  ? 'bg-white dark:bg-[#1E2534] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs'
                  : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
              }`}
            >
              {eng}
            </button>
          ))}
        </div>
      )}

      {filteredArticles.length === 0 ? (
        <div className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] p-8 text-center text-sm text-[#475569] dark:text-[#94A3B8]">
          لم يتم العثور على مقالات مطابقة ضمن نطاق السنوات المحدد. جرّب توسيع سنوات النشر أو استخدام كلمات مفتاحية أكثر عمومية.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredArticles.map((article) => {
            const pdfState = pdfStates[article.id] ?? { status: 'idle' };
            const isBookmarked = Boolean(article.doi && bookmarkedDois.has(article.doi));
            const previewUrl =
              pdfState.pdfUrl
                ? `/api/download?url=${encodeURIComponent(pdfState.pdfUrl)}&doi=${encodeURIComponent(
                    pdfState.doi ?? article.doi ?? article.id
                  )}&inline=1`
                : null;

            return (
              <motion.article
                key={article.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
                className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] p-5 sm:p-6 shadow-sm shadow-slate-900/[0.02] hover:border-[#CBD5E1] dark:hover:border-[#2A3346] transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-5">
                  {/* Article Details */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#64748B] dark:text-[#94A3B8] mb-2">
                      <span className="font-semibold text-[#2563EB] dark:text-[#60A5FA] tabular-nums">
                        نسبة القرب {article.similarityScore}%
                      </span>
                      {article.openAccessPdfUrl && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 font-semibold text-[#059669] dark:text-[#34D399]">
                            <FileText className="h-3.5 w-3.5" />
                            <span>رابط PDF مباشر من المقالة</span>
                          </span>
                        </>
                      )}
                      {article.venue && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span dir="auto" className="font-medium text-[#0F172A] dark:text-[#CBD5E1]">
                            {article.venue}
                          </span>
                        </>
                      )}
                      {article.doi && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span dir="ltr" className="font-mono text-[#475569] dark:text-[#94A3B8]">
                            {article.doi}
                          </span>
                        </>
                      )}
                    </div>

                    <h3
                      dir="auto"
                      className="font-display text-lg sm:text-xl font-bold text-[#0F172A] dark:text-[#F8FAFC] leading-snug"
                    >
                      {article.title}
                    </h3>

                    {article.authors.length > 0 && (
                      <p dir="auto" className="mt-1.5 text-xs sm:text-sm text-[#475569] dark:text-[#94A3B8]">
                        {article.authors.join(' · ')}
                      </p>
                    )}

                    {/* Required Metadata Grid */}
                    <div className="mt-4 pt-3.5 border-t border-[#F1F5F9] dark:border-[#1F2737] grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 text-xs">
                      <div className="flex items-center gap-2 text-[#475569] dark:text-[#94A3B8]">
                        <Calendar className="h-3.5 w-3.5 text-[#64748B] shrink-0" />
                        <span>تاريخ النشر:</span>
                        <span className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                          {article.publishedDate ?? article.year ?? 'غير محدد'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[#475569] dark:text-[#94A3B8]">
                        <Globe className="h-3.5 w-3.5 text-[#64748B] shrink-0" />
                        <span>المصدر:</span>
                        <span dir="ltr" className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                          {article.sourceEngine}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-[#475569] dark:text-[#94A3B8]">
                        <Quote className="h-3.5 w-3.5 text-[#64748B] shrink-0" />
                        <span>الاستشهادات:</span>
                        <span className="font-mono font-semibold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                          {typeof article.citedByCount === 'number'
                            ? article.citedByCount.toLocaleString('en-US')
                            : 'غير متاح'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <ExternalLink className="h-3.5 w-3.5 text-[#2563EB] dark:text-[#60A5FA] shrink-0" />
                        <a
                          href={article.articleUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-[#2563EB] dark:text-[#60A5FA] hover:underline underline-offset-4 truncate"
                        >
                          رابط المقالة الأصلي
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex flex-row lg:flex-col items-stretch gap-2 shrink-0 lg:w-52">
                    <button
                      type="button"
                      onClick={() => handleDownloadArticlePdf(article)}
                      disabled={pdfState.status === 'checking' || pdfState.isDownloadingFile}
                      className="flex-1 lg:flex-none inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#059669] px-4 py-2.5 text-xs sm:text-sm font-semibold text-white transition-colors hover:bg-[#047857] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#059669] disabled:opacity-60 whitespace-nowrap cursor-pointer"
                    >
                      {pdfState.status === 'checking' || pdfState.isDownloadingFile ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      <span>
                        {pdfState.status === 'checking'
                          ? 'جارٍ استخراج PDF...'
                          : pdfState.isDownloadingFile
                          ? 'جارٍ التنزيل...'
                          : 'تحميل ملف PDF'}
                      </span>
                    </button>

                    <div className="flex items-center gap-2">
                      <a
                        href={article.articleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex min-h-[38px] items-center justify-center gap-1.5 rounded-xl border border-[#CBD5E1] dark:border-[#2A3346] bg-[#F8FAFC] dark:bg-[#090B10] px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:text-[#F8FAFC] hover:bg-[#F1F5F9] dark:hover:bg-[#181D29] transition-colors whitespace-nowrap"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        <span>صفحة المقالة</span>
                      </a>

                      {article.doi && (
                        <button
                          type="button"
                          onClick={() => onToggleBookmark(article)}
                          aria-label={isBookmarked ? 'إزالة من المحفوظات' : 'حفظ المقالة'}
                          title={isBookmarked ? 'إزالة من المحفوظات' : 'حفظ المقالة'}
                          className={`inline-flex min-h-[38px] w-[38px] items-center justify-center rounded-xl border transition-colors shrink-0 cursor-pointer ${
                            isBookmarked
                              ? 'border-[#2563EB] dark:border-[#60A5FA] bg-[#2563EB]/10 dark:bg-[#3B82F6]/15 text-[#2563EB] dark:text-[#60A5FA]'
                              : 'border-[#CBD5E1] dark:border-[#2A3346] bg-[#F8FAFC] dark:bg-[#090B10] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#181D29]'
                          }`}
                        >
                          <Bookmark className={`h-3.5 w-3.5 ${isBookmarked ? 'fill-current' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Direct Download Success Feedback + Direct PDF URL */}
                {pdfState.status === 'downloaded' && (
                  <div className="mt-4 rounded-xl border border-[#A7F3D0] dark:border-[#14532D] bg-[#ECFDF5] dark:bg-[#0B2219] px-4 py-3 text-xs sm:text-sm text-[#065F46] dark:text-[#6EE7B7] space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 font-semibold">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>{pdfState.message}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {previewUrl && (
                          <button
                            type="button"
                            onClick={() => togglePreview(article.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#059669]/30 bg-white/80 dark:bg-[#090B10]/60 px-2.5 py-1 text-xs font-semibold text-[#065F46] dark:text-[#6EE7B7] hover:bg-white cursor-pointer"
                          >
                            {pdfState.showInlinePreview ? (
                              <>
                                <EyeOff className="h-3.5 w-3.5" />
                                <span>إخفاء المعاينة</span>
                              </>
                            ) : (
                              <>
                                <Eye className="h-3.5 w-3.5" />
                                <span>معاينة الملف</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {pdfState.pdfUrl && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 dark:bg-[#090B10]/50 px-3 py-2 text-xs">
                        <div className="min-w-0 flex-1 flex items-center gap-2">
                          <span className="font-semibold shrink-0">رابط PDF المباشر:</span>
                          <span dir="ltr" className="font-mono truncate text-[#0F172A] dark:text-[#E2E8F0]">
                            {pdfState.pdfUrl}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyDirectPdf(article.id, pdfState.pdfUrl!)}
                          className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-medium text-[#065F46] dark:text-[#6EE7B7] hover:bg-[#A7F3D0]/40 cursor-pointer shrink-0"
                        >
                          {copiedPdfId === article.id ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span>تم النسخ</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>نسخ الرابط</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Sci-Hub Manual Verification & Inspection Box */}
                {pdfState.status === 'sci-hub-manual' && (
                  <div
                    role="region"
                    aria-label="فحص يدوي لملف Sci-Hub"
                    className="mt-4 rounded-xl border border-[#BFDBFE] dark:border-[#1E3A8A] bg-[#EFF6FF] dark:bg-[#0F172A] px-4 py-3.5 text-xs sm:text-sm text-[#1E3A8A] dark:text-[#BFDBFE] space-y-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex items-start gap-2 font-semibold">
                        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-[#2563EB] dark:text-[#60A5FA]" />
                        <span>{pdfState.message}</span>
                      </div>
                    </div>

                    {(pdfState.fileSize || pdfState.sha256 || pdfState.md5) && (
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-[#475569] dark:text-[#94A3B8]" dir="ltr">
                        {pdfState.fileSize && <span>Size: {pdfState.fileSize}</span>}
                        {pdfState.md5 && <span>MD5: {pdfState.md5}</span>}
                        {pdfState.sha256 && <span className="truncate max-w-xs">SHA-256: {pdfState.sha256}</span>}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2.5">
                      {pdfState.pdfUrl && (
                        <button
                          type="button"
                          disabled={pdfState.isDownloadingFile}
                          onClick={() =>
                            triggerDirectBlobDownload(article, pdfState.pdfUrl!, pdfState.doi ?? null, true, {
                              sciHubBoxUrl: pdfState.sciHubBoxUrl,
                              fileSize: pdfState.fileSize,
                              sha256: pdfState.sha256,
                              md5: pdfState.md5,
                            })
                          }
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-[#059669] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#047857] disabled:opacity-60 cursor-pointer"
                        >
                          {pdfState.isDownloadingFile ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                          <span>تأكيد وتحميل PDF مباشرة</span>
                        </button>
                      )}

                      {previewUrl && (
                        <button
                          type="button"
                          onClick={() => togglePreview(article.id)}
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#93C5FD] dark:border-[#1D4ED8] bg-white dark:bg-[#111827] px-3.5 py-1.5 text-xs font-semibold text-[#1D4ED8] dark:text-[#93C5FD] hover:bg-[#DBEAFE] dark:hover:bg-[#1E293B] cursor-pointer"
                        >
                          {pdfState.showInlinePreview ? (
                            <>
                              <EyeOff className="h-3.5 w-3.5" />
                              <span>إغلاق المعاينة اليدوية</span>
                            </>
                          ) : (
                            <>
                              <Eye className="h-3.5 w-3.5" />
                              <span>فحص ومعاينة PDF يدوياً هنا</span>
                            </>
                          )}
                        </button>
                      )}

                      {pdfState.sciHubBoxUrl && (
                        <a
                          href={pdfState.sciHubBoxUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#334155] bg-white/80 dark:bg-[#090B10]/60 px-3 py-1.5 text-xs font-medium text-[#0F172A] dark:text-[#E2E8F0] hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span>فحص يدوي في sci-hub.box</span>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* Embedded Manual PDF Inspector */}
                {pdfState.showInlinePreview && previewUrl && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-[#CBD5E1] dark:border-[#2A3346] bg-[#F8FAFC] dark:bg-[#090B10]">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-[#E2E8F0] dark:border-[#1F2737] text-xs font-medium text-[#475569] dark:text-[#94A3B8]">
                      <span>معاينة وفحص ملف PDF يدوياً</span>
                      <button
                        type="button"
                        onClick={() => togglePreview(article.id)}
                        className="text-[#2563EB] dark:text-[#60A5FA] hover:underline cursor-pointer"
                      >
                        إغلاق
                      </button>
                    </div>
                    <iframe
                      title={`معاينة PDF - ${article.title}`}
                      src={previewUrl}
                      className="w-full h-[540px] bg-white"
                    />
                  </div>
                )}

                {pdfState.status === 'paid-unavailable' && (
                  <div
                    role="alert"
                    className="mt-4 rounded-xl border border-[#FED7AA] dark:border-[#7C2D12] bg-[#FFF7ED] dark:bg-[#2A140B] px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-[#9A3412] dark:text-[#FDBA74]"
                  >
                    <div className="flex items-start gap-2 font-semibold">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{pdfState.message}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {pdfState.sciHubBoxUrl && (
                        <a
                          href={pdfState.sciHubBoxUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-semibold underline underline-offset-4 whitespace-nowrap"
                        >
                          فحص يدوي في sci-hub.box
                        </a>
                      )}
                      <a
                        href={article.articleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium underline underline-offset-4 whitespace-nowrap"
                      >
                        صفحة الناشر الأصلية
                      </a>
                    </div>
                  </div>
                )}

                {pdfState.status === 'error' && (
                  <div
                    role="alert"
                    className="mt-4 rounded-xl border border-[#FECACA] dark:border-[#7F1D1D] bg-[#FEF2F2] dark:bg-[#281010] px-4 py-3 flex items-center gap-2 text-xs sm:text-sm text-[#991B1B] dark:text-[#FCA5A5]"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{pdfState.message}</span>
                  </div>
                )}
              </motion.article>
            );
          })}
        </div>
      )}
    </section>
  );
}
