#!/usr/bin/env bash
# Configura el cron de sync-phones (una sola vez).
# Uso: ./setup-cron.sh https://TU_PROJECT_REF.supabase.co TU_BOOTSTRAP_SECRET
# O: export SUPABASE_URL y BOOTSTRAP_SECRET y ejecutá ./setup-cron.sh

SUPABASE_URL="${1:-$SUPABASE_URL}"
BOOTSTRAP_SECRET="${2:-$BOOTSTRAP_SECRET}"

if [ -z "$SUPABASE_URL" ] || [ -z "$BOOTSTRAP_SECRET" ]; then
  echo "Uso: $0 <SUPABASE_URL> <BOOTSTRAP_SECRET>"
  echo "Ej: $0 https://abc123.supabase.co mi-secreto-de-32-chars"
  exit 1
fi

URL="${SUPABASE_URL%/}/functions/v1/bootstrap-cron-config"
BODY="{\"bootstrap_secret\":\"$BOOTSTRAP_SECRET\"}"

curl -s -X POST "$URL" -H "Content-Type: application/json" -d "$BODY" || exit 1
echo ""
exit 0
