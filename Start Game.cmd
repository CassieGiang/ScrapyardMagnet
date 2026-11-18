@echo off
setlocal
cd /d "%~dp0"
echo Scrapyard Magnet
echo Open http://127.0.0.1:4173 in your browser after the server starts.
echo Keep this window open while playing. Press Ctrl+C to stop.
echo.
node server.js
if errorlevel 1 (
  echo.
  echo Could not start the server. If the port is already in use,
  echo try opening http://127.0.0.1:4173 in your browser.
  pause
)
