# معالج تثبيت نظام إدارة تكنولوجيا المعلومات لـ Windows Server.
# شغّله من PowerShell (كأدمن): .\install.ps1
# أو دبل كليك على install.bat.

$ErrorActionPreference = "Stop"
Set-Location -Path $PSScriptRoot

Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  إعداد نظام إدارة تكنولوجيا المعلومات" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════"
Write-Host ""

# ── 1. Docker check ──────────────────────────────────────────────────────────
$dockerExists = Get-Command docker -ErrorAction SilentlyContinue
if (-not $dockerExists) {
    Write-Host "❌ Docker مش متثبت على السيرفر ده." -ForegroundColor Red
    Write-Host ""
    Write-Host "ملاحظة مهمة: Docker Desktop مش بيشتغل على Windows Server —" -ForegroundColor Yellow
    Write-Host "محتاج تثبّت 'Docker Engine' بدل كده. الخطوات (شغّلها كأدمن):" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Install-Module -Name DockerMsftProvider -Repository PSGallery -Force"
    Write-Host "  Install-Package -Name docker -ProviderName DockerMsftProvider -Force"
    Write-Host "  Restart-Computer -Force"
    Write-Host ""
    Write-Host "بعد ما السيرفر يعيد التشغيل، شغّل السكريبت ده تاني." -ForegroundColor Yellow
    Read-Host "اضغط Enter للخروج"
    exit 1
}

$composeCheck = docker compose version 2>$null
if (-not $composeCheck) {
    Write-Host "❌ Docker Compose مش متاح. حدّث Docker لآخر إصدار." -ForegroundColor Red
    Read-Host "اضغط Enter للخروج"
    exit 1
}
Write-Host "✅ Docker موجود" -ForegroundColor Green
Write-Host ""

# ── 2. .env (company settings) ───────────────────────────────────────────────
if (Test-Path ".env") {
    Write-Host "ℹ️  ملف .env موجود بالفعل — هيتم استخدام إعداداته الحالية." -ForegroundColor Cyan
    Write-Host "   (احذفه وشغّل السكريبت تاني لو عايز تعيد الإعداد من الأول)"
} else {
    Write-Host "── إعدادات النظام (اضغط Enter لأي سؤال عشان تاخد القيمة الافتراضية) ──"

    $HttpPort = Read-Host "المنفذ اللي هيوصل منه المستخدمين للتطبيق [80]"
    if ([string]::IsNullOrWhiteSpace($HttpPort)) { $HttpPort = "80" }

    $OtpEmail = Read-Host "بريد يستلم نسخة إشعارات استعادة كلمة المرور (اختياري)"

    $DefaultPassword = Read-Host "كلمة المرور الافتراضية لأي حساب جديد [Welcome@2024]"
    if ([string]::IsNullOrWhiteSpace($DefaultPassword)) { $DefaultPassword = "Welcome@2024" }

    @"
HTTP_PORT=$HttpPort
OTP_NOTIFY_EMAIL=$OtpEmail
DEFAULT_PASSWORD=$DefaultPassword
JWT_SECRET=
"@ | Out-File -FilePath ".env" -Encoding utf8 -NoNewline

    Write-Host "✅ تم إنشاء .env" -ForegroundColor Green
}
Write-Host ""

# ── 3. Build & start ──────────────────────────────────────────────────────────
Write-Host "🚀 جاري بناء وتشغيل النظام (أول مرة بتاخد كام دقيقة)..." -ForegroundColor Cyan
docker compose up -d --build

Write-Host "⏳ في انتظار اكتمال إقلاع الباك-إند..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        docker compose exec -T backend python3 -c "import requests; requests.get('http://localhost:8000/')" 2>$null | Out-Null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
}
if ($ready) {
    Write-Host "✅ النظام شغّال" -ForegroundColor Green
} else {
    Write-Host "⚠️  استنى شوية إضافي أو راجع اللوج بـ: docker compose logs backend" -ForegroundColor Yellow
}
Write-Host ""

# ── 4. First admin account ──────────────────────────────────────────────────
Write-Host "── إنشاء أول حساب مسؤول (Admin) ──"
$AdminName  = Read-Host "الاسم الكامل"
$AdminEmail = Read-Host "البريد الإلكتروني"

if ($AdminName -and $AdminEmail) {
    docker compose exec -T -e ADMIN_NAME="$AdminName" -e ADMIN_EMAIL="$AdminEmail" backend python3 -c @"
import os
from database import SessionLocal
import models
db = SessionLocal()
name = os.environ['ADMIN_NAME']
email = os.environ['ADMIN_EMAIL'].strip().lower()
existing = db.query(models.ITEngineer).filter(models.ITEngineer.email == email).first()
if existing:
    print('⚠️  الحساب موجود بالفعل بنفس البريد.')
else:
    db.add(models.ITEngineer(name=name, email=email, role='IT Manager', permission_level='admin'))
    db.commit()
    print('✅ تم إنشاء حساب المسؤول')
"@
} else {
    Write-Host "⏭️  تم التخطي — تقدر تضيف حساب لاحقًا مباشرة من قاعدة البيانات."
}

Write-Host ""
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
$envContent = Get-Content ".env" -Raw
$portMatch = [regex]::Match($envContent, "HTTP_PORT=(.*)")
$passMatch = [regex]::Match($envContent, "DEFAULT_PASSWORD=(.*)")
$port = if ($portMatch.Success) { $portMatch.Groups[1].Value.Trim() } else { "80" }
$pass = if ($passMatch.Success) { $passMatch.Groups[1].Value.Trim() } else { "Welcome@2024" }

Write-Host "  🎉 خلصنا! النظام شغّال على:" -ForegroundColor Green
Write-Host "     http://localhost:$port"
Write-Host ""
Write-Host "  سجّل دخول بالبريد اللي حطيته، وكلمة المرور: $pass"
Write-Host "  (هيطلب منك تغييرها أول ما تدخل)"
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Read-Host "اضغط Enter للإغلاق"
