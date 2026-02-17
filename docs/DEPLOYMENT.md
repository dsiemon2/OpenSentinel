# Deployment Guide

This document covers production deployment options for OpenSentinel v2.7.0. The recommended approach is Docker Compose, which handles all dependencies automatically.

## Table of Contents

- [Docker Compose Deployment (Recommended)](#docker-compose-deployment-recommended)
- [Bare Metal Deployment](#bare-metal-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Tunnel Support](#tunnel-support)
- [Updating](#updating)
- [Backup Strategy](#backup-strategy)
- [Monitoring](#monitoring)
- [Resource Requirements](#resource-requirements)

---

## Docker Compose Deployment (Recommended)

Docker Compose is the primary deployment method. It orchestrates all required services: the OpenSentinel application, PostgreSQL with pgvector, Redis, and an optional nginx reverse proxy for SSL termination.

### Services

| Service | Image | Description |
|---------|-------|-------------|
| `opensentinel` | Built from `Dockerfile` | Main application (Bun runtime, TypeScript) |
| `postgres` | `pgvector/pgvector:pg16` | PostgreSQL 16 with pgvector extension for vector embeddings |
| `redis` | `redis:7-alpine` | Redis 7 for caching, job queues (BullMQ), and session storage |
| `nginx` | `nginx:alpine` | Reverse proxy with SSL (production profile only) |

### Quick Start

1. Clone the repository and create your environment file:

```bash
git clone https://github.com/your-org/opensentinel.git
cd opensentinel
cp .env.example .env
```

2. Edit `.env` with your API keys and configuration:

```env
CLAUDE_API_KEY=sk-ant-api03-...
TELEGRAM_BOT_TOKEN=your-token-here
TELEGRAM_CHAT_ID=your-chat-id
DB_PASSWORD=a-secure-password
```

3. Start all services:

```bash
docker compose up -d
```

4. Verify the deployment:

```bash
# Check service status
docker compose ps

# Check health
curl http://localhost:8030/health

# View logs
docker compose logs -f opensentinel
```

### Environment Variables

Environment variables are passed to the container via the `.env` file in the project root. Docker Compose automatically reads this file. The `DATABASE_URL` and `REDIS_URL` are configured within `docker-compose.yml` to point to the internal container hostnames (`postgres` and `redis`), so you do not need to set those in your `.env` file for Docker deployments.

### Volumes

The following named volumes persist data across container restarts:

| Volume | Mount Point | Purpose |
|--------|-------------|---------|
| `postgres_data` | `/var/lib/postgresql/data` | PostgreSQL database files |
| `redis_data` | `/data` | Redis AOF persistence |
| `opensentinel_data` | `/app/data` | Application data (uploads, generated files) |
| `opensentinel_logs` | `/app/logs` | Application log files |

### Health Checks

All services include health checks:

- **opensentinel**: `curl -f http://localhost:8030/health` (every 30s, 10s timeout, 3 retries, 10s start period)
- **postgres**: `pg_isready -U opensentinel -d opensentinel` (every 10s, 5s timeout, 5 retries)
- **redis**: `redis-cli ping` (every 10s, 5s timeout, 5 retries)

The `opensentinel` service depends on `postgres` and `redis` with `condition: service_healthy`, ensuring the database and cache are ready before the application starts.

### SSL with Nginx (Production Profile)

The nginx reverse proxy is defined under the `production` Docker Compose profile. To deploy with SSL:

1. Place your SSL certificates in `docker/ssl/`:

```bash
mkdir -p docker/ssl
cp /path/to/fullchain.pem docker/ssl/
cp /path/to/privkey.pem docker/ssl/
```

2. Configure `docker/nginx.conf` with your domain and certificate paths.

3. Start with the production profile:

```bash
docker compose --profile production up -d
```

This exposes ports 80 and 443 via nginx, which proxies requests to the OpenSentinel application on the internal network.

### Ports

| Port | Service | Description |
|------|---------|-------------|
| `8030` | opensentinel | API server and web dashboard |
| `5445` | postgres | PostgreSQL (mapped from container port 5432) |
| `6379` | redis | Redis |
| `80` | nginx | HTTP (production profile only) |
| `443` | nginx | HTTPS (production profile only) |

---

## Bare Metal Deployment

For deployments without Docker, install all dependencies directly on the host system.

### Prerequisites

- **Bun** >= 1.0 (runtime)
- **PostgreSQL** 16 with the pgvector extension
- **Redis** 7

### Installation

1. Install Bun:

```bash
curl -fsSL https://bun.sh/install | bash
```

2. Install PostgreSQL 16 and pgvector:

```bash
# Ubuntu/Debian
sudo apt-get install postgresql-16
sudo apt-get install postgresql-16-pgvector

# Enable the extension
sudo -u postgres psql -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

3. Install Redis 7:

```bash
sudo apt-get install redis-server
```

4. Clone and install the application:

```bash
git clone https://github.com/your-org/opensentinel.git
cd opensentinel
bun install
```

5. Set up the database:

```bash
# Create the database and user
sudo -u postgres psql -c "CREATE USER opensentinel WITH PASSWORD 'your-password';"
sudo -u postgres psql -c "CREATE DATABASE opensentinel OWNER opensentinel;"
sudo -u postgres psql -d opensentinel -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Run migrations
bun run db:migrate
```

6. Build the web frontend:

```bash
cd src/web && bun install && bun run build && cd ../..
```

7. Create your `.env` file and start:

```bash
cp .env.example .env
# Edit .env with your configuration
bun run start
```

### systemd Service

Create a systemd service file for automatic startup and restart:

```ini
# /etc/systemd/system/opensentinel.service

[Unit]
Description=OpenSentinel AI Assistant
After=network.target postgresql.service redis-server.service
Requires=postgresql.service redis-server.service

[Service]
Type=simple
User=opensentinel
Group=opensentinel
WorkingDirectory=/opt/opensentinel
EnvironmentFile=/opt/opensentinel/.env
ExecStart=/usr/local/bin/bun run src/index.ts
Restart=always
RestartSec=5
StandardOutput=append:/var/log/opensentinel/stdout.log
StandardError=append:/var/log/opensentinel/stderr.log

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/opensentinel/data /opt/opensentinel/logs /var/log/opensentinel

[Install]
WantedBy=multi-user.target
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable opensentinel
sudo systemctl start opensentinel
sudo systemctl status opensentinel
```

---

## Kubernetes Deployment

OpenSentinel includes Kubernetes support via the enterprise module at `src/core/enterprise/kubernetes.ts`. The following manifests provide a starting point for Kubernetes deployment.

### Namespace and ConfigMap

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: opensentinel
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: opensentinel-config
  namespace: opensentinel
data:
  NODE_ENV: "production"
  PORT: "8030"
  DATABASE_URL: "postgresql://opensentinel:$(DB_PASSWORD)@postgres-service:5432/opensentinel"
  REDIS_URL: "redis://redis-service:6379"
```

### Secret

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: opensentinel-secrets
  namespace: opensentinel
type: Opaque
stringData:
  CLAUDE_API_KEY: "sk-ant-api03-..."
  DB_PASSWORD: "your-secure-password"
  TELEGRAM_BOT_TOKEN: "your-token"
  TELEGRAM_CHAT_ID: "your-chat-id"
```

### Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: opensentinel
  namespace: opensentinel
spec:
  replicas: 1
  selector:
    matchLabels:
      app: opensentinel
  template:
    metadata:
      labels:
        app: opensentinel
    spec:
      containers:
        - name: opensentinel
          image: opensentinel:latest
          ports:
            - containerPort: 8030
          envFrom:
            - configMapRef:
                name: opensentinel-config
            - secretRef:
                name: opensentinel-secrets
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2000m"
              memory: "4Gi"
          livenessProbe:
            httpGet:
              path: /health
              port: 8030
            initialDelaySeconds: 15
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /health
              port: 8030
            initialDelaySeconds: 5
            periodSeconds: 10
          volumeMounts:
            - name: data
              mountPath: /app/data
            - name: logs
              mountPath: /app/logs
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: opensentinel-data
        - name: logs
          persistentVolumeClaim:
            claimName: opensentinel-logs
```

### Service

```yaml
apiVersion: v1
kind: Service
metadata:
  name: opensentinel-service
  namespace: opensentinel
spec:
  selector:
    app: opensentinel
  ports:
    - protocol: TCP
      port: 8030
      targetPort: 8030
  type: ClusterIP
```

For PostgreSQL and Redis, consider using managed services (e.g., Amazon RDS, ElastiCache) or dedicated Kubernetes operators (e.g., CloudNativePG, Redis Operator).

---

## Tunnel Support

OpenSentinel includes built-in tunnel support for exposing your local instance to the internet without configuring nginx or SSL certificates. This is useful for webhook callbacks, mobile access, demo environments, and development.

### Quick Start

```env
TUNNEL_ENABLED=true
TUNNEL_PROVIDER=cloudflare  # cloudflare, ngrok, or localtunnel
```

On startup, OpenSentinel will automatically create a tunnel and print the public URL:

```
[Tunnel] Public URL: https://random-words.trycloudflare.com
```

### Provider Comparison

| Provider | Auth Required | Custom Subdomain | Binary Required |
|----------|--------------|------------------|-----------------|
| Cloudflare | No | No (random URL) | Yes (`cloudflared`) |
| ngrok | Yes (`TUNNEL_AUTH_TOKEN`) | Yes (paid plan) | Yes (`ngrok`) |
| localtunnel | No | Yes (`TUNNEL_SUBDOMAIN`) | No (npm package) |

### Installing Tunnel Binaries

**Cloudflare (recommended)**:
```bash
# Linux
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared
chmod +x /usr/local/bin/cloudflared

# macOS
brew install cloudflared
```

**ngrok**:
```bash
# Install from https://ngrok.com/download
ngrok config add-authtoken YOUR_TOKEN
```

**localtunnel**: No installation needed (uses the `localtunnel` npm package).

---

## Updating

### Docker Compose

```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose down
docker compose build
docker compose up -d

# Verify
docker compose ps
curl http://localhost:8030/health
```

### Bare Metal

```bash
# Pull latest changes
git pull

# Install any new dependencies
bun install

# Run database migrations
bun run db:migrate

# Rebuild the web frontend
cd src/web && bun run build && cd ../..

# Restart the service
sudo systemctl restart opensentinel
```

---

## Backup Strategy

### PostgreSQL

Perform regular backups using `pg_dump`:

```bash
# Full database dump
pg_dump -U opensentinel -h localhost -p 5445 opensentinel > backup_$(date +%Y%m%d_%H%M%S).sql

# Compressed backup
pg_dump -U opensentinel -h localhost -p 5445 -Fc opensentinel > backup_$(date +%Y%m%d_%H%M%S).dump

# Restore from dump
pg_restore -U opensentinel -h localhost -p 5445 -d opensentinel backup.dump
```

For Docker deployments, run the backup command inside the container:

```bash
docker exec opensentinel-postgres pg_dump -U opensentinel opensentinel > backup.sql
```

Schedule automated backups with cron:

```bash
# Daily backup at 2 AM
0 2 * * * docker exec opensentinel-postgres pg_dump -U opensentinel opensentinel | gzip > /backups/opensentinel_$(date +\%Y\%m\%d).sql.gz
```

### Redis

Redis is configured with AOF (Append Only File) persistence. Backups can be created from RDB snapshots:

```bash
# Trigger an RDB snapshot
docker exec opensentinel-redis redis-cli BGSAVE

# Copy the dump file
docker cp opensentinel-redis:/data/dump.rdb ./redis_backup_$(date +%Y%m%d).rdb
```

### Data Volumes

For Docker volumes, use `docker cp` or volume backup tools:

```bash
# Backup application data volume
docker run --rm -v opensentinel_opensentinel_data:/data -v $(pwd):/backup alpine \
  tar czf /backup/opensentinel_data_$(date +%Y%m%d).tar.gz -C /data .

# Backup logs volume
docker run --rm -v opensentinel_opensentinel_logs:/data -v $(pwd):/backup alpine \
  tar czf /backup/opensentinel_logs_$(date +%Y%m%d).tar.gz -C /data .
```

---

## Monitoring

### Health Endpoint

OpenSentinel exposes a health check endpoint:

```
GET /health
```

Returns HTTP 200 when the application is running and connected to its dependencies. Use this endpoint for load balancer health checks, uptime monitoring, and container orchestration probes.

```bash
curl -f http://localhost:8030/health
```

### Observability Module

The built-in observability system (`src/core/observability/`) provides:

- **Metrics collection**: Track request counts, response times, tool execution durations, and memory usage.
- **Context viewer** (`src/core/observability/context-viewer.ts`): Inspect conversation context, active tools, and memory state in real time.
- **Alerting** (`src/core/observability/alerting.ts`): Configure alert rules for anomalous behavior, errors, or threshold breaches. Alerts can be routed to Telegram, Discord, Slack, email, or webhooks.

### Prometheus Metrics

When `PROMETHEUS_ENABLED=true`, OpenSentinel exports metrics in Prometheus text exposition format at the `/metrics` endpoint (configurable via `PROMETHEUS_PATH`).

**Available metrics:**

| Metric | Type | Description |
|--------|------|-------------|
| `opensentinel_requests_total` | Counter | Total requests processed (labels: channel, model) |
| `opensentinel_tokens_input_total` | Counter | Total input tokens consumed (labels: model) |
| `opensentinel_tokens_output_total` | Counter | Total output tokens produced (labels: model) |
| `opensentinel_errors_total` | Counter | Total errors encountered (labels: type) |
| `opensentinel_tool_executions_total` | Counter | Total tool executions (labels: tool, success) |
| `opensentinel_response_latency_ms` | Histogram | Response latency in milliseconds |
| `opensentinel_tool_duration_ms` | Histogram | Tool execution duration in milliseconds |
| `opensentinel_uptime_seconds` | Gauge | Process uptime |
| `opensentinel_memory_heap_bytes` | Gauge | Heap memory usage |

**Prometheus scrape configuration:**

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'opensentinel'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:8030']
    metrics_path: '/metrics'
```

**Quick test:**

```bash
curl http://localhost:8030/metrics
```

### Log Monitoring

Application logs are written to stdout/stderr and to the logs volume (`/app/logs` in Docker). Monitor logs with:

```bash
# Docker Compose
docker compose logs -f opensentinel

# systemd
journalctl -u opensentinel -f

# Log files
tail -f /app/logs/opensentinel.log
```

---

## Resource Requirements

### Minimum

| Resource | Requirement |
|----------|-------------|
| CPU | 1 core |
| RAM | 1 GB |
| Storage | 5 GB (database, logs, generated files) |

### Recommended

| Resource | Requirement |
|----------|-------------|
| CPU | 2 cores |
| RAM | 4 GB |
| Storage | 20 GB+ (depends on memory/document ingestion volume) |

### Notes

- PostgreSQL with pgvector uses additional memory for vector index operations. Allocate at least 512 MB for PostgreSQL.
- Redis is configured with a 256 MB memory limit (`maxmemory 256mb`) and LRU eviction policy.
- Disk usage grows with conversation history, RAG memory embeddings, document ingestion, and generated files. Monitor and expand storage as needed.
- The Dockerfile installs additional system packages for Playwright browser automation, screenshot capture (scrot), OCR (tesseract-ocr), and audio processing (PulseAudio), which add approximately 200 MB to the container image size.
