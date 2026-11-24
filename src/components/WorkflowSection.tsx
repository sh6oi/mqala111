export function WorkflowSection() {
  const steps = [
    {
      index: '01.',
      title: 'البحث بعنوان البحث في عدة محركات',
      description:
        'اكتب عنوان البحث الخاص بك ليقوم النظام بالبحث بالتوازي في OpenAlex وCrossref وEurope PMC وarXiv وDOAJ واستخراج المقالات القريبة من موضوعك.',
    },
    {
      index: '02.',
      title: 'استعراض التفاصيل والاستشهادات',
      description:
        'تظهر بجانب كل مقالة تفاصيلها الكاملة: تاريخ النشر، رابط المقالة الأصلي، المحرك الذي جُلبت منه، وعدد الاستشهادات العلمية.',
    },
    {
      index: '03.',
      title: 'التحقق عبر Sci-Hub وتحميل PDF',
      description:
        'عند الضغط على زر تحميل PDF، يتم التحقق من توفر المقالة على Sci-Hub بصيغة PDF لتحميلها فوراً، أو تنبيهك إذا كانت مدفوعة وغير مجانية.',
    },
  ];

  return (
    <section id="workflow" className="mx-auto max-w-6xl px-4 sm:px-6 py-12 border-t border-[#E2E8F0] dark:border-[#1F2737]">
      <div className="mb-7">
        <h2 className="font-display text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
          آلية عمل الأداة
        </h2>
        <p className="text-sm text-[#475569] dark:text-[#94A3B8] mt-1">
          من كتابة عنوان البحث إلى استعراض النتائج وتحميل ملفات PDF المتاحة.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step) => (
          <div
            key={step.index}
            className="rounded-2xl border border-[#E2E8F0] dark:border-[#1F2737] bg-white dark:bg-[#11151E] p-6 flex flex-col hover:border-[#CBD5E1] dark:hover:border-[#334155] transition-colors"
          >
            <span className="font-mono text-sm font-semibold text-[#2563EB] dark:text-[#60A5FA] tabular-nums mb-3">
              {step.index}
            </span>
            <h3 className="text-base font-bold text-[#0F172A] dark:text-[#F8FAFC] mb-2">
              {step.title}
            </h3>
            <p className="text-sm text-[#475569] dark:text-[#94A3B8] leading-relaxed">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
