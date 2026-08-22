#!/bin/sh
set -e

if [ -f /desktop-bin/client.AppImage ]; then
  cp /desktop-bin/client.AppImage /usr/share/nginx/html/client.AppImage
  echo "Binaire desktop copié : /client.AppImage"
else
  echo "ATTENTION : aucun binaire desktop trouvé dans /desktop-bin"
fi

exec nginx -g "daemon off;"