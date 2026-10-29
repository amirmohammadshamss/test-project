# Server deployment — 29 October 2026

Deployed application commit `c164433` to `89.42.199.89` at `/opt/restaurantos/releases/c164433`, with `/opt/restaurantos/current` pointing to that release. Public address: https://89.42.199.89. Credentials were supplied separately; no deployment secrets belong in this repository.

Source archive SHA-256: `1b738d97f7039ae7890c3162181420c6ce832df8a606462488e3287c105fd39d`.

## Verified before the session interruption

- Docker image `restaurantos:c164433` built on the server; seven migrations and fictional demo seed completed successfully.
- Caddy obtained a trusted Let's Encrypt short-lived IP certificate. Normal TLS validation and Chromium succeeded. Certificate storage is persistent; automated renewal is configured, but a full renewal cycle has not been observed.
- Public HTTP/API and real WebSocket connections passed role, tenant-isolation, simultaneous-addition, idempotent-replay and prepare/ready/serve/complete checks.
- Three independent Chromium staff sessions passed live kitchen/waiter updates, instruction entry, manager navigation and mobile RTL overflow checks.
- A private PostgreSQL dump restored into a separate verification database with matching 127-order counts. Browser verification subsequently added another completed demo order.
- Daily systemd backups are enabled, with fourteen-day retention. These are on the same host; off-server disaster recovery is not configured.

## Recovery check after the interruption

Fresh connections to both SSH port 22 and HTTPS port 443 timed out from the deployment environment. Earlier successful deployment tests do not establish current availability. Confirm host power/network/firewall status through the hosting console, then run the checks below. Temporary deployment SSH access could not yet be revoked because SSH is unreachable; remove the exact tagged key as described below once access returns.

Latest recheck: public HTTPS recovered and returned 200 with normal certificate validation. SSH reached the password prompt but reset after authentication on two attempts. The AvalAI release has not been deployed; production remains on `c164433` with AI disabled. Root access and temporary authorized-key cleanup remain unresolved.

## Operations

The root-owned `/opt/restaurantos/.env` has mode 0600 and contains generated application/database secrets. AI and Web Push are disabled pending eligible-provider and VAPID configuration. Public platform administration is disabled. Database, Redis and API ports are internal; web port 3000 is bound to loopback. Caddy exposes 80/443.

The host has one CPU and approximately 2 GB RAM. `Dockerfile.server` builds Nx projects serially. `docker-compose.server.yml` sets memory limits and loopback binding; `Caddyfile.server` configures the IP certificate. Preserve these server-specific files and Caddy volumes when updating.

```sh
cd /opt/restaurantos/current
docker compose -f docker-compose.yml -f docker-compose.https.yml -f docker-compose.server.yml ps -a
docker compose -f docker-compose.yml -f docker-compose.https.yml -f docker-compose.server.yml logs --tail 100 api worker web caddy
curl --fail --max-time 20 https://89.42.199.89/api/v1/health/ready
systemctl status restaurantos-backup.timer
```

Backup script: `/opt/restaurantos/backup.sh`; backups: `/opt/restaurantos/backups`. Do not delete volumes or reseed real customer data during recovery. Review migration compatibility before rolling back an application image.

Remove only the authorized-key line ending `restaurantos-deploy-20261029-c164433` from `/root/.ssh/authorized_keys` after recovery. Preserve all other keys and file permissions.

Live AI quality, physical-device Push, remote CI, the narrated assessment recording and original active-time accounting remain outside this deployment proof.
