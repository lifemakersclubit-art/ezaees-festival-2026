# Ezaees Festival 2026 — Registration Intelligence

لوحة تحليل وتتبع تسجيلات مهرجان **Ezaees Festival** لعام 2026
ضمن نشاط **نوادي صناع الحياة بالجامعات المصرية**.

| | |
|---|---|
| Backend | **Google Apps Script** Web App (يقرأ Google Sheets) |
| Frontend | Vanilla HTML + CSS + JavaScript (بدون Build) |
| المصدر الوحيد للبيانات | Google Sheets |
| التشغيل | Double-click على `index.html` أو GitHub Pages |

---

## المعمارية

```
                 Google Sheets
                      │
                      ▼
            Google Apps Script  (backend/)
                    Web App API
                      │
              ┌───────┴────────┐
        Data Processing   API Response
              └───────┬────────┘
                      ▼
              HTML/CSS/JS Frontend
                      │
                      ▼
             Dashboard / Charts
```

- الـ Frontend **لا يحتوي أي نسخة من البيانات** — لا JSON، لا CSV، لا LocalStorage،
  لا IndexedDB، لا hardcoded dataset.
- الـ Backend يقرأ الشيت دفعة واحدة (`getDataRange().getValues()`)، يقوم
  بجميع عمليات التجميع والتحليل، ويعيد JSON صغيرًا فقط.

---

## البنية

```
ezaees-festival-dashboard/
├── index.html            # لوحة المهرجان الرئيسية (Dashboard)
├── registrations.html    # جدول التسجيلات + بحث/فلاتر/ترقيم صفحات
├── css/
│   ├── main.css          # الهوية، الـ tokens، الأساسيات
│   ├── dashboard.css     # تخطيط وتحكم كل الأقسام
│   └── responsive.css    # استجابة لكل المقاسات
├── js/
│   ├── config.js         # ⬅ ضع رابط Apps Script هنا فقط
│   ├── api.js            # عميل الـ API (fetch + fallback JSONP)
│   ├── utils.js          # أدوات العرض (والـ demo الواضح عند تفعيله)
│   ├── activity-parser.js# تنسيق عرض بيانات العروض (التحليل الحقيقي في Backend)
│   ├── charts.js         # غلاف Chart.js (5 أنواع رسوم)
│   ├── dashboard.js      # منطق صفحة index
│   └── registrations.js  # منطق صفحة التسجيلات
├── assets/
│   ├── logo/mark.svg
│   └── fonts/README.txt  # الخط التزييني Arslan (اختياري)
├── backend/              # ⬅ نسخه داخل مشروع Apps Script
│   ├── Code.gs           # نقطة الدخول + Router
│   ├── Config.gs         # ⬅ ضع Spreadsheet ID هنا فقط
│   ├── DataService.gs
│   ├── AnalyticsService.gs
│   └── Utils.gs
└── README.md
    DESIGN_DIRECTION.md
    GOOGLE_APPS_SCRIPT_SETUP.md
```

> ملاحظة: الـ Backend و الـ Frontend داخل نفس الـ repo لسهولة الصيانة،
> لكنهما **منطقيًا منفصلان**: الـ Apps Script مستقل تمامًا ويعمل بمفرده،
> ولا يعتمد الـ Frontend عليه إلا عبر الـ URL.

---

## API (Backend)

| Endpoint | الوصف |
|---|---|
| `?action=dashboard` | جميع إحصائيات الـ Dashboard في **طلب واحد**: summary + activities + governorates + daily + englishLevels + eventTypes |
| `?action=registrations&page=&pageSize=&search=&governorate=&eventType=&englishLevel=&day=&activity=` | صفحات التسجيلات — بحث/فلاتر/ترقيم **داخل الخادم** |
| `?action=activities` | شريحة تحليل العروض |
| `?action=governorates` | شريحة التوزيع الجغرافي |
| `?action=daily` | شريحة الاتجاه اليومي |

كل endpoints يقبل `callback=` (JSONP) للعمل من `file://` عند الحاجة.

انظر `GOOGLE_APPS_SCRIPT_SETUP.md` للخطوات الكاملة.

---

## التشغيل المحلي (Double Click)

1. انشر الـ Backend (راجع `GOOGLE_APPS_SCRIPT_SETUP.md`).
2. ضع رابط `/exec` في `js/config.js` → `API_CONFIG.BASE_URL`.
3. افتح `index.html` بضغطة مزدوجة — لا Node، لا server، لا build.

---

## الأداء

- طلب واحد فقط عند فتح الـ Dashboard، والاستجابة مجمّعة وصغيرة.
- `CacheService` (TTL 45 ثانية) فقط لـ aggregates — لا Caching لأي PII أو صور.
- الـ Frontend لا يحمل Dataset ولا يفلتر آلاف السجلات؛ كل ذلك Server-side.
- Chart.js فقط من CDN؛ لا Frameworks.

---

## الخصوصية والأمان

- Spreadsheet ID فقط في `backend/Config.gs`، لا يظهر في الـ Frontend إطلاقًا.
- لا تُرسل صور البطاقات/الشخصية، ولا الرقم القومي كاملًا، ولا أرقام هواتف كاملة.
- الرقم القومي يُقنّع: `298012******791` — الهاتف: `0103******60` — الإيميل: `a******@gmail.com`.
- البيانات الحساسة تُقنّع **داخل الـ Backend** قبل مغادرة الخادم.

---

## Design

الخص ص التوجه البصري في `DESIGN_DIRECTION.md`:
Editorial + Cultural Data Dashboard بألوان المهرجان
(`#014976`, `#FBAE42`, `#F17206`, `#F4F3EF`) وخط Alexandria (مع Arslan التزييني).

---

## الاختبار

1. **الـ Backend**: افتح الـ API بيدويًا (dashboard + registrations + pagination + search + filters + cache).
2. **محليًا**: افتح `index.html` بـ double-click وتأكد من اتصال API.
3. **GitHub Pages**: ارفع مجلد الـ Frontend كاملًا وراجع الجداول/الرسوم.
4. **Mobile / Desktop**: استجابة ومرور أفقي محكوم للجداول فقط.
5. **الحالات**: skeleton أثناء التحميل، وواجهة خطأ واضحة عند فشل الـ API.

---

## حالة البيانات (❌ ممنوع)

لا يظهر في هذا المشروع إطلاقًا:

- Registrations/CSV/JSON ثابت داخل الـ Frontend
- تخزين في LocalStorage/IndexedDB
- LIMITS / Target / Capacity / Remaining
- تحليل التكرارات (Duplicates)
- مقاييس جودة البيانات (Data Quality)

التركيز فقط على: **Registration Analytics & Monitoring**.