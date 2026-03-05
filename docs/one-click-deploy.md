# OpenSentinel One-Click Deploy Guide

Quick-start deployment guide for OpenSentinel, a self-hosted personal AI assistant.

---

## Minimum Requirements

- **CPU:** 1 vCPU (2 vCPU recommended)
- **RAM:** 1 GB (2 GB recommended)
- **Storage:** 10 GB
- **OS:** Ubuntu 22.04+ / Debian 12+ / any Linux with Docker

---

## 1. Docker Compose (Recommended)

The fastest way to get OpenSentinel running. Docker Compose starts the app, PostgreSQL 16 with pgvector, and Redis 7 in a single command.

```bash
git clone https://github.com/dsiemon2/OpenSentinel.git
cd OpenSentinel
cp .env.example .env
# Edit .env with your CLAUDE_API_KEY (minimum required)
docker compose up -d
```

This starts three containers:

- **OpenSentinel app** on port **8030**
- **PostgreSQL 16** with the pgvector extension
- **Redis 7** for caching and job queues

Once running, open the web dashboard at **http://localhost:8030**.

To stop everything:

```bash
docker compose down
```

To view logs:

```bash
docker compose logs -f
```

---

## 2. Railway

Railway supports Docker-based deploys directly from a GitHub repository.

1. Fork [https://github.com/dsiemon2/OpenSentinel.git](https://github.com/dsiemon2/OpenSentinel.git) to your GitHub account.
2. Log in to [Railway](https://railway.app) and create a new project.
3. Connect your forked repository.
4. Add a **PostgreSQL** plugin and a **Redis** plugin from the Railway dashboard.
5. Set environment variables in the Railway service settings (see the quick reference below). `DATABASE_URL` and `REDIS_URL` are provided automatically by the plugins.
6. Deploy.

Railway will build the Docker image and start the service. The assigned Railway URL serves the web dashboard.

> **Note:** A Railway template (`railway.json`) is coming soon for true one-click deploy.

---

## 3. DigitalOcean

Use a DigitalOcean Droplet with Docker pre-installed.

1. Create a Droplet:
   - Image: **Ubuntu 24.04** from the Docker marketplace listing (Docker pre-installed)
   - Size: 1 GB RAM / 1 vCPU minimum (2 GB recommended)
   - Choose a datacenter region close to you

2. SSH into the Droplet and deploy:

```bash
ssh root@YOUR_DROPLET_IP
git clone https://github.com/dsiemon2/OpenSentinel.git
cd OpenSentinel
cp .env.example .env
nano .env   # Set CLAUDE_API_KEY at minimum
docker compose up -d
```

3. Point your domain's DNS A record to the Droplet IP.

4. For HTTPS, uncomment the HTTPS server block in `docker/nginx.conf` and configure your SSL certificates (e.g., via Let's Encrypt / Certbot).

The dashboard will be available at `http://YOUR_DROPLET_IP:8030` (or your domain once DNS propagates).

---

## 4. Bare Metal / VPS

Manual installation without Docker.

### Install dependencies

- [Bun](https://bun.sh) (latest)
- PostgreSQL 16 with the [pgvector](https://github.com/pgvector/pgvector) extension
- Redis 7

### Deploy

```bash
git clone https://github.com/dsiemon2/OpenSentinel.git
cd OpenSentinel
bun install
cp .env.example .env
# Edit .env: set CLAUDE_API_KEY, DATABASE_URL, REDIS_URL
bun run db:migrate
cd src/web && bun run build
cd ../..
```

### Set up systemd service

Create `/etc/systemd/system/opensentinel.service`:

```ini
[Unit]
Description=OpenSentinel
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=deploy
WorkingDirectory=/path/to/OpenSentinel
ExecStart=/usr/local/bin/bun run src/cli.ts start
Restart=on-failure
EnvironmentFile=/path/to/.env

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable opensentinel
sudo systemctl start opensentinel
```

### Set up Nginx reverse proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8030;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Secure with SSL using Certbot:

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## Environment Variables Quick Reference

| Variable | Required | Description |
|---|---|---|
| `CLAUDE_API_KEY` | Yes | Anthropic API key. Minimum needed to start. |
| `DATABASE_URL` | Auto in Docker | PostgreSQL connection string. Auto-configured in Docker Compose. |
| `REDIS_URL` | Auto in Docker | Redis connection string. Auto-configured in Docker Compose. |
| `TELEGRAM_BOT_TOKEN` | No | Enable Telegram messaging interface. |
| `DISCORD_BOT_TOKEN` | No | Enable Discord messaging interface. |
| `LLM_PROVIDER` | No | Switch AI model provider. Options: `anthropic`, `openai`, `xai`, `gemini`, `groq`, `mistral`, `ollama`. Defaults to `anthropic`. |

See `.env.example` for the full list of available configuration options.
