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
        'يتم الاستعلام مباشرة عن معرّف DOI المستخرج في أرشيف sci-hub.box للتحقق من وجود نسخة رقمية مفهرسة للمقالة مع استخلاص بصمة الملف وحجمه.',
    },
    {
      index: '03.',
      title: 'إتاحة زر تحميل ملف PDF',
      description:
        'عند توفر المقالة يظهر زر تحميل ملف PDF فوراً لحفظ الورقة البحثية باسم معرّف DOI، مع توفير رابط مباشر لصفحة المقالة على sci-hub.box.',
    },
  ];

  return (
    <section id="workflow" className="mx-auto max-w-4xl py-10 border-t border-[#E4DFD5]">
      <div className="mb-6">
        <h2 className="font-serif text-2xl font-bold text-[#1C1917]">آلية عمل الأداة</h2>
        <p className="text-sm text-[#57534E] mt-1">
          ثلاث خطوات متسلسلة من رابط المقالة حتى تحميل ملف PDF.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((step) => (
          <div
            key={step.index}
            className="rounded-xl border border-[#E4DFD5] bg-white p-5 flex flex-col"
          >
            <span className="font-mono text-sm font-semibold text-[#1E3A8A] tabular-nums mb-2">
              {step.index}
            </span>
            <h3 className="text-base font-bold text-[#1C1917] mb-2">{step.title}</h3>
            <p className="text-sm text-[#57534E] leading-relaxed">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
