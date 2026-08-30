#!/bin/sh
set -e

if [ -f /desktop-bin/client.exe ]; then
  cp /desktop-bin/client.exe /usr/share/nginx/html/client.exe
  echo "Binaire desktop copié : /client.exe"
else
  echo "ATTENTION : aucun binaire desktop trouvé dans /desktop-bin"
fi

exec nginx -g "daemon off;"
