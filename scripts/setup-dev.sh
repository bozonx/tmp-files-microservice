#!/bin/bash
set -e

echo "Setting up development environment..."

# 1. Create .env.development if it doesn't exist
if [ ! -f .env.development ]; then
  echo "Creating .env.development from example..."
  cp .env.development.example .env.development
fi
if [ ! -f docker-compose.yml ]; then
  echo "Creating docker-compose.yml from example..."
  cp docker-compose.dev.example.yml docker-compose.yml
fi

# 2. Start Garage
echo "Starting Garage..."
docker compose -f docker-compose.yml up -d --remove-orphans garage

# 3. Wait for services
echo "Waiting for services to be healthy..."
sleep 5

# 4. Install dependencies
echo "Installing dependencies..."
pnpm install

# 5. Initialize Garage
echo "Initializing Garage bucket and key..."
bash scripts/init-garage.sh

echo ""
echo "✅ Development environment is ready!"
echo ""
echo "Services:"
echo "  - Garage S3 API: http://localhost:3900"
echo "  - Garage Admin API: http://localhost:3903"
echo ""
echo "To start the application:"
echo "  pnpm dev"
echo ""
