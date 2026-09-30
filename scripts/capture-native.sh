#!/usr/bin/env bash
# Captures native iOS Simulator screenshots of a review build (EXPO_PUBLIC_REVIEW=1).
# Usage: scripts/capture-native.sh <passenger|driver> <out-dir> <plan-file>
# Plan lines: <name>|<route>|<phone or empty>|<wait seconds>|<optional curl-able setup path>
set -euo pipefail
APP=$1; OUT=$2; PLAN=$3
API=${API_URL:-http://localhost:4010}
mkdir -p "$OUT"
while IFS='|' read -r name route phone wait setup; do
  [[ -z "$name" || "$name" == \#* ]] && continue
  if [[ -n "${setup:-}" ]]; then curl -s -X POST "$API$setup" -H 'Content-Type: application/json' -d '{}' >/dev/null; fi
  body=$(printf '{"app":"%s","route":"%s","phone":%s}' "$APP" "$route" "$( [[ -n "$phone" ]] && printf '"%s"' "$phone" || echo null )")
  curl -s -X POST "$API/dev/navigate" -H 'Content-Type: application/json' -d "$body" >/dev/null
  sleep "${wait:-4}"
  xcrun simctl io booted screenshot "$OUT/$name.png" >/dev/null 2>&1
  echo "captured $name"
done < "$PLAN"
