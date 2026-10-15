# TFC PMS deployment (DigitalOcean + CloudPanel)

```
Browser ──HTTPS──> CloudPanel nginx (tfcpms.tfcmockup.com, Let's Encrypt)
                     └──> 127.0.0.1:8090  Plane proxy (Caddy)
                            ├── /            web
                            ├── /god-mode/   admin
                            ├── /spaces/     space
                            ├── /live/       live (websockets)
                            ├── /api /auth   api
                            └── /uploads     MinIO
```

The images are built on a workstation with Docker Desktop (the 4 GB droplet is
too small to build the frontend) and streamed to the server over SSH.

## Files

| File                    | Purpose                                                                            |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `docker-compose.yml`    | Production stack (Compose project `tfcpms`), copied to `/opt/tfcpms` on the server |
| `.env.example`          | Template for `/opt/tfcpms/.env` (real secrets live only on the server)             |
| `cloudpanel-vhost.conf` | Vhost for the CloudPanel site (Sites → tfcpms → Vhost)                             |
| `deploy.ps1`            | Build + ship + restart in one command                                              |

## Deploy an update

```powershell
$deploy = ".\deployments\tfc\deploy.ps1"
powershell -ExecutionPolicy Bypass -File $deploy                    # everything
powershell -ExecutionPolicy Bypass -File $deploy -Services web      # only the web app
powershell -ExecutionPolicy Bypass -File $deploy -Services api      # backend (runs migrations)
```

## Useful server commands

Frontend Caddy limits page requests to 300 per client IP per minute and bundled
assets to a separate 3,000 requests per minute. Keep these allowances separate:
one cold workspace load can fetch more than 300 chunks and must not block page
navigation. API and authentication throttles are managed independently by Django.

```bash
cd /opt/tfcpms
docker compose ps
docker compose logs -f api
docker compose restart api
docker compose exec plane-db pg_dump -U plane plane > /root/tfcpms-$(date +%F).sql   # backup
```

## First-time setup notes

- DNS: `tfcpms` must be an **A record → 168.144.157.119**.
- SSL: CloudPanel → Sites → tfcpms.tfcmockup.com → SSL/TLS → New Let's Encrypt certificate.
- The CloudPanel site's App Port must equal `LISTEN_HTTP_PORT` (8090).
- Create the instance admin at `https://tfcpms.tfcmockup.com/god-mode/`.
