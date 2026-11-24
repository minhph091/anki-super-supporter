@echo off
title AnkiSuperSupporter
echo ============================================
echo   Starting AnkiSuperSupporter (Server + UI)
echo   Web App: http://localhost:5173
echo   API:     http://127.0.0.1:3847
echo ============================================
cd /d "%~dp0"
start "" http://localhost:5173
npm run dev
pause
