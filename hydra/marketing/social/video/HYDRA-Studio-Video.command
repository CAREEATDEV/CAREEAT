#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js n'est pas installe. Installe-le depuis https://nodejs.org puis relance."
  read -n1 -r -p "Appuie sur une touche..."
  exit 1
fi
if [ ! -d node_modules ]; then
  echo "Premiere utilisation : installation... (quelques minutes)"
  npm install && npx playwright install chromium
fi
echo "Studio lance. Laisse cette fenetre ouverte."
node studio-server.js
