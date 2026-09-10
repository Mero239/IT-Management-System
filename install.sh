#!/usr/bin/env bash
# معالج تثبيت نظام إدارة تكنولوجيا المعلومات — زي "Setup" للبرامج الجاهزة.
# شغّله من جذر المشروع: ./install.sh
set -e

cd "$(dirname "$0")"

echo "════════════════════════════════════════════"
echo "  إعداد نظام إدارة تكنولوجيا المعلومات"
echo "════════════════════════════════════════════"
echo

# ── 1. Docker check ──────────────────────────────────────────────────────────
if ! command -v docker &> /dev/null; then
  echo "❌ Docker مش متثبت على الجهاز/السيرفر ده."
  echo "   ثبّته الأول من: https://docs.docker.com/get-docker/"
  exit 1
fi
if ! docker compose version &> /dev/null; then
  echo "❌ Docker Compose مش متاح. حدّث Docker لآخر إصدار (بييجي مدمج فيه)."
  exit 1
fi
echo "✅ Docker موجود"
echo

# ── 2. .env (company settings) ───────────────────────────────────────────────
if [ -f .env ]; then
  echo "ℹ️  ملف .env موجود بالفعل — هيتم استخدام إعداداته الحالية."
  echo "   (احذفه وشغّل السكريبت تاني لو عايز تعيد الإعداد من الأول)"
else
  echo "── إعدادات النظام (اضغط Enter لأي سؤال عشان تاخد القيمة الافتراضية) ──"
  read -p "المنفذ اللي هيوصل منه المستخدمين للتطبيق [80]: " HTTP_PORT
  HTTP_PORT=${HTTP_PORT:-80}

  read -p "بريد يستلم نسخة إشعارات استعادة كلمة المرور (اختياري): " OTP_NOTIFY_EMAIL

  read -p "كلمة المرور الافتراضية لأي حساب جديد [Welcome@2024]: " DEFAULT_PASSWORD
  DEFAULT_PASSWORD=${DEFAULT_PASSWORD:-Welcome@2024}

  cat > .env <<EOF
HTTP_PORT=$HTTP_PORT
OTP_NOTIFY_EMAIL=$OTP_NOTIFY_EMAIL
DEFAULT_PASSWORD=$DEFAULT_PASSWORD
JWT_SECRET=
EOF
  echo "✅ تم إنشاء .env"
fi
echo

# ── 3. Build & start ──────────────────────────────────────────────────────────
echo "🚀 جاري بناء وتشغيل النظام (أول مرة بتاخد كام دقيقة)..."
docker compose up -d --build

echo "⏳ في انتظار اكتمال إقلاع الباك-إند..."
for i in $(seq 1 30); do
  if docker compose exec -T backend python3 -c "import requests; requests.get('http://localhost:8000/')" &> /dev/null; then
    break
  fi
  sleep 2
done
echo "✅ النظام شغّال"
echo

# ── 4. First admin account ──────────────────────────────────────────────────
echo "── إنشاء أول حساب مسؤول (Admin) ──"
read -p "الاسم الكامل: " ADMIN_NAME
read -p "البريد الإلكتروني: " ADMIN_EMAIL

if [ -n "$ADMIN_NAME" ] && [ -n "$ADMIN_EMAIL" ]; then
  docker compose exec -T -e ADMIN_NAME="$ADMIN_NAME" -e ADMIN_EMAIL="$ADMIN_EMAIL" backend python3 -c "
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
"
else
  echo "⏭️  تم التخطي — تقدر تضيف حساب لاحقًا مباشرة من قاعدة البيانات."
fi

echo
echo "════════════════════════════════════════════"
PORT=$(grep '^HTTP_PORT=' .env | cut -d= -f2)
PASS=$(grep '^DEFAULT_PASSWORD=' .env | cut -d= -f2)
echo "  🎉 خلصنا! النظام شغّال على:"
echo "     http://localhost:${PORT:-80}"
echo
echo "  سجّل دخول بالبريد اللي حطيته، وكلمة المرور: ${PASS:-Welcome@2024}"
echo "  (هيطلب منك تغييرها أول ما تدخل)"
echo "════════════════════════════════════════════"
