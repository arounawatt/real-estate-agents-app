#!/usr/bin/env bash
# Arrête tout ce que `pnpm dev` a pu laisser derrière lui : tunnels ngrok,
# workers orphelins (qui continuent de consommer la file d'attente sans
# écouter de port) et serveur Next.js de ce projet.
set -uo pipefail
cd "$(dirname "$0")/.."
root="$PWD"

stop() {
  local label="$1" pattern="$2"
  local pids; pids="$(pgrep -f "$pattern" || true)"
  if [ -z "$pids" ]; then echo "  $label : rien à arrêter"; return; fi
  echo "  $label : $(echo "$pids" | wc -l | tr -d ' ') processus arrêté(s)"
  kill $pids 2>/dev/null
  sleep 1
  pids="$(pgrep -f "$pattern" || true)"
  [ -n "$pids" ] && kill -9 $pids 2>/dev/null
}

stop "ngrok" "ngrok"
stop "worker" "$root/apps/worker/.*tsx"
stop "dashboard" "$root/apps/dashboard/.*next"
rm -f .ngrok.log
