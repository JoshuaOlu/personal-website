@echo off
rem Double-click this (or run it) to apply any site updates waiting in your Downloads folder.
cd /d "%~dp0.."
ruby scripts\apply-update.rb %*
echo.
pause
