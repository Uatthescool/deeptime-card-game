#!/usr/bin/env bash
# Makes a card face for every Creature in Decks 1–3 that has art, four at a time, then checks each frame.
cd "$(dirname "$0")/../.."
export FONTCONFIG_FILE="$PWD/design/fonts/fonts.conf"
# Roster lines are "deck | key | diet | period | name | art | licence | made"; keep keys with art,
# leaving out the two cards that already have in-game faces.
keys=$(npx vite-node design/work/roster.ts 2>/dev/null | grep "|" | while IFS='|' read -r deck key diet period name art rest; do
  key=$(echo "$key" | xargs); art=$(echo "$art" | xargs)
  [ "$art" != "none" ] && [ "$key" != "amargasaurus" ] && [ "$key" != "nautilus" ] && echo "$key"
done)
echo "$(echo "$keys" | wc -l) cards to make"
mkdir -p design/work/logs
echo "$keys" | xargs -P 4 -I KEY sh -c 'npx vite-node design/work/make-card.ts -- KEY > design/work/logs/KEY.log 2>&1 && echo "made KEY" || echo "FAILED KEY"'
for k in $keys; do
  printf "%-20s " "$k"
  if [ -f "design/card-faces/$k.png" ]; then node design/work/verify-frame.mjs design/templates/nautilus-reference.webp "design/card-faces/$k.png" | sed 's/.*identical: /frame /'; else echo "missing"; fi
done
