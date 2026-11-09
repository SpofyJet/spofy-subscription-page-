#!/bin/sh

echo "Starting entrypoint script..."
# A secret from the environment survives restarts, so the 30-minute session cookie of an open page
# keeps working after a deploy. Without it a new one is made on every start, as before.
if [ -z "$INTERNAL_JWT_SECRET" ]; then
    INTERNAL_JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
fi
export INTERNAL_JWT_SECRET

echo "Entrypoint script completed."
exec "$@"
