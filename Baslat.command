#!/bin/bash
# Mac'te çift tıklayarak Slotolog Motion Studio'yu başlatır.
cd "$(dirname "$0")"
if ! command -v npm >/dev/null 2>&1; then
  echo "Node.js bulunamadı. https://nodejs.org adresinden LTS sürümünü kurup tekrar dene."
  read -n 1 -s -r -p "Kapatmak için bir tuşa bas..."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "İlk kurulum yapılıyor (1-2 dk)..."
  npm install || exit 1
fi
( sleep 3; open "http://localhost:5173" ) &
npm run dev -- --port 5173
