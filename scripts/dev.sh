#!/usr/bin/env bash
# Lance le tableau de bord, le worker et le tunnel ngrok vers le worker.
# Ctrl+C arrête les trois : pas de worker orphelin qui continuerait à
# consommer la file d'attente en arrière-plan.
#
# NGROK_DOMAIN (facultatif, dans .env) : le domaine statique gratuit fourni par
# ngrok. Sans lui, l'adresse change à chaque lancement et il faut la recopier
# dans la configuration du webhook de l'app Meta.
set -euo pipefail
cd "$(dirname "$0")/.."

env_value() { grep -E "^$1=" .env 2>/dev/null | tail -1 | cut -d= -f2- | tr -d "\"'" || true; }

WORKER_PORT="$(env_value PORT)"; WORKER_PORT="${WORKER_PORT:-3001}"
NGROK_DOMAIN="$(env_value NGROK_DOMAIN)"
WEBHOOK_PUBLIC_URL="$(env_value WEBHOOK_PUBLIC_URL)"

for port in 3000 "$WORKER_PORT" 4040; do
  if lsof -iTCP:"$port" -sTCP:LISTEN -nP >/dev/null 2>&1; then
    echo "Le port $port est déjà pris — une ancienne instance tourne encore ?"
    echo "  lsof -iTCP:$port -sTCP:LISTEN -nP"
    exit 1
  fi
done

cleanup() { trap - EXIT INT TERM; kill 0 2>/dev/null || true; }
trap cleanup EXIT INT TERM

ngrok_args=(http "$WORKER_PORT" --log=stdout --log-level=warn)
[ -n "$NGROK_DOMAIN" ] && ngrok_args+=(--url="https://$NGROK_DOMAIN")
ngrok "${ngrok_args[@]}" > .ngrok.log 2>&1 &

public_url=""
for _ in $(seq 1 20); do
  public_url="$(curl -s localhost:4040/api/tunnels 2>/dev/null | grep -oE '"public_url":"https://[^"]+"' | head -1 | cut -d'"' -f4 || true)"
  [ -n "$public_url" ] && break
  sleep 0.5
done

if [ -z "$public_url" ]; then
  echo "ngrok n'a pas démarré — voir .ngrok.log"; cat .ngrok.log; exit 1
fi

echo
echo "  Webhook public : $public_url/webhook"
if [ "$public_url/webhook" != "$WEBHOOK_PUBLIC_URL" ]; then
  echo "  ⚠ Différent de WEBHOOK_PUBLIC_URL dans .env ($WEBHOOK_PUBLIC_URL)."
  echo "    Meta n'enverra rien tant que l'URL de rappel de l'app n'est pas mise à jour."
fi
echo

pnpm --parallel --filter "./apps/*" dev
