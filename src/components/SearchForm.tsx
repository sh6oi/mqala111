import { type RefObject } from 'react';
import { ClipboardPaste, Layers, Moon, Search, Sun, X } from 'lucide-react';

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
}

const EXAMPLE_ARTICLES = [
  {
    label: 'Nature (2013)',
    url: 'https://www.nature.com/articles/nature12373',
  },
  {
    label: 'ScienceDirect / Cell (2013)',
    url: 'https://www.sciencedirect.com/science/article/pii/S0092867413006454',
  },
  {
    label: 'PLOS ONE (مفتوح الوصول)',
    url: 'https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0115069',
  },
  {
    label: 'arXiv — Transformer (2017)',
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
    <section id="search" className="pt-10 pb-8 md:pt-14 md:pb-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-medium tracking-wide text-[#57534E] dark:text-[#A8A29E] mb-3">
            استخراج المعرّف الرقمي للوثائق · البحث في sci-hub.box · توليد الاقتباسات · تحميل PDF
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1C1917] dark:text-[#F5F2EB] leading-tight mx-auto max-w-3xl">
            استخراج معرّف DOI من رابط المقالة والبحث عنها للتحميل
          </h1>
          <p className="mt-4 text-base text-[#57534E] dark:text-[#A8A29E] max-w-2xl mx-auto leading-relaxed">
            أدخل رابط ورقة بحثية أو قائمة روابط لاستخراج معرّف DOI تلقائياً، والتحقق من توفرها عبر{' '}
            <span dir="ltr" className="font-mono text-sm text-[#1C1917] dark:text-[#F5F2EB] font-medium">
              https://sci-hub.box/
            </span>{' '}
            مع معاينة سريعة وتحميل مباشر بصيغة PDF.
          </p>
        </div>

        {/* Workspace Toolbar: Mode Switch + Study Theme Toggle */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label="وضع البحث"
            className="inline-flex items-center gap-1 rounded-lg border border-[#E4DFD5] dark:border-[#272B33] bg-[#F3EFE7] dark:bg-[#181B21] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'single'}
              onClick={() => onModeChange('single')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'single'
                  ? 'bg-white dark:bg-[#232730] text-[#1C1917] dark:text-[#F5F2EB] shadow-xs'
                  : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EB]'
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
              className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                mode === 'batch'
                  ? 'bg-white dark:bg-[#232730] text-[#1C1917] dark:text-[#F5F2EB] shadow-xs'
                  : 'text-[#57534E] dark:text-[#A8A29E] hover:text-[#1C1917] dark:hover:text-[#F5F2EB]'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>فحص قائمة (دفعة)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'التبديل إلى الوضع النهاري' : 'التبديل إلى الوضع الليلي'}
            className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-[#E4DFD5] dark:border-[#272B33] bg-white dark:bg-[#181B21] px-3 py-1.5 text-xs font-medium text-[#57534E] dark:text-[#D6D3CD] hover:bg-[#F3EFE7] dark:hover:bg-[#232730] transition-colors whitespace-nowrap cursor-pointer"
          >
            {isDark ? <Sun className="h-3.5 w-3.5 text-[#F59E0B]" /> : <Moon className="h-3.5 w-3.5 text-[#1E3A8A]" />}
            <span>{isDark ? 'الوضع النهاري' : 'وضع القراءة الليلي'}</span>
          </button>
        </div>

        {/* Main Search Workspace Card */}
        {mode === 'single' ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmitSingle();
            }}
            className="rounded-xl border border-[#E4DFD5] dark:border-[#272B33] bg-white dark:bg-[#181B21] p-5 sm:p-7 transition-colors"
          >
            <label
              htmlFor="article-url-input"
              className="block text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EB] mb-2.5"
            >
              رابط المقالة العلمية أو معرّف DOI
            </label>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1 flex items-center">
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
                  className="w-full min-h-[50px] rounded-lg border border-[#D6CEBE] dark:border-[#323741] bg-[#FBF9F5] dark:bg-[#111317] pr-4 pl-20 py-3 font-mono text-sm text-[#1C1917] dark:text-[#F5F2EB] placeholder:text-[#78716C] dark:placeholder:text-[#71717A] focus:border-[#1E3A8A] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#15181E] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15 disabled:opacity-60"
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
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[#57534E] dark:text-[#A8A29E] hover:bg-[#EBE6DF] dark:hover:bg-[#272B33] hover:text-[#1C1917] dark:hover:text-[#F5F2EB] transition-colors cursor-pointer"
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
                      className="flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-[#57534E] dark:text-[#A8A29E] hover:bg-[#EBE6DF] dark:hover:bg-[#272B33] hover:text-[#1C1917] dark:hover:text-[#F5F2EB] transition-colors cursor-pointer"
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
                className="inline-flex min-h-[50px] items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] dark:bg-[#3B82F6] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#172E6E] dark:hover:bg-[#2563EB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A8A] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Search className="h-4 w-4" />
                <span>{isLoading ? 'جارٍ البحث...' : 'استخراج DOI والبحث'}</span>
              </button>
            </div>

            <div className="mt-4 pt-4 border-t border-[#F0ECE3] dark:border-[#272B33] flex flex-wrap items-center justify-between gap-3 text-xs text-[#57534E] dark:text-[#A8A29E]">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="font-semibold text-[#1C1917] dark:text-[#F5F2EB]">أمثلة سريعة:</span>
                {EXAMPLE_ARTICLES.map((item) => (
                  <button
                    key={item.url}
                    type="button"
                    disabled={isLoading}
                    onClick={() => {
                      onInputChange(item.url);
                      onSubmitSingle(item.url);
                    }}
                    className="text-[#1E3A8A] dark:text-[#60A5FA] hover:underline underline-offset-4 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </form>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onSubmitBatch();
            }}
            className="rounded-xl border border-[#E4DFD5] dark:border-[#272B33] bg-white dark:bg-[#181B21] p-5 sm:p-7 transition-colors"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
              <label
                htmlFor="batch-urls-input"
                className="text-sm font-semibold text-[#1C1917] dark:text-[#F5F2EB]"
              >
                قائمة روابط المقالات أو معرّفات DOI (رابط واحد في كل سطر — بحد أقصى 10)
              </label>
              <span className="font-mono text-xs text-[#57534E] dark:text-[#A8A29E] tabular-nums">
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
              className="w-full rounded-lg border border-[#D6CEBE] dark:border-[#323741] bg-[#FBF9F5] dark:bg-[#111317] p-3.5 font-mono text-xs sm:text-sm text-[#1C1917] dark:text-[#F5F2EB] placeholder:text-[#78716C] dark:placeholder:text-[#71717A] focus:border-[#1E3A8A] dark:focus:border-[#3B82F6] focus:bg-white dark:focus:bg-[#15181E] focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15 disabled:opacity-60 leading-relaxed"
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 text-xs">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() =>
                    onBatchInputChange(
                      EXAMPLE_ARTICLES.map((e) => e.url).join('\n')
                    )
                  }
                  className="text-[#1E3A8A] dark:text-[#60A5FA] hover:underline underline-offset-4 cursor-pointer"
                >
                  تعبئة أمثلة للتجربة
                </button>
                {batchInput && (
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => onBatchInputChange('')}
                    className="text-[#57534E] dark:text-[#A8A29E] hover:underline underline-offset-4 cursor-pointer"
                  >
                    مسح القائمة
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading || batchCount === 0}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] dark:bg-[#3B82F6] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#172E6E] dark:hover:bg-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <Layers className="h-4 w-4" />
                <span>{isLoading ? 'جارٍ فحص القائمة...' : 'فحص القائمة واستخراج PDF'}</span>
              </button>
            </div>
          </form>
        )}

        {/* Quiet Typographic Supported Index Strip (Zero Pills) */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs text-[#78716C] dark:text-[#A8A29E]">
          <span>الناشرون المدعومون:</span>
          {SUPPORTED_PUBLISHERS.map((pub, idx) => (
            <span key={pub} className="inline-flex items-center gap-2.5">
              <span dir="ltr" className="font-mono text-[#57534E] dark:text-[#D6D3CD]">
                {pub}
              </span>
              {idx < SUPPORTED_PUBLISHERS.length - 1 && (
                <span aria-hidden="true" className="text-[#D6CEBE] dark:text-[#3F4450]">
                  ·
                </span>
              )}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
