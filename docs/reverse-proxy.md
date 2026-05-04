# TLS Reverse Proxy Setup

Pharlux does not terminate TLS itself (ADR-0010). Use a reverse proxy for HTTPS in production.

## Caddy (recommended)

Caddy provides automatic HTTPS with Let's Encrypt:

```
# /etc/caddy/Caddyfile

pharlux.example.com {
    # REST API + embedded UI
    reverse_proxy localhost:3100

    # OTLP HTTP ingestion
    handle_path /v1/metrics {
        reverse_proxy localhost:4318
    }
    handle_path /v1/logs {
        reverse_proxy localhost:4318
    }
}
```

```bash
sudo apt install caddy
sudo systemctl enable --now caddy
```

Caddy automatically obtains and renews TLS certificates. No manual certificate management needed.

## nginx

```nginx
# /etc/nginx/sites-available/pharlux

server {
    listen 443 ssl http2;
    server_name pharlux.example.com;

    ssl_certificate /etc/letsencrypt/live/pharlux.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pharlux.example.com/privkey.pem;

    # REST API + embedded UI
    location / {
        proxy_pass http://127.0.0.1:3100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # OTLP HTTP ingestion
    location /v1/ {
        proxy_pass http://127.0.0.1:4318;
        proxy_set_header Host $host;
        client_max_body_size 2m;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name pharlux.example.com;
    return 301 https://$host$request_uri;
}
```

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d pharlux.example.com
sudo systemctl enable --now nginx
```

## gRPC (port 4317)

For gRPC TLS, configure your OTel Collector to connect directly to port 4317 over the internal network, or use Caddy's gRPC proxy:

```
grpc.pharlux.example.com {
    reverse_proxy h2c://localhost:4317
}
```

Then configure the Collector with `endpoint: "grpc.pharlux.example.com:443"` and `tls.insecure: false`.

## Firewall

Only expose ports 80 and 443 publicly. Keep ports 3100, 4317, and 4318 on localhost or the internal network:

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw deny 3100/tcp
sudo ufw deny 4317/tcp
sudo ufw deny 4318/tcp
```
