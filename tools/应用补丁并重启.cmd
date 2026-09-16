@echo off
setlocal
title dsh-inapp-chat - patch the desktop shell
set "PS=powershell"
where pwsh >nul 2>nul && set "PS=pwsh"

echo ============================================================
echo  dsh-inapp-chat : in-app chat window for DeepSeek Harness
echo.
echo  This will:
echo    1. close DeepSeek Harness
echo    2. build the shell patch from YOUR installed app.asar
echo    3. back up the original and swap the patch in
echo    4. start DeepSeek Harness again
echo ============================================================
echo.
%PS% -NoProfile -ExecutionPolicy Bypass -File "%~dp0dsh-shell-patch.ps1" -Action install -Restart -Patched "%~dp0app.patched.asar"

echo.
echo ------------------------------------------------------------
echo  Undo:  powershell -ExecutionPolicy Bypass -File dsh-shell-patch.ps1 -Action restore -Restart
echo ------------------------------------------------------------
pause
