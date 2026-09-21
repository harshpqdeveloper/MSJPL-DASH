@echo off
REM Double-click to start Excel Auto Sync. Leave this window open: whenever you save an
REM .xls/.xlsx in the excel\ folder, it uploads to Supabase and the Vercel site refreshes.
cd /d "%~dp0"
echo Starting Excel Auto Sync... (keep this window open; press Ctrl+C to stop)
call npm run sync
pause
