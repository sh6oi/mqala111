export function WorkflowSection() {
  const steps = [
    {
      index: '01.',
      title: 'استخراج معرّف DOI تلقائياً',
      description:
        'يحلل النظام رابط المقالة ويبحث في الوسوم الأكاديمية الوصفية (citation_doi، DC.Identifier، JSON-LD) وقواعد بيانات Crossref وPubMed وarXiv لتحديد معرّف DOI الدقيق.',
    },
    {
      index: '02.',
      title: 'البحث في موقع sci-hub.box',
      description:
        'يتم الاستعلام عن معرّف DOI المستخرج عبر sci-hub.box والتحقق من وجود نسخة رقمية مفهرسة للمقالة مع استخلاص بصمة الملف وحجمه ومعلومات الاستشهاد.',
    },
    {
      index: '03.',
      title: 'معاينة وتحميل PDF وتصدير المراجع',
      description:
        'عند توفر المقالة يظهر زر تحميل ملف PDF وزر المعاينة الفورية، إلى جانب توليد الاقتباس الأكاديمي بصيغ APA وIEEE وMLA وBibTeX.',
    },
  ];

  return (
    <section id="workflow" className="mx-auto max-w-6xl px-4 sm:px-6 py-12 border-t border-[#E2E8F0] dark:border-[#1F2737]">
      <div className="mb-7">
        <h2 className="font-display text-2xl font-bold text-[#0F172A] dark:text-[#F8FAFC]">
          آلية عمل الأداة
        </h2>
        <p className="text-sm text-[#475569] dark:text-[#94A3B8] mt-1">
          ثلاث خطوات متكاملة من رابط المقالة حتى تحميل ملف PDF وتنسيق المراجع.
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
