#!/bin/bash
set -e

echo "Setting up development environment..."

# 1. Create .env.development if it doesn't exist
if [ ! -f .env.development ]; then
  echo "Creating .env.development from example..."
  cp .env.development.example .env.development
fi


# 3. Start Redis and Garage
echo "Starting Redis and Garage..."
docker compose -f docker-compose.yml up -d --remove-orphans redis garage

# 4. Wait for services
echo "Waiting for services to be healthy..."
sleep 5

# 5. Install dependencies
echo "Installing dependencies..."
pnpm install

# 6. Initialize Garage
echo "Initializing Garage bucket and key..."
bash scripts/init-garage.sh

echo ""
echo "✅ Development environment is ready!"
echo ""
echo "Services:"
echo "  - Redis: localhost:6379"
echo "  - Garage S3 API: http://localhost:3900"
echo "  - Garage Admin API: http://localhost:3903"
echo ""
echo "To start the application:"
echo "  pnpm dev"
echo ""
