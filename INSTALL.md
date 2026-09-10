# التثبيت الذاتي (Self-Hosted) لشركة تانية

الدليل ده لأي حد عايز يشغّل نسخته الخاصة من النظام على سيرفر شركته، منفصلة تمامًا عن أي نسخة تانية.

## المتطلبات
- سيرفر (أو جهاز) فيه [Docker](https://docs.docker.com/get-docker/) و Docker Compose
- منفذ 80 فاضي (أو أي منفذ تاني تحدده)

## التشغيل (3 خطوات)

```bash
git clone https://github.com/Mero239/IT-Management-System.git
cd IT-Management-System
cp .env.example .env   # عدّل القيم بالمعلومات بتاعتك (اختياري لأول تجربة)
docker compose up -d
```

افتح المتصفح على `http://<عنوان-السيرفر>` — كده خلصت. البيانات (قاعدة البيانات + كل الإعدادات) بتتخزن في Docker volume دائم، تفضل موجودة حتى لو عملت `docker compose down` وشغّلت تاني.

## تسجيل الدخول لأول مرة
النظام بيبدأ بدون أي مستخدمين. لازم تضيف أول حساب أدمن يدويًا عن طريق قاعدة البيانات، أو (الأسهل) اطلب مني أضيفه لك مباشرة بعد أول تشغيل.

كلمة المرور الافتراضية لأي حساب جديد: القيمة اللي حطيتها في `DEFAULT_PASSWORD` بملف `.env` (افتراضيًا `Mobica@2024` — يفضّل تغيّرها).

## تخصيص النظام لشركتك

| الإعداد | فين | ملاحظة |
|---|---|---|
| اسم البرنامج وشعاره داخل التطبيق | `frontend/src/i18n/translations.js` → `app.name` / `app.tagline` | نسختين (عربي وإنجليزي) |
| الشعار في شاشات الدخول العامة | `frontend/src/constants.js` → `BRAND_TAGLINE` | |
| كلمة المرور الافتراضية | `.env` → `DEFAULT_PASSWORD` **و** `frontend/src/constants.js` → `DEFAULT_PASSWORD` | **لازم القيمتين متطابقتين** |
| بريد إشعار OTP للأدمن | `.env` → `OTP_NOTIFY_EMAIL` | سيبه فاضي لو مش عايز الميزة دي |
| مفتاح تشفير الجلسات (JWT) | `.env` → `JWT_SECRET` | لو سبته فاضي، بيتولّد تلقائيًا ويتحفظ — أأمن اختيار افتراضي |

بعد أي تعديل في ملفات الفرونت-إند، لازم تعيد البناء:
```bash
docker compose up -d --build frontend
```

## إعدادات تُضبط من داخل التطبيق نفسه (مش محتاجة تعديل كود)
بعد تسجيل الدخول كأدمن، من صفحات الإعدادات:
- بريد الدعم الفني (IMAP + AI provider) — `/email-agent`
- بوت تيليجرام — `/admin/channels`
- مراقبة السيرفرات + واتساب — `/admin/monitor`
- قواعد التوجيه التلقائي للتذاكر — `/admin/ticket-routing`

## النسخ الاحتياطي
كل البيانات في Docker volume باسم `it_data`. لعمل نسخة احتياطية:
```bash
docker run --rm -v it-management-system_it_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/backup.tar.gz -C /data .
```

## التطوير المحلي (بدون Docker)
لو عايز تعدّل الكود وتجرّبه مباشرة، استخدم `start.sh` الموجود بالفعل (محتاج Python 3.12+ و Node 20+).
