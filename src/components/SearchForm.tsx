import { type RefObject } from 'react';
import { ArrowUpLeft, ClipboardPaste, Layers, Moon, Search, Sun, X } from 'lucide-react';

export type SearchMode = 'single' | 'batch';

interface SearchFormProps {
  mode: SearchMode;
  onModeChange: (mode: SearchMode) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  input: string;
  onInputChange: (val: string) => void;
  batchInput: string;
  onBatchInputChange: (val: string) => void;
  onSubmitSingle: (value?: string) => void;
  onSubmitBatch: () => void;
  isLoading: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  stats: {
    total: number;
    available: number;
    bookmarked: number;
  };
}

const EXAMPLE_ARTICLES = [
  {
    source: 'Nature',
    type: 'رابط مقالة علمية',
    title: 'Nanometre-scale thermometry (2013)',
    url: 'https://www.nature.com/articles/nature12373',
  },
  {
    source: 'ScienceDirect',
    type: 'معرّف PII مغلق',
    title: 'The Hallmarks of Aging — Cell (2013)',
    url: 'https://www.sciencedirect.com/science/article/pii/S0092867413006454',
  },
  {
    source: 'PLOS ONE',
    type: 'مفتوح الوصول',
    title: 'Open Access DOI Example',
    url: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0115069',
  },
  {
    source: 'arXiv',
    type: 'ورقة ما قبل النشر',
    title: 'Attention Is All You Need (2017)',
    url: 'https://arxiv.org/abs/1706.03762',
  },
];

const SUPPORTED_PUBLISHERS = [
  'Nature',
  'ScienceDirect',
  'IEEE Xplore',
  'Springer',
  'PubMed',
  'arXiv',
  'Wiley',
  'PLOS',
];

export function SearchForm({
  mode,
  onModeChange,
  isDark,
  onToggleTheme,
  input,
  onInputChange,
  batchInput,
  onBatchInputChange,
  onSubmitSingle,
  onSubmitBatch,
  isLoading,
  inputRef,
  stats,
}: SearchFormProps) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        if (mode === 'single') {
          onInputChange(text.trim());
          inputRef.current?.focus();
        } else {
          onBatchInputChange(text.trim());
        }
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  const batchCount = batchInput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean).length;

  return (
    <section id="search" className="bg-architectural-grid border-b border-[#E2E8F0] dark:border-[#1F2737] py-10 md:py-14">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Primary Search Column */}
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-[#475569] dark:text-[#94A3B8] mb-3">
                استخراج معرّف DOI · التحقق عبر sci-hub.box · تحميل PDF
              </p>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.65rem] font-bold text-[#0F172A] dark:text-[#F8FAFC] leading-[1.2] tracking-tight">
                من رابط المقالة إلى ملف PDF في ثوانٍ
              </h1>
              <p className="mt-4 text-base text-[#475569] dark:text-[#94A3B8] max-w-2xl leading-relaxed">
                أدخل رابط المقالة أو معرّف DOI لاستخلاص بياناتها الببليوغرافية تلقائياً والبحث عن توفرها في{' '}
                <span dir="ltr" className="font-mono text-sm text-[#0F172A] dark:text-[#F8FAFC] font-medium">
                  https://sci-hub.box/
                </span>{' '}
                مع زر تحميل ومعاينة فورية.
              </p>
            </div>

            {/* Workspace Toolbar */}
            <div className="mt-7 mb-3 flex flex-wrap items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="وضع البحث"
                className="inline-flex items-center gap-1 rounded-xl border border-[#E2E8F0] dark:border-[#1F2737] bg-[#F1F5F9] dark:bg-[#11151E] p-1"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'single'}
                  onClick={() => onModeChange('single')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    mode === 'single'
                      ? 'bg-white dark:bg-[#1E2534] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs'
                      : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                  }`}
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>بحث مفرد</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'batch'}
                  onClick={() => onModeChange('batch')}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    mode === 'batch'
                      ? 'bg-white dark:bg-[#1E2534] text-[#0F172A] dark:text-[#F8FAFC] shadow-xs'
                      : 'text-[#475569] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-[#F8FAFC]'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>فحص قائمة</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onToggleTheme}
                aria-label={isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] px-3 py-1.5 text-xs font-medium text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F1F5F9] dark:hover:bg-[#181D29] transition-colors whitespace-nowrap cursor-pointer"
              >
                {isDark ? <Sun className="h-3.5 w-3.5 text-[#F59E0B]" /> : <Moon className="h-3.5 w-3.5 text-[#2563EB]" />}
                <span>{isDark ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
              </button>
            </div>

            {/* Search Input Card */}
            {mode === 'single' ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSubmitSingle();
                }}
                className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] p-5 shadow-sm shadow-slate-900/[0.03] transition-colors"
              >
                <label
                  htmlFor="article-url-input"
                  className="block text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC] mb-2.5"
                >
                  رابط المقالة العلمية أو معرّف DOI
                </label>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1 flex items-center rounded-xl border border-[#CBD5E1] dark:border-[#2A3346] bg-[#F8FAFC] dark:bg-[#090B10] focus-within:border-[#2563EB] dark:focus-within:border-[#3B82F6] focus-within:bg-white dark:focus-within:bg-[#0F131C] focus-within:ring-4 focus-within:ring-[#2563EB]/10 transition-all">
                    <input
                      ref={inputRef}
                      id="article-url-input"
                      type="text"
                      dir="ltr"
                      value={input}
                      onChange={(e) => onInputChange(e.target.value)}
                      placeholder="https://www.nature.com/articles/...  أو  10.1038/..."
                      autoComplete="off"
                      spellCheck={false}
                      disabled={isLoading}
                      className="w-full min-h-[48px] bg-transparent pr-4 pl-20 py-3 font-mono text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#64748B] focus:outline-none disabled:opacity-60"
                    />

                    <div className="absolute left-2 flex items-center gap-1">
                      {input ? (
                        <button
                          type="button"
                          onClick={() => {
                            onInputChange('');
                            inputRef.current?.focus();
                          }}
                          disabled={isLoading}
                          aria-label="مسح الحقل"
                          title="مسح الحقل"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748B] hover:bg-[#E2E8F0] dark:hover:bg-[#1F2737] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition-colors cursor-pointer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handlePaste}
                          disabled={isLoading}
                          aria-label="لصق من الحافظة"
                          title="لصق من الحافظة"
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#475569] dark:text-[#94A3B8] hover:bg-[#E2E8F0] dark:hover:bg-[#1F2737] hover:text-[#0F172A] dark:hover:text-[#F8FAFC] transition-colors cursor-pointer"
                        >
                          <ClipboardPaste className="h-3.5 w-3.5" />
                          <span>لصق</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Search className="h-4 w-4" />
                    <span>{isLoading ? 'جارٍ البحث...' : 'استخراج DOI والبحث'}</span>
                  </button>
                </div>

                <div className="mt-4 pt-3.5 border-t border-[#F1F5F9] dark:border-[#1F2737] flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                  <span className="font-medium text-[#0F172A] dark:text-[#CBD5E1]">يدعم:</span>
                  {SUPPORTED_PUBLISHERS.map((pub, idx) => (
                    <span key={pub} className="inline-flex items-center gap-2.5">
                      <span dir="ltr" className="font-mono">
                        {pub}
                      </span>
                      {idx < SUPPORTED_PUBLISHERS.length - 1 && (
                        <span aria-hidden="true" className="text-[#CBD5E1] dark:text-[#334155]">
                          ·
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </form>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onSubmitBatch();
                }}
                className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] p-5 shadow-sm shadow-slate-900/[0.03] transition-colors"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                  <label
                    htmlFor="batch-urls-input"
                    className="text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC]"
                  >
                    قائمة روابط المقالات أو معرّفات DOI (بحد أقصى 10)
                  </label>
                  <span className="font-mono text-xs text-[#475569] dark:text-[#94A3B8] tabular-nums">
                    {batchCount} / 10
                  </span>
                </div>

                <textarea
                  id="batch-urls-input"
                  rows={4}
                  dir="ltr"
                  value={batchInput}
                  onChange={(e) => onBatchInputChange(e.target.value)}
                  placeholder={
                    'https://www.nature.com/articles/nature12373\nhttps://arxiv.org/abs/1706.03762\n10.1016/j.cell.2013.05.039'
                  }
                  spellCheck={false}
                  disabled={isLoading}
                  className="w-full rounded-xl border border-[#CBD5E1] dark:border-[#2A3346] bg-[#F8FAFC] dark:bg-[#090B10] p-3.5 font-mono text-xs sm:text-sm text-[#0F172A] dark:text-[#F8FAFC] placeholder:text-[#64748B] focus:border-[#2563EB] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#0F131C] focus:outline-none focus:ring-4 focus:ring-[#2563EB]/10 disabled:opacity-60 leading-relaxed"
                />

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 text-xs">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() =>
                        onBatchInputChange(EXAMPLE_ARTICLES.map((e) => e.url).join('\n'))
                      }
                      className="text-[#2563EB] dark:text-[#60A5FA] font-medium hover:underline underline-offset-4 cursor-pointer"
                    >
                      تعبئة أمثلة للتجربة
                    </button>
                    {batchInput && (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => onBatchInputChange('')}
                        className="text-[#475569] dark:text-[#94A3B8] hover:underline underline-offset-4 cursor-pointer"
                      >
                        مسح القائمة
                      </button>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading || batchCount === 0}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#2563EB] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap cursor-pointer"
                  >
                    <Layers className="h-4 w-4" />
                    <span>{isLoading ? 'جارٍ فحص القائمة...' : 'فحص القائمة واستخراج PDF'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right/Side Quick Samples & Live Session Overview Panel */}
          <div className="lg:col-span-5 flex flex-col rounded-2xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] p-5 sm:p-6 shadow-sm shadow-slate-900/[0.03] justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 pb-4 border-b border-[#F1F5F9] dark:border-[#1F2737]">
                <h2 className="text-sm font-bold text-[#0F172A] dark:text-[#F8FAFC]">
                  إحصائيات مكتبتك الحالية
                </h2>
                <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">تحديث محلي فوري</span>
              </div>

              <div className="grid grid-cols-3 divide-x divide-x-reverse divide-[#F1F5F9] dark:divide-[#1F2737] py-4 border-b border-[#F1F5F9] dark:border-[#1F2737]">
                <div className="pl-3">
                  <div className="font-mono text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC] tabular-nums">
                    {stats.total}
                  </div>
                  <div className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">تم فحصها</div>
                </div>
                <div className="px-3">
                  <div className="font-mono text-2xl font-bold text-[#059669] dark:text-[#34D399] tabular-nums">
                    {stats.available}
                  </div>
                  <div className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">متوفرة PDF</div>
                </div>
                <div className="pr-3">
                  <div className="font-mono text-2xl font-bold text-[#2563EB] dark:text-[#60A5FA] tabular-nums">
                    {stats.bookmarked}
                  </div>
                  <div className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8]">محفوظة</div>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <p className="text-xs font-semibold text-[#475569] dark:text-[#94A3B8] mb-3">
                أمثلة جاهزة للاختبار السريع
              </p>
              <div className="divide-y divide-[#F1F5F9] dark:divide-[#1F2737]">
                {EXAMPLE_ARTICLES.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      onModeChange('single');
                      onInputChange(item.url);
                      onSubmitSingle(item.url);
                    }}
                    className="w-full py-2.5 flex items-center justify-between gap-3 text-right hover:bg-[#F8FAFC] dark:hover:bg-[#181D29] -mx-2 px-2 rounded-lg transition-colors disabled:opacity-50 group cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#0F172A] dark:text-[#F8FAFC] truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] mt-0.5">
                        {item.source} · {item.type}
                      </div>
                    </div>
                    <ArrowUpLeft className="h-4 w-4 text-[#94A3B8] group-hover:text-[#2563EB] dark:group-hover:text-[#60A5FA] shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
