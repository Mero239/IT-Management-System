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

## النشر على الإنترنت بدومين حقيقي و HTTPS (nginx + certbot)

الخطوات دي لما يكون عندك دومين حقيقي (مثلاً `itms.example.com`) موجّه بـ DNS (A record) لعنوان IP السيرفر، وعايز الموقع يبقى متاح على الإنترنت بـ HTTPS بدال ما يفضل داخلي بس.

### المتطلبات الإضافية
- دومين موجّه لعنوان IP السيرفر
- بورت 80 و443 مفتوحين في فايروول السيرفر **وكمان** في Security Group/Firewall بتاع مزود الاستضافة لو سيرفر سحابي

### 1. شغّل التطبيق على بورت داخلي (مش 80)
في `.env`:
```
HTTP_PORT=8080
```
(سيبنا بورت 80 و443 فاضيين لـ nginx، والتطبيق نفسه بيشتغل داخليًا على 8080)
```bash
docker compose up -d --build
```

### 2. ثبّت nginx و certbot
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 3. إعداد nginx كـ reverse proxy
```bash
sudo nano /etc/nginx/sites-available/<دومينك>
```
الصق المحتوى ده (غيّر `<دومينك>`):
```nginx
server {
    listen 80;
    server_name <دومينك>;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 30M;
    }
}
```
```bash
sudo ln -s /etc/nginx/sites-available/<دومينك> /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4. شهادة SSL مجانية (Let's Encrypt)
```bash
sudo certbot --nginx -d <دومينك>
```
لما يسأل "Redirect HTTP to HTTPS?" اختار **Redirect**. التجديد بيحصل تلقائيًا (certbot بيظبط systemd timer بنفسه)؛ للتأكد:
```bash
sudo certbot renew --dry-run
sudo systemctl status certbot.timer
```

### 5. قفل أي بورتات مباشرة قديمة
لو كان عندك نسخة تطوير شغالة قبل كده (`start.sh`، أو systemd services بتشغّله تلقائي)، لازم توقفها وتتأكد إنها معطّلة نهائيًا:
```bash
sudo systemctl stop it-backend.service it-frontend.service 2>/dev/null
sudo systemctl disable it-backend.service it-frontend.service 2>/dev/null
```
وقفل أي بورت غير 80/443/22 في الفايروول:
```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

### النتيجة
`https://<دومينك>` → nginx (SSL) → التطبيق (8080) → الباك إند داخليًا (زي ما هو متظبط في `frontend/nginx.conf` أصلاً).

### لو عندك بيانات من نسخة تطوير قديمة (`start.sh`) عايز تنقلها لـ Docker
البيانات في وضع التطوير بتتخزن مباشرة جوه `backend/` (`it_management.db`، `ticket_attachments/`، `agreements/`، ملفات الإعدادات `*.json`)، لكن Docker بيحطها في volume منفصل. لنقلها:
```bash
docker compose down
docker run --rm \
  -v $(pwd)/backend:/old:ro \
  -v <اسم-مجلد-المشروع>_it_data:/data \
  alpine sh -c "
    cp -v /old/it_management.db /data/ 2>/dev/null
    cp -v /old/email_agent_config.json /data/ 2>/dev/null
    cp -v /old/telegram_config.json /data/ 2>/dev/null
    cp -v /old/monitor_config.json /data/ 2>/dev/null
    cp -rv /old/ticket_attachments /data/ 2>/dev/null
    cp -rv /old/agreements /data/ 2>/dev/null
  "
docker compose up -d
```
اسم الـ volume الافتراضي هو `<اسم مجلد المشروع>_it_data` — تأكد منه بـ `docker volume ls`.

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
