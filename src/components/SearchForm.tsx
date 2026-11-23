import { type RefObject } from 'react';
import { ClipboardPaste, Search, X } from 'lucide-react';

interface SearchFormProps {
  input: string;
  onInputChange: (val: string) => void;
  onSubmit: (value?: string) => void;
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

export function SearchForm({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  inputRef,
}: SearchFormProps) {
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onInputChange(text.trim());
        inputRef.current?.focus();
      }
    } catch {
      inputRef.current?.focus();
    }
  };

  return (
    <section id="search" className="pt-10 pb-8 md:pt-14 md:pb-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <p className="text-xs font-medium tracking-wide text-[#57534E] mb-3">
            استخراج المعرّف الرقمي للوثائق · البحث في sci-hub.box · تحميل PDF
          </p>
          <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-[#1C1917] leading-tight mx-auto max-w-3xl">
            استخراج معرّف DOI من رابط المقالة والبحث عنها للتحميل
          </h1>
          <p className="mt-4 text-base text-[#57534E] max-w-2xl mx-auto leading-relaxed">
            أدخل رابط أي ورقة بحثية أو مقالة علمية لاستخراج معرّف DOI الخاص بها تلقائياً، ثم التحقق من توفرها عبر{' '}
            <span dir="ltr" className="font-mono text-sm text-[#1C1917] font-medium">
              https://sci-hub.box/
            </span>{' '}
            وإظهار زر تحميل ملف PDF مباشرة.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="rounded-xl border border-[#E4DFD5] bg-white p-5 sm:p-6"
        >
          <label
            htmlFor="article-url-input"
            className="block text-sm font-semibold text-[#1C1917] mb-2.5"
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
                className="w-full min-h-[48px] rounded-lg border border-[#D6CEBE] bg-[#FBF9F5] pr-4 pl-20 py-3 font-mono text-sm text-[#1C1917] placeholder:text-[#78716C] focus:border-[#1E3A8A] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]/15 disabled:opacity-60"
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
                    className="flex h-8 w-8 items-center justify-center rounded-md text-[#57534E] hover:bg-[#EBE6DF] hover:text-[#1C1917] transition-colors cursor-pointer"
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
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#57534E] hover:bg-[#EBE6DF] hover:text-[#1C1917] transition-colors cursor-pointer"
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
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-[#1E3A8A] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#172E6E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A8A] disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Search className="h-4 w-4" />
              <span>{isLoading ? 'جارٍ البحث...' : 'استخراج DOI والبحث'}</span>
            </button>
          </div>

          <div className="mt-4 pt-4 border-t border-[#F0ECE3] flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#57534E]">
            <span className="font-medium text-[#1C1917]">أمثلة سريعة للتجربة:</span>
            {EXAMPLE_ARTICLES.map((item) => (
              <button
                key={item.url}
                type="button"
                disabled={isLoading}
                onClick={() => {
                  onInputChange(item.url);
                  onSubmit(item.url);
                }}
                className="text-[#1E3A8A] hover:underline underline-offset-4 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                {item.label}
              </button>
            ))}
          </div>
        </form>
      </div>
    </section>
  );
}
