# OpenSentinel.ai - Complete Domain Setup Guide

> **Domain:** `opensentinel.ai`
> **Server:** IONOS VPS at `74.208.129.33` (Ubuntu 24.04)
> **Hostname:** `server.gogreenpaperlessinitiative.com`

This guide follows the exact same pattern as your existing domains (gogreenworkflowhub.com, gogreenaiconcierge.com, etc).

---

## Step 1: Register the Domain

**Recommended registrar:** [Cloudflare Registrar](https://dash.cloudflare.com) or [Porkbun](https://porkbun.com) (cheapest .ai)

| Registrar | .ai Price/yr | Notes |
|-----------|-------------|-------|
| Porkbun | ~$53/yr | Cheapest, reliable |
| Cloudflare | ~$70/yr | At-cost, free DNS/CDN |
| Namecheap | ~$75/yr | Free WHOIS privacy |

After registration, point the nameservers to wherever you'll manage DNS (Cloudflare recommended for free DNS management even if you register elsewhere).

---

## Step 2: DNS Records

Set ALL of these at your DNS provider (Cloudflare, or your registrar's DNS panel):

### A Records (point domain to your VPS)

| Type | Name | Value | TTL | Proxy |
|------|------|-------|-----|-------|
| A | `@` (root) | `74.208.129.33` | Auto | OFF (DNS only) |
| A | `www` | `74.208.129.33` | Auto | OFF |
| A | `mail` | `74.208.129.33` | Auto | OFF (MUST be DNS only) |
| A | `api` | `74.208.129.33` | Auto | Optional |
| A | `docs` | `74.208.129.33` | Auto | Optional |
| A | `app` | `74.208.129.33` | Auto | Optional |
| A | `admin` | `74.208.129.33` | Auto | Optional |
| A | `status` | `74.208.129.33` | Auto | Optional |

> **IMPORTANT:** The `mail` subdomain MUST NOT be proxied through Cloudflare (grey cloud, not orange). Mail traffic needs direct access to port 25/587/993.

### MX Record (mail routing)

| Type | Name | Value | Priority | TTL |
|------|------|-------|----------|-----|
| MX | `@` (root) | `mail.opensentinel.ai` | 0 | Auto |

### TXT - SPF (who can send email for this domain)

| Type | Name | Value |
|------|------|-------|
| TXT | `@` (root) | `v=spf1 a mx ip4:74.208.129.33 ~all` |

### TXT - DKIM (generated in Step 4, add after)

| Type | Name | Value |
|------|------|-------|
| TXT | `default._domainkey` | *(generated in Step 4 below)* |

### TXT - DMARC (email authentication policy)

| Type | Name | Value |
|------|------|-------|
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:admin@opensentinel.ai;` |

### Optional - CAA Record (which CAs can issue SSL)

| Type | Name | Value |
|------|------|-------|
| CAA | `@` | `0 issue "letsencrypt.org"` |

---

## Step 3: Server - Mail Configuration

SSH into the server and run these commands as root:

### 3a. Add domain to Postfix virtual domains

```bash
# Add the domain to the virtual domains file
echo "opensentinel.ai" >> /etc/postfix/virtual_domains
```

### 3b. Add mailboxes

```bash
# Add email accounts (follow existing pattern)
cat >> /etc/postfix/virtual_mailboxes << 'EOF'
admin@opensentinel.ai    opensentinel.ai/admin/
info@opensentinel.ai    opensentinel.ai/info/
noreply@opensentinel.ai    opensentinel.ai/noreply/
dsiemon@opensentinel.ai    opensentinel.ai/dsiemon/
EOF

# Rebuild the hash map
postmap /etc/postfix/virtual_mailboxes
```

### 3c. Add aliases

```bash
cat >> /etc/postfix/virtual_aliases << 'EOF'
postmaster@opensentinel.ai admin@opensentinel.ai
admin@opensentinel.ai admin@opensentinel.ai
EOF

# Rebuild the hash map
postmap /etc/postfix/virtual_aliases
```

### 3d. Create mail directories

```bash
# Create the mailbox directories
mkdir -p /var/mail/vhosts/opensentinel.ai/{admin,info,noreply,dsiemon}

# Set ownership to vmail user (uid/gid 5000, matching your Postfix config)
chown -R 5000:5000 /var/mail/vhosts/opensentinel.ai
chmod -R 700 /var/mail/vhosts/opensentinel.ai
```

### 3e. Set passwords for email accounts (Dovecot)

```bash
# Generate password hashes (replace YOUR_PASSWORD with the actual password)
doveadm pw -s SHA512-CRYPT -p 'YOUR_PASSWORD_HERE'

# Add to your Dovecot passwd file (check your existing auth config)
# The exact file depends on your Dovecot setup. Check:
#   /etc/dovecot/users  or  /etc/dovecot/passwd
# Format: user@domain:{SHA512-CRYPT}hash::::
```

### 3f. Restart Postfix

```bash
postfix reload
```

---

## Step 4: DKIM Key Generation

### 4a. Generate the DKIM key pair

```bash
# Create the key directory
mkdir -p /etc/opendkim/keys/opensentinel.ai

# Generate 2048-bit RSA key pair
opendkim-genkey -b 2048 -d opensentinel.ai -D /etc/opendkim/keys/opensentinel.ai/ -s default -v

# Set permissions
chown -R opendkim:opendkim /etc/opendkim/keys/opensentinel.ai
chmod 600 /etc/opendkim/keys/opensentinel.ai/default.private
```

### 4b. Get the DKIM public key (for DNS)

```bash
# Display the DNS record you need to add
cat /etc/opendkim/keys/opensentinel.ai/default.txt
```

This will output something like:
```
default._domainkey	IN	TXT	( "v=DKIM1; h=sha256; k=rsa; "
	  "p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA..." )
```

**Copy ONLY the part inside the quotes** (concatenate multi-line values into one string) and add it as a TXT record in your DNS:
- **Name:** `default._domainkey`
- **Value:** `v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgk...` (the full key, no line breaks)

### 4c. Add to OpenDKIM configuration files

```bash
# Add to key table
echo "default._domainkey.opensentinel.ai opensentinel.ai:default:/etc/opendkim/keys/opensentinel.ai/default.private" >> /etc/opendkim/key.table

# Add to signing table
echo "*@opensentinel.ai default._domainkey.opensentinel.ai" >> /etc/opendkim/signing.table

# Add to trusted hosts
echo "*.opensentinel.ai" >> /etc/opendkim/trusted.hosts
```

### 4d. Restart OpenDKIM and Postfix

```bash
systemctl restart opendkim
postfix reload
```

---

## Step 5: SSL Certificate (Let's Encrypt)

### 5a. Create nginx config first (needed for certbot HTTP challenge)

```bash
# Create a temporary nginx config for ALL subdomains (needed for certbot HTTP challenge)
cat > /etc/nginx/sites-available/www.opensentinel.ai << 'NGINX'
server {
    listen 80;
    server_name opensentinel.ai www.opensentinel.ai docs.opensentinel.ai app.opensentinel.ai api.opensentinel.ai admin.opensentinel.ai status.opensentinel.ai mail.opensentinel.ai;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/www.opensentinel.ai /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 5b. Get the SSL certificates

```bash
# Main domain + all web subdomains (single cert)
certbot certonly --webroot -w /var/www/html \
  -d opensentinel.ai \
  -d www.opensentinel.ai \
  -d docs.opensentinel.ai \
  -d app.opensentinel.ai \
  -d api.opensentinel.ai \
  -d admin.opensentinel.ai \
  -d status.opensentinel.ai \
  --agree-tos --non-interactive \
  --email admin@opensentinel.ai

# Mail subdomain (separate cert - keep isolated for mail security)
certbot certonly --webroot -w /var/www/html \
  -d mail.opensentinel.ai \
  --agree-tos --non-interactive \
  --email admin@opensentinel.ai
```

> **Note:** All web subdomains share one cert. The mail subdomain gets its own cert so mail doesn't break if you change web subdomains.

### 5c. Update nginx with SSL

```bash
cat > /etc/nginx/sites-available/www.opensentinel.ai << 'NGINX'
# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name opensentinel.ai www.opensentinel.ai;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS - Main website / API / Dashboard
server {
    listen 443 ssl http2;
    server_name opensentinel.ai www.opensentinel.ai;

    ssl_certificate /etc/letsencrypt/live/opensentinel.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/opensentinel.ai/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy to OpenSentinel app (port 8030)
    location / {
        proxy_pass http://127.0.0.1:8030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

nginx -t && systemctl reload nginx
```

### 5d. docs.opensentinel.ai (Documentation Site)

```bash
cat > /etc/nginx/sites-available/docs.opensentinel.ai << 'NGINX'
server {
    listen 80;
    server_name docs.opensentinel.ai;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name docs.opensentinel.ai;

    ssl_certificate /etc/letsencrypt/live/opensentinel.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/opensentinel.ai/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Option A: Serve static docs (VitePress, Docusaurus, MkDocs build output)
    root /var/www/docs.opensentinel.ai;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Option B: Proxy to a docs container (uncomment if using Docker)
    # location / {
    #     proxy_pass http://127.0.0.1:8031;
    #     proxy_set_header Host $host;
    #     proxy_set_header X-Real-IP $remote_addr;
    #     proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #     proxy_set_header X-Forwarded-Proto $scheme;
    # }
}
NGINX

ln -sf /etc/nginx/sites-available/docs.opensentinel.ai /etc/nginx/sites-enabled/
mkdir -p /var/www/docs.opensentinel.ai
nginx -t && systemctl reload nginx
```

### 5e. app.opensentinel.ai (Web Dashboard - alternative to www)

```bash
cat > /etc/nginx/sites-available/app.opensentinel.ai << 'NGINX'
server {
    listen 80;
    server_name app.opensentinel.ai;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name app.opensentinel.ai;

    ssl_certificate /etc/letsencrypt/live/opensentinel.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/opensentinel.ai/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Proxy to OpenSentinel dashboard (port 8030)
    location / {
        proxy_pass http://127.0.0.1:8030;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/app.opensentinel.ai /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 5f. (Optional) Mail webmail/autodiscover nginx

```bash
cat > /etc/nginx/sites-available/mail.opensentinel.ai << 'NGINX'
server {
    listen 80;
    server_name mail.opensentinel.ai;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name mail.opensentinel.ai;

    ssl_certificate /etc/letsencrypt/live/mail.opensentinel.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mail.opensentinel.ai/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    location / {
        return 200 'OpenSentinel Mail Server';
        add_header Content-Type text/plain;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/mail.opensentinel.ai /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

## Step 6: Verify Everything Works

### 6a. Test DNS propagation

```bash
# Check A records
dig A opensentinel.ai +short
dig A www.opensentinel.ai +short
dig A mail.opensentinel.ai +short

# Check MX record
dig MX opensentinel.ai +short

# Check SPF
dig TXT opensentinel.ai +short

# Check DKIM
dig TXT default._domainkey.opensentinel.ai +short

# Check DMARC
dig TXT _dmarc.opensentinel.ai +short
```

### 6b. Test DKIM signing

```bash
# Send a test email and check headers
echo "DKIM test from OpenSentinel" | mail -s "DKIM Test" -r admin@opensentinel.ai your-personal-email@gmail.com

# Or use opendkim-testkey
opendkim-testkey -d opensentinel.ai -s default -vvv
```

### 6c. Test with online tools

- **Mail-Tester:** https://www.mail-tester.com/ (send an email to the address they give you, aim for 10/10)
- **MXToolbox:** https://mxtoolbox.com/emailhealth/opensentinel.ai/
- **DKIM Validator:** https://dkimvalidator.com/
- **SSL Test:** https://www.ssllabs.com/ssltest/

### 6d. Test SMTP delivery

```bash
# Test sending from server
echo "Test email body" | mail -s "Test from OpenSentinel" -r noreply@opensentinel.ai your-email@gmail.com

# Check mail logs for issues
tail -50 /var/log/mail.log
```

---

## Complete DNS Records Checklist

Copy-paste this into your DNS provider. Replace `DKIM_PUBLIC_KEY` with the key from Step 4b.

| # | Type | Name | Value | Priority | TTL |
|---|------|------|-------|----------|-----|
| 1 | A | `@` | `74.208.129.33` | - | Auto |
| 2 | A | `www` | `74.208.129.33` | - | Auto |
| 3 | A | `mail` | `74.208.129.33` | - | Auto |
| 4 | A | `api` | `74.208.129.33` | - | Auto |
| 5 | A | `docs` | `74.208.129.33` | - | Auto |
| 6 | A | `app` | `74.208.129.33` | - | Auto |
| 7 | A | `admin` | `74.208.129.33` | - | Auto |
| 8 | A | `status` | `74.208.129.33` | - | Auto |
| 9 | MX | `@` | `mail.opensentinel.ai` | 0 | Auto |
| 6 | TXT | `@` | `v=spf1 a mx ip4:74.208.129.33 ~all` | - | Auto |
| 7 | TXT | `default._domainkey` | `v=DKIM1; h=sha256; k=rsa; p=DKIM_PUBLIC_KEY` | - | Auto |
| 8 | TXT | `_dmarc` | `v=DMARC1; p=quarantine; adkim=r; aspf=r; rua=mailto:admin@opensentinel.ai;` | - | Auto |
| 9 | CAA | `@` | `0 issue "letsencrypt.org"` | - | Auto |

---

## Quick-Run Script (All Server Steps Combined)

Save this and run on the server after DNS is configured and propagated:

```bash
#!/bin/bash
set -e
DOMAIN="opensentinel.ai"

echo "=== Step 1: Postfix Virtual Domain ==="
echo "$DOMAIN" >> /etc/postfix/virtual_domains

echo "=== Step 2: Mailboxes ==="
cat >> /etc/postfix/virtual_mailboxes << EOF
admin@${DOMAIN}    ${DOMAIN}/admin/
info@${DOMAIN}    ${DOMAIN}/info/
noreply@${DOMAIN}    ${DOMAIN}/noreply/
dsiemon@${DOMAIN}    ${DOMAIN}/dsiemon/
EOF
postmap /etc/postfix/virtual_mailboxes

echo "=== Step 3: Aliases ==="
cat >> /etc/postfix/virtual_aliases << EOF
postmaster@${DOMAIN} admin@${DOMAIN}
admin@${DOMAIN} admin@${DOMAIN}
EOF
postmap /etc/postfix/virtual_aliases

echo "=== Step 4: Mail Directories ==="
mkdir -p /var/mail/vhosts/${DOMAIN}/{admin,info,noreply,dsiemon}
chown -R 5000:5000 /var/mail/vhosts/${DOMAIN}
chmod -R 700 /var/mail/vhosts/${DOMAIN}

echo "=== Step 5: DKIM Key Generation ==="
mkdir -p /etc/opendkim/keys/${DOMAIN}
opendkim-genkey -b 2048 -d ${DOMAIN} -D /etc/opendkim/keys/${DOMAIN}/ -s default -v
chown -R opendkim:opendkim /etc/opendkim/keys/${DOMAIN}
chmod 600 /etc/opendkim/keys/${DOMAIN}/default.private

echo "default._domainkey.${DOMAIN} ${DOMAIN}:default:/etc/opendkim/keys/${DOMAIN}/default.private" >> /etc/opendkim/key.table
echo "*@${DOMAIN} default._domainkey.${DOMAIN}" >> /etc/opendkim/signing.table
echo "*.${DOMAIN}" >> /etc/opendkim/trusted.hosts

echo "=== Step 6: Restart Services ==="
systemctl restart opendkim
postfix reload

echo ""
echo "=== DKIM PUBLIC KEY (add this to DNS) ==="
cat /etc/opendkim/keys/${DOMAIN}/default.txt
echo ""
echo "=== DONE! Now:"
echo "1. Add the DKIM key above to DNS as TXT record for: default._domainkey.${DOMAIN}"
echo "2. Wait for DNS propagation (~5-30 min)"
echo "3. Run: certbot certonly --webroot -w /var/www/html -d ${DOMAIN} -d www.${DOMAIN} -d mail.${DOMAIN}"
echo "4. Set up nginx virtual host"
echo "5. Test with: opendkim-testkey -d ${DOMAIN} -s default -vvv"
```

---

## Email Client Settings (for connecting Thunderbird, Outlook, etc)

| Setting | Value |
|---------|-------|
| **IMAP Server** | `mail.opensentinel.ai` |
| **IMAP Port** | `993` (SSL/TLS) |
| **SMTP Server** | `mail.opensentinel.ai` |
| **SMTP Port** | `587` (STARTTLS) |
| **Username** | `admin@opensentinel.ai` (full email) |
| **Authentication** | Normal password |

---

## Subdomain Architecture

| Subdomain | Purpose | Proxies To |
|-----------|---------|------------|
| `opensentinel.ai` | Marketing / landing page | Static files or port 8030 |
| `www.opensentinel.ai` | Same as root (redirect or mirror) | Same as root |
| `app.opensentinel.ai` | Web dashboard (React app) | `127.0.0.1:8030` |
| `api.opensentinel.ai` | REST API (Hono) | `127.0.0.1:8030` |
| `docs.opensentinel.ai` | Documentation site | Static files (`/var/www/docs.opensentinel.ai`) or port 8031 |
| `admin.opensentinel.ai` | Admin panel | `127.0.0.1:8031` |
| `mail.opensentinel.ai` | Mail server (Postfix/Dovecot) | Direct (ports 25/587/993) |
| `status.opensentinel.ai` | Uptime/status page (optional) | `127.0.0.1:8032` or static |

---

## Estimated Timeline

| Step | Time |
|------|------|
| Register domain | 5 min |
| Set DNS records | 10 min |
| DNS propagation | 5-60 min |
| Server config (Steps 3-4) | 10 min |
| SSL certs (Step 5) | 5 min |
| Nginx config | 5 min |
| Testing & verification | 10 min |
| **Total** | **~45 min - 1.5 hrs** |
