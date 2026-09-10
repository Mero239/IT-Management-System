# التثبيت الذاتي (Self-Hosted) لشركة تانية

الدليل ده لأي حد عايز يشغّل نسخته الخاصة من النظام على سيرفر شركته، منفصلة تمامًا عن أي نسخة تانية.

## المتطلبات
- سيرفر (أو جهاز) فيه [Docker](https://docs.docker.com/get-docker/) و Docker Compose
- منفذ 80 فاضي (أو أي منفذ تاني تحدده)

## التشغيل — الطريقة السهلة (معالج تثبيت)

### Linux / macOS
```bash
git clone https://github.com/Mero239/IT-Management-System.git
cd IT-Management-System
./install.sh
```

### Windows Server
1. نزّل المشروع (Code → Download ZIP من GitHub، أو `git clone` لو عندك Git)
2. لو مفيش Docker متثبت، `install.ps1` هيديك تعليمات التثبيت الصحيحة (⚠️ **Docker Desktop مش بيشتغل على Windows Server** — لازم "Docker Engine" بطريقة مختلفة، السكريبت بيوضحها)
3. **دبل كليك على `install.bat`** — زي أي برنامج تقليدي، وهيشغّل المعالج تلقائي

السكريبت (في النسختين) بيسألك كام سؤال بسيط (المنفذ، كلمة المرور الافتراضية، بيانات أول حساب أدمن)، ويظبط كل حاجة لوحده — بناء الصور، تشغيل الخدمات، وإنشاء أول حساب أدمن تقدر تسجّل دخول بيه فورًا.

## التشغيل — يدوي (لو عايز تحكم أكتر)

```bash
git clone https://github.com/Mero239/IT-Management-System.git
cd IT-Management-System
cp .env.example .env   # عدّل القيم بالمعلومات بتاعتك
docker compose up -d
```

النظام بيبدأ بدون أي مستخدمين هنا — لازم تضيف أول حساب أدمن يدويًا عن طريق قاعدة البيانات، أو تستخدم `install.sh`/`install.bat` بدل الطريقة دي (بيعمل الخطوة دي أوتوماتيك).

---

افتح المتصفح على `http://<عنوان-السيرفر>` — كده خلصت. البيانات (قاعدة البيانات + كل الإعدادات) بتتخزن في Docker volume دائم، تفضل موجودة حتى لو عملت `docker compose down` وشغّلت تاني.

كلمة المرور الافتراضية لأي حساب جديد: القيمة اللي حطيتها وقت التثبيت (أو في `DEFAULT_PASSWORD` بملف `.env`).

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
