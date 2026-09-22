# DESIGN_DIRECTION.md

> **Ezaees Festival 2026 — Registration Intelligence**
> نوادي صناع الحياة بالجامعات المصرية
> تصميم الـ Interface يتم تحديد اتجاهه قبل أي كود؛ هذا الملف هو ذلك القرار.

---

## 1. What problem does this interface solve, and for whom?

الواجهة موجهة للإدارة والمسؤولين عن متابعة تسجيلات فعاليات Ezaees Festival 2026.

المشكلة: تحويل التسجيلات الخام إلى صورة سريعة وواضحة عن:

- حجم التسجيل
- توزيع المشاركين
- الطلب على العروض
- التوزيع الجغرافي (المحافظات)
- تطور التسجيلات زمنيًا

الحل ليس "لوحة أرقام"، بل **Festival Intelligence Dashboard** — قراءة بصرية فورية
لحالة المهرجان كما لو كان حدثًا حيًا.

---

## 2. What tone defines it?

**Editorial + Cultural Data Dashboard**

- Editorial: تخطيط مجلّات — أرقام typographic ضخمة، شبكات غير متناظرة، مسافات بيضاء قوية،
  خطوط رفيعة، تسلسل هرمي بصري واضح.
- Cultural: هوية مصرية معاصرة — لمسات فنية دافئة (خط الـ kicker التزييني، أشكال خفيفة)،
  ألوان المهرجان، دون أي قوالب SaaS جاهزة أو Bootstrap.

ممنوع منعًا باتًا: purple gradients، Admin Templates، كروت متكررة بشكل ممل،
Layout ممركز بالكامل.

---

## 3. What is the one thing users will remember most?

### Festival Pulse

خط اتجاه التسجيل اليومي — قطعة بصرية مركزية تظهر "نبض" المهرجان: حركة التسجيل
عبر الأيام في رسم بياني واحد مع رقم تحديث حي. إنها العنصر الذي يوحي بأن هذه
لوحة فهم المهرجان، لا جدول إكسل.

---

## 4. Visual identity (colors)

| الدور | اللون | الاستخدام |
|------|-------|-----------|
| Primary | `#014976` (Blue) | المساحات الكبرى، الأرقام، الأعمدة |
| Orange accent | `#FBAE42` | مؤشرات Micro، التمييز |
| Orange deep | `#F17206` | الحواف والخطوط الفنية |
| Light | `#F4F3EF` | الخلفية الأساسية |
| White | `#FFFFFF` | الكروت والمساحات النظيفة |

## 5. Typography

- **Alexandria** — الخط الرئيسي: العناوين والـ UI العربي. (Google Fonts)
- **Arslan** — خط فني تزييني للعناصر الخاصة فقط: الـ kickers، أرقام الفهرس
  (اختياري: الملفات في `assets/fonts/`، مع fallback تلقائي إلى Alexandria).

ممنوع: Inter, Roboto, Arial, Space Grotesk, و خطوط النظام كخط رئيسي.

## 6. Composition & atmosphere

- Hero بخط ضخم: `EZAEES / FESTIVAL 2026` على عمودين غير متساويين.
- توزيع غير متناظر: قوائم العروض بجانب الرسوم البيانية، دون شبكات كروت متطابقة.
- خلفية: grain خفيف + mesh أزرق/برتقالي ناعم (بدون أي أثر على الأداء).
- Motion: Page-load reveal متدرج عبر CSS فقط (Hero ← KPIs ← التصور الرئيسي ←
  التحليلات الثانوية)، مقتصرًا ومحترمًا لـ `prefers-reduced-motion`.

## 7. Data honesty

- لا "أرقام مزيفة" تعرض كبيانات حقيقية.
- أي معاينة تجريبية تظهر شارة **"بيانات تجريبية — للعرض فقط"** في كل سطح.
- المصدر الوحيد للبيانات هو Google Sheets عبر Google Apps Script.