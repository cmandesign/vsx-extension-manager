#!/bin/bash
# Initial Let's Encrypt certificate setup
# Run this once on first deployment: ./init-letsencrypt.sh

set -e

if [ -z "$DOMAIN" ]; then
  echo "Usage: DOMAIN=marketplace.example.com EMAIL=you@example.com ./init-letsencrypt.sh"
  exit 1
fi

EMAIL="${EMAIL:-}"
STAGING="${STAGING:-0}" # Set to 1 to use Let's Encrypt staging (for testing)

echo "### Creating dummy certificate for $DOMAIN ..."
mkdir -p ./certbot-init
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:4096 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
    -subj '/CN=localhost'" certbot

echo "### Starting nginx ..."
docker compose up -d nginx

echo "### Deleting dummy certificate ..."
docker compose run --rm --entrypoint "\
  rm -rf /etc/letsencrypt/live/$DOMAIN && \
  rm -rf /etc/letsencrypt/archive/$DOMAIN && \
  rm -rf /etc/letsencrypt/renewal/$DOMAIN.conf" certbot

echo "### Requesting real certificate from Let's Encrypt ..."
staging_arg=""
if [ "$STAGING" = "1" ]; then
  staging_arg="--staging"
fi

email_arg=""
if [ -n "$EMAIL" ]; then
  email_arg="--email $EMAIL"
else
  email_arg="--register-unsafely-without-email"
fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    -d $DOMAIN \
    --agree-tos \
    --no-eff-email \
    --force-renewal" certbot

echo "### Reloading nginx ..."
docker compose exec nginx nginx -s reload

echo "### Done! Certificate obtained for $DOMAIN"
echo "### Run 'docker compose up -d' to start all services"
