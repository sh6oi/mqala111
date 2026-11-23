interface HeaderProps {
  onNewSearch: () => void;
}

export function Header({ onNewSearch }: HeaderProps) {
  return (
    <header className="border-b border-[#E4DFD5] bg-[#FBF9F5]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-4">
        <a
          href="#search"
          className="font-serif text-xl font-bold tracking-tight text-[#1C1917] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1E3A8A]"
        >
          المستكشف الأكاديمي
        </a>

        <nav
          aria-label="التنقل الرئيسي"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#57534E]"
        >
          <a
            href="#search"
            className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            أداة البحث
          </a>
          <a
            href="#history"
            className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            سجل المقالات
          </a>
          <a
            href="#workflow"
            className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            آلية العمل
          </a>
          <a
            href="https://sci-hub.box/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#1C1917] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            sci-hub.box
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onNewSearch}
            className="min-h-[40px] rounded-lg bg-[#1E3A8A] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#172E6E] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1E3A8A] whitespace-nowrap shrink-0 cursor-pointer"
          >
            بحث جديد
          </button>
        </div>
      </div>
    </header>
  );
}
