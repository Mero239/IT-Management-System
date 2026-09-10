@echo off
REM دبل كليك على الملف ده لتثبيت النظام — زي أي برنامج عادي.
REM (بيشغّل install.ps1 من غير ما تحتاج تفتح PowerShell بنفسك)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
pause
