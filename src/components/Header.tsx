interface HeaderProps {
  onNewSearch: () => void;
}

export function Header({ onNewSearch }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[#E2E8F0] dark:border-[#1F2737] bg-[#F8FAFC]/85 dark:bg-[#090B10]/85 backdrop-blur-md transition-colors">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-8 px-6 py-3.5">
        <a
          href="#search"
          className="font-display text-lg font-bold tracking-tight text-[#0F172A] dark:text-[#F8FAFC] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2563EB]"
        >
          المستكشف الأكاديمي
        </a>

        <nav
          aria-label="التنقل الرئيسي"
          className="hidden md:flex items-center gap-7 text-sm font-medium text-[#475569] dark:text-[#94A3B8]"
        >
          <a
            href="#search"
            className="hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            أداة البحث
          </a>
          <a
            href="#history"
            className="hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            سجل المقالات
          </a>
          <a
            href="#workflow"
            className="hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            آلية العمل
          </a>
          <a
            href="https://sci-hub.box/"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[#0F172A] dark:hover:text-[#F8FAFC] hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            sci-hub.box
          </a>
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onNewSearch}
            className="min-h-[40px] rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1D4ED8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563EB] whitespace-nowrap shrink-0 cursor-pointer"
          >
            بحث جديد
          </button>
        </div>
      </div>
    </header>
  );
}
