.PHONY: help install dev build start stop clean test lint docker-up docker-down db-push db-studio logs

# Default target
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development
install: ## Install dependencies
	npm install

dev: ## Start development server
	npm run dev

build: ## Build the application
	npm run build

start: ## Start production server
	npm start

stop: ## Stop all running processes
	pkill -f "tsx server/index.ts" || true
	pkill -f "node dist/index.js" || true

clean: ## Clean build artifacts and dependencies
	rm -rf dist/
	rm -rf node_modules/
	rm -rf client/dist/

# Testing and Quality
test: ## Run tests
	npm test

lint: ## Run linting
	npm run lint || echo "Linting not configured"

check: ## Type check
	npm run check

# Database
db-push: ## Push database schema changes
	npm run db:push

db-studio: ## Open database studio
	npx drizzle-kit studio

db-reset: ## Reset database (WARNING: Destroys all data)
	@read -p "Are you sure you want to reset the database? This will destroy all data! (y/N): " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		docker-compose down postgres -v; \
		docker volume rm $$(docker volume ls -q | grep postgres) || true; \
		docker-compose up -d postgres; \
		sleep 5; \
		make db-push; \
	else \
		echo "Database reset cancelled."; \
	fi

# Docker
docker-up: ## Start all services with Docker Compose
	docker-compose up -d

docker-down: ## Stop all Docker services
	docker-compose down

docker-build: ## Build Docker image
	docker-compose build

docker-logs: ## Show Docker logs
	docker-compose logs -f

docker-clean: ## Clean Docker resources
	docker-compose down -v
	docker system prune -f

# Logs
logs: ## Show application logs
	tail -f logs/app.log || echo "No log file found"

logs-error: ## Show error logs
	tail -f logs/error.log || echo "No error log file found"

# Setup
setup: ## Full setup for new development environment
	@echo "Setting up AI Copilot development environment..."
	make install
	@if [ ! -f .env ]; then \
		cp .env.example .env; \
		echo "Created .env file from template. Please edit with your API keys."; \
	fi
	make docker-up
	@echo "Waiting for services to start..."
	sleep 10
	make db-push
	@echo ""
	@echo "Setup complete! Next steps:"
	@echo "1. Edit .env file with your API keys"
	@echo "2. Run 'make dev' to start development server"
	@echo "3. Open http://localhost:5000"

# Production deployment
deploy: ## Deploy to production
	@echo "Building application..."
	make build
	@echo "Deploying with Docker Compose..."
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
	@echo "Deployment complete!"

# Backup and restore
backup-db: ## Backup database
	@mkdir -p backups
	@timestamp=$$(date +%Y%m%d_%H%M%S); \
	docker-compose exec -T postgres pg_dump -U postgres ai_copilot > backups/db_backup_$$timestamp.sql; \
	echo "Database backed up to backups/db_backup_$$timestamp.sql"

restore-db: ## Restore database from backup (usage: make restore-db FILE=backup.sql)
	@if [ -z "$(FILE)" ]; then \
		echo "Usage: make restore-db FILE=backup_file.sql"; \
		exit 1; \
	fi
	@read -p "Are you sure you want to restore from $(FILE)? This will overwrite current data! (y/N): " confirm; \
	if [ "$$confirm" = "y" ] || [ "$$confirm" = "Y" ]; then \
		docker-compose exec -T postgres psql -U postgres -d ai_copilot < $(FILE); \
		echo "Database restored from $(FILE)"; \
	else \
		echo "Restore cancelled."; \
	fi

# Security
security-scan: ## Run security scan
	@echo "Running security scan..."
	npm audit
	@echo "Security scan complete"

update-deps: ## Update dependencies
	npm update
	npm audit fix

# Monitoring
health-check: ## Check service health
	@echo "Checking service health..."
	@curl -f http://localhost:5000/api/health || echo "App service not responding"
	@curl -f http://localhost:8000/api/v1/heartbeat || echo "Chroma service not responding"
	@docker-compose exec -T postgres pg_isready -U postgres || echo "PostgreSQL not responding"

# Development utilities
seed-data: ## Seed database with sample data (development only)
	@if [ "$$NODE_ENV" = "production" ]; then \
		echo "Cannot seed data in production environment"; \
		exit 1; \
	fi
	@echo "Seeding database with sample data..."
	node scripts/seed.js || echo "Seed script not found"

reset-dev: ## Reset development environment
	make docker-down
	make clean
	make setup

# Documentation
docs: ## Generate documentation
	@echo "Generating documentation..."
	npm run docs || echo "Documentation generation not configured"

# Environment specific
env-check: ## Check environment configuration
	@echo "Checking environment configuration..."
	@echo "NODE_ENV: ${NODE_ENV}"
	@echo "Port: ${PORT}"
	@echo "Database URL configured: $$([ -n "$$DATABASE_URL" ] && echo "Yes" || echo "No")"
	@echo "OpenAI API Key configured: $$([ -n "$$OPENAI_API_KEY" ] && echo "Yes" || echo "No")"
	@echo "JWT Secret configured: $$([ -n "$$JWT_SECRET" ] && echo "Yes" || echo "No")"

env-prod: ## Switch to production environment
	@echo "Switching to production environment..."
	@echo "NODE_ENV=production" > .env.local
	@echo "Remember to set production API keys and database URL"

env-dev: ## Switch to development environment
	@echo "Switching to development environment..."
	@echo "NODE_ENV=development" > .env.local

# Quick commands for common workflows
quick-start: ## Quick start for returning developers
	make docker-up
	sleep 5
	make dev

quick-reset: ## Quick reset and restart
	make stop
	make docker-down
	make docker-up
	sleep 5
	make dev

# Install system dependencies (Ubuntu/Debian)
install-system-deps: ## Install system dependencies for security tools
	@echo "Installing system dependencies..."
	@if command -v apt-get >/dev/null 2>&1; then \
		sudo apt-get update; \
		sudo apt-get install -y nmap dnsutils whois curl wget netcat-openbsd; \
	elif command -v yum >/dev/null 2>&1; then \
		sudo yum install -y nmap bind-utils whois curl wget nc; \
	elif command -v brew >/dev/null 2>&1; then \
		brew install nmap bind whois curl wget netcat; \
	else \
		echo "Package manager not supported. Please install manually: nmap, dig, whois, curl, wget, nc"; \
	fi
