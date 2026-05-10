#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Creating .env from .env.example..."
  cp .env.example .env

  if command -v openssl >/dev/null 2>&1; then
    SECRET="$(openssl rand -hex 32)"
  else
    SECRET="$(head -c 32 /dev/urandom | xxd -p -c 32)"
  fi
  sed -i "s|replace-with-openssl-rand-hex-32|${SECRET}|g" .env

  if [ -n "${CODESPACE_NAME:-}" ]; then
    DOMAIN="${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-app.github.dev}"
    URL="https://${CODESPACE_NAME}-3000.${DOMAIN}"
    sed -i "s|http://localhost:3000|${URL}|g" .env
    echo "Codespace detected; AUTH_URL set to ${URL}"
  fi

  echo ".env created."
else
  echo ".env already exists, skipping bootstrap."
fi

echo "Installing dependencies..."
npm install

echo "Resetting database with demo seed..."
npm run db:reset

echo ""
echo "Setup complete."
echo "Run:   npm run dev"
echo "Login: kyle@henleyhub.com / demo"
