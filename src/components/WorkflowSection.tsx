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
    <section id="workflow" className="mx-auto max-w-5xl py-10 border-t border-[#E4DFD5] dark:border-[#272B33]">
      <div className="mb-6">
        <h2 className="font-serif text-2xl font-bold text-[#1C1917] dark:text-[#F5F2EB]">آلية عمل الأداة</h2>
        <p className="text-sm text-[#57534E] dark:text-[#A8A29E] mt-1">
          ثلاث خطوات دقيقة من رابط المقالة حتى تحميل ملف PDF وتنسيق المراجع.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step) => (
          <div
            key={step.index}
            className="rounded-xl border border-[#E4DFD5] dark:border-[#272B33] bg-white dark:bg-[#181B21] p-5 flex flex-col transition-colors"
          >
            <span className="font-mono text-sm font-semibold text-[#1E3A8A] dark:text-[#60A5FA] tabular-nums mb-2">
              {step.index}
            </span>
            <h3 className="text-base font-bold text-[#1C1917] dark:text-[#F5F2EB] mb-2">{step.title}</h3>
            <p className="text-sm text-[#57534E] dark:text-[#A8A29E] leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
