@echo off
rem Double-click this file to open the site console in your browser.
cd /d "%~dp0"
where ruby >nul 2>nul
if errorlevel 1 (
  echo Ruby was not found. Install it from https://rubyinstaller.org then try again.
  pause
  exit /b 1
)
ruby console\server.rb
pause
