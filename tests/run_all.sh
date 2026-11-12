#!/bin/bash
# Yayın öncesi tam test: tip kontrolü, derleme, Chrome'da uçtan uca testler ve MP4 doğrulaması.
# Kullanım: bash tests/run_all.sh [URL]   (URL verilmezse yerel derleme test edilir)
set -e
cd "$(dirname "$0")/.."
OUT=test-output; mkdir -p $OUT; cp tests/fixtures/* $OUT/
npm run typecheck
npm run build
BASE=${1:-http://localhost:4173/}
if [ -z "$1" ]; then (npx vite preview --port 4173 --strictPort >/tmp/preview.log 2>&1 &); sleep 2; fi
export BASE_URL=$BASE
python3 tests/e2e/smoke.py $OUT
python3 tests/e2e/aspects.py $OUT
python3 tests/e2e/roundtrip.py $OUT
python3 tests/e2e/premium.py $OUT
python3 tests/e2e/bombparty.py $OUT
python3 tests/e2e/bombparty2.py $OUT
python3 tests/e2e/music.py $OUT
python3 tests/e2e/music_edition.py $OUT
python3 tests/e2e/story.py $OUT
python3 tests/e2e/story_workspace.py $OUT
python3 tests/e2e/speedramp.py $OUT
python3 tests/e2e/rewind_duck.py $OUT
python3 tests/e2e/bigwinframe.py $OUT
python3 tests/e2e/premiumframe.py $OUT
python3 tests/e2e/asset_library.py $OUT
python3 tests/e2e/format_builder.py $OUT
python3 tests/e2e/emoji_studio.py $OUT
python3 tests/e2e/emoji_digits.py $OUT
python3 tests/e2e/flow.py $OUT
ffprobe -v error -show_entries stream=codec_type,codec_name,width,height:format=duration -of compact $OUT/flow.mp4
echo "TÜM TESTLER TAMAM"
