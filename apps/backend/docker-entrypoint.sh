#!/bin/sh
set -e

# Wait for database to be ready before running any DB operations
wait_for_db() {
  echo "Waiting for database..."
  retries=30
  until node -e "
    const { PrismaClient } = require('@prisma/client');
    const p = new PrismaClient();
    p.\$connect().then(() => { p.\$disconnect(); process.exit(0); }).catch(() => process.exit(1));
  " 2>/dev/null; do
    retries=$((retries - 1))
    if [ "$retries" -le 0 ]; then
      echo "ERROR: Database not reachable after 30 attempts, giving up."
      exit 1
    fi
    echo "Database not ready, retrying in 2s... ($retries attempts left)"
    sleep 2
  done
  echo "Database is ready."
}

case "$1" in
  migrate)
    wait_for_db
    echo "Running Prisma migrations..."
    npx prisma migrate deploy --schema ./src/prisma/schema
    echo "Migrations complete."
    ;;
  seed)
    wait_for_db
    echo "Running database seed..."
    node prisma/seed.js
    echo "Seed complete."
    ;;
  setup)
    wait_for_db
    echo "Running migrations + seed..."
    npx prisma migrate deploy --schema ./src/prisma/schema
    node prisma/seed.js
    echo "Setup complete."
    ;;
  start)
    exec dumb-init -- node dist/main
    ;;
  full)
    wait_for_db
    echo "Running migrations + seed, then starting app..."
    npx prisma migrate deploy --schema ./src/prisma/schema
    node prisma/seed.js
    exec dumb-init -- node dist/main
    ;;
  *)
    exec dumb-init -- "$@"
    ;;
esac
