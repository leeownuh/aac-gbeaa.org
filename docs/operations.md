# Production Backup, Monitoring, and Recovery

This runbook is for the current EC2 + Docker Compose deployment.

## What Must Be Backed Up

- PostgreSQL database: CMS content, admins, sessions, audit logs, moderation state.
- Docker `app_data` volume: uploaded images and gallery assets.
- GitHub repo: application code and static assets.
- `.env`: production secrets. Store this securely outside the repo.

## Daily Backup

Run from the repo root on EC2:

```bash
chmod +x scripts/ec2-backup.sh scripts/ec2-restore.sh scripts/ec2-monitor.sh
./scripts/ec2-backup.sh
```

Optional S3 upload:

```bash
BACKUP_S3_URI=s3://your-backup-bucket/aac-gbeaaa ./scripts/ec2-backup.sh
```

Recommended cron:

```cron
15 2 * * * cd /home/ubuntu/apps/aac-gbeaa.org && BACKUP_S3_URI=s3://your-backup-bucket/aac-gbeaaa ./scripts/ec2-backup.sh >> logs/backup.log 2>&1
```

Retention defaults to 14 local days. Override with:

```bash
BACKUP_RETENTION_DAYS=30 ./scripts/ec2-backup.sh
```

## Monitoring

Run manually:

```bash
./scripts/ec2-monitor.sh
```

Recommended cron every 5 minutes:

```cron
*/5 * * * * cd /home/ubuntu/apps/aac-gbeaa.org && ./scripts/ec2-monitor.sh >> logs/monitor.log 2>&1
```

Minimum AWS alarms to configure:

- EC2 `StatusCheckFailed` >= 1 for 2 checks.
- EC2 `CPUUtilization` > 80% for 15 minutes.
- Disk usage alarm via CloudWatch Agent for `/` > 80%.
- Budget alert already configured.
- Optional external uptime check against `https://www.aac-gbeaaa.org/api/ready`.

## Restore

Restore is destructive. Use only when replacing a broken database or volume.

1. Put the backup folder on the EC2 host.
2. Confirm it contains:
   - `postgres.sql`
   - `app-data.tar.gz`
   - `SHA256SUMS`
3. Run:

```bash
CONFIRM_RESTORE=YES ./scripts/ec2-restore.sh backups/ec2/YYYYMMDDTHHMMSSZ
```

4. Verify:

```bash
curl -fsS http://localhost/api/ready
docker compose -f docker-compose.three-tier.yml ps
```

5. Check public site:

```bash
curl -I https://www.aac-gbeaaa.org
curl -fsS https://www.aac-gbeaaa.org/api/ready
```

## Recovery Targets

- RPO: at most 24 hours of content loss if daily backups are working.
- RTO: 30-60 minutes for same-EC2 restore, longer if rebuilding the server.

## Monthly Drill

Once a month:

1. Create a fresh backup.
2. Copy it to a test folder or test EC2 instance.
3. Run restore.
4. Confirm admin login, gallery images, events, and articles work.

Backups that are never restored are not proven backups.
