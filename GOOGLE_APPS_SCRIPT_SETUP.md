# GOOGLE_APPS_SCRIPT_SETUP.md

> نشر الـ Backend: Google Apps Script Web App
> لهذا المشروع: `Ezaees_Festival_Registration_2026`

هذا الملف يشرح خطوة بخطوة كيفية ربط الـ Dashboard ببيانات Google Sheets.
المبدأ: **Google Sheets مصدر البيانات، وApps Script هو الـ Backend الوحيد.**

---

## 0. قبل البدء: ملفات الـ Backend

الـ Backend كله منسوخ من مجلد `backend/` الخاص بالمشروع:

```
backend/
├── Code.gs             # نقطة الدخول + الـ Router
├── Config.gs           # الإعدادات: Spreadsheet ID و Sheet Name
├── DataService.gs      # القراءة الدفاعية للبيانات
├── AnalyticsService.gs # التحليل + التجميع + الـ parser + pagination
└── Utils.gs            # Masking، JSONP، الأدوات المساعدة
```

---

## 1. إنشاء Google Sheet

1. افتح https://sheets.google.com وأنشئ جدولًا جديدًا باسم `Ezaees_Festival_Registration_2026`.
2. الورقة (التبويب) التي تحمل بيانات التصدير اسمها: `Ezaees_Festival_Registration_2026`.
3. الصف الأول يجب أن يكون **Header Row** (أسماء الأعمدة).
4. البيانات تحتها مباشرة (كل صف = تسجيل)، كما في تصدير KoboToolbox.

> لا نفترض عددًا ثابتًا من الأعمدة — الـ Backend يقرأ الـ Header ديناميكيًا
> ويستخدم فقط الأعمدة المعروفة، ويتم تجاهل الأعمدة الزائدة بأمان.

---

## 2. فتح Apps Script

1. من القائمة في Google Sheets: **الإضافات (Extensions) ← Apps Script**
   — أو أنشئ ملف جديد من: https://script.google.com
2. أضف ملفات الـ Backend:
   - امسح أي محتوى افتراضي في `Code.gs` وضع نسخة من `backend/Code.gs`.
   - من زر `+` بجانب Files أضف 4 Files إضافية:
     `Config.gs` و `DataService.gs` و `AnalyticsService.gs` و `Utils.gs`.

---

## 3. تعيين معرّف الجدول (Spreadsheet ID)

1. افتح Google Sheet في المتصفح.
2. من شريط العنوان خذ المقطع بين `/d/` و `/edit`:

```
https://docs.google.com/spreadsheets/d/  [هنا الـ ID]  /edit...
```

3. ضعه في `backend/Config.gs`:

```javascript
var CONFIG = {
  SPREADSHEET_ID: 'ضع_ID_الجدول_هنا_فقط_في_الـBackend',
  SHEET_NAME: 'Ezaees_Festival_Registration_2026',
  CACHE_TTL_SECONDS: 45,
  ...
};
```

**الأمان:** الـ ID يظهر فقط في الـ Backend. لا تضع Spreadsheet ID داخل أي ملف Frontend.

---

## 4. الحفظ والصلاحيات

1. احفظ المشروع (`Ctrl+S`) وسمِّه مثلًا `Ezaees-Festival-Dashboard-Backend`.
2. من شريط الأدوات اضغط **Deploy ← New deployment**.

---

## 5. النشر كـ Web App

1. أيقونة العتاد بجانب **Select type** → اختر **Web app**.
2. **Description**: `Ezaees Dashboard API v1`.
3. **Execute as**: `Me` (أنت — بحيث تُقرأ البيانات بصلاحياتك).
4. **Who has access**:
   - للعمل العام (double-click محلي + GitHub Pages): `Anyone`.
   - إذا أردت تقييد الوصول: `Anyone with a Google account` أو محدد،
     لكن تذكّر أن الحماية الأعمق تتم عبر عدم كشف البيانات الحساسة في الاستجابات،
     وبعدم نشر الـ URL إلا للجهة المناسبة.
5. اضغط **Deploy** ووافق على الأذونات.
   *Android project access*: تجاوزها (البيانات المطلوبة لا تدخل نطاقها).

---

## 6. أخذ رابط الـ Web App

ستحصل على رابط بصيغة:

```
https://script.google.com/macros/s/AKfyc.../exec
```

> نسخة `/dev` مخصصة للتجربة، و`/exec` هي نسخة النشر الثابتة.
> استخدم `/exec` في الـ Frontend.

---

## 7. وضع الرابط في `js/config.js`

افتح ملف الـ Frontend `js/config.js` وضع الرابط هنا — **مرة واحدة فقط**:

```javascript
var API_CONFIG = {
  BASE_URL: 'https://script.google.com/macros/s/AKfyc.../exec',
  ...
};
```

---

## 8. اختبار الـ API يدويًا

افتح في المتصفح:

1. `.../exec?action=dashboard` → يجب أن ترى JSON يحتوي `summary`,
   `activities`, `governorates`, `daily`, `englishLevels`, `eventTypes`.
2. `.../exec?action=registrations&page=1&pageSize=50&search=محمد` → JSON مع
   `total`, `totalPages`, `rows` مع إخفاء الـ PII.
3. `.../exec?action=dashboard&callback=test` → يجب أن ترى `test({...});` (JSONP).
4. `.../exec?action=rows` → مصفوفة `rows`، كل صف فيها **11 عمودًا** بالترتيب
   الموضح في `fields`: المحافظة، نوع الحدث، المستوى، اليوم، اسم النشاط، وقته،
   مكانه، لغته، مدته، الجهة، ووقت التسجيل.

### لماذا `action=rows`

هذه هي النقطة التي تُحدث الفرق في سرعة الفلترة. قبلها كان كل تركيبة فلاتر
(مثل «القاهرة + يوم 25 سبتمبر») طلبًا منفصلاً إلى Apps Script، وقِسنا زمنه
الفعل�� بين **2 و25 ثانية**، مع أخطاء 404 متقطعة من Google.

الآن يسحب المتصفح هذا الإسقاط **مرة واحدة فقط**، ثم يعيد حساب كل التجميعات
محليًا في أقل من **3 مللي ثانية**. النتيجة: الفلترة فورية، وتعمل حتى بدون
إنترنت، ولا تنتظر أي رد من الخادم.

الإسقاط يحتوي **أعمدة الفلترة فقط** — لا اسم، ولا تليفون، ولا رقم قومي، ولا
بريد. صفوف الجدول نفسها تظل تأتي من `action=registrations` مع إخفاء الـ PII
على السيرفر.

إن لم يكن `action=rows` منشورًا بعد، **لا يوجد أي ضرر**: الواجهة تكتشف
`Unknown action` تلقائيًا وترجع إلى السلوك القديم بطلب لكل فلتر — فتعمل
كfeature detection لا كشرط تشغيل.

---

## 9. أسئلة شائعة

**لماذا يعمل الـ fetch من ملف محلي `file://`؟**
نشر "Execute as Me + Anyone" يجعل الاستجابة تحمل `Access-Control-Allow-Origin: *`.
وحتى إن سدّت بعض المتصفحات هذا المسار، يتحول الـ Frontend تلقائيًا إلى JSONP.

**كيف أحدّث البيانات/الشيت؟**
بمجرد تعديل الـ Sheet تظهر البيانات الجديدة خلال مدة الـ Cache
(افتراضيًا 5 دقائق، `CACHE_TTL_SECONDS` في `Config.gs`) دون أي عملية نشر
جديدة. المتصفح يحتفظ أيضًا بنسخة من إسقاط `action=rows` لمدة 10 دقائق،
فيبقى تغيير الفلترة فوريًا حتى مع انقطاع الشبكة.

**كيف أحدّث تعديلات الـ Backend؟**
دائمًا: **Deploy → Manage deployments ← Edit ← Version: New version → Deploy**.