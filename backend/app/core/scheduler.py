"""Daily alert email — fires at configurable IST time every day via asyncio sleep loop."""
import asyncio
import structlog
from datetime import date, datetime, timedelta, timezone

from app.db.session import SessionLocal
from app.models.models import Asset, Assignment, User, Subscription, NotificationConfig
from app.core.email import send_email, notification_alert_email

logger = structlog.get_logger(__name__)

IST = timezone(timedelta(hours=5, minutes=30))


def _get_config(db):
    cfg = db.query(NotificationConfig).filter(NotificationConfig.id == 1).first()
    if not cfg:
        cfg = NotificationConfig(id=1)
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def _seconds_until_next_run() -> float:
    db = SessionLocal()
    try:
        cfg = _get_config(db)
        send_hour   = cfg.email_send_hour
        send_minute = cfg.email_send_minute
    finally:
        db.close()

    now    = datetime.now(IST)
    target = now.replace(hour=send_hour, minute=send_minute, second=0, microsecond=0)
    if target <= now:
        target += timedelta(days=1)
    return (target - now).total_seconds()


def _send_daily_alerts() -> None:
    logger.info("Scheduler: running daily alert email job")
    db = SessionLocal()
    try:
        cfg   = _get_config(db)
        today = date.today()

        warranty_items = []
        if cfg.warranty_enabled:
            lookback  = today - timedelta(days=cfg.warranty_days)
            threshold = today + timedelta(days=cfg.warranty_days)
            warranty_assets = db.query(Asset).filter(
                Asset.warranty_expiry_date != None,
                Asset.warranty_expiry_date >= lookback,
                Asset.warranty_expiry_date <= threshold,
                Asset.is_active == True,
            ).all()
            warranty_items = [
                {"name": a.name, "asset_tag": a.asset_tag,
                 "days_left": (a.warranty_expiry_date - today).days}
                for a in warranty_assets
            ]

        license_items = []
        if cfg.license_enabled:
            lookback  = today - timedelta(days=cfg.license_days)
            threshold = today + timedelta(days=cfg.license_days)
            license_assets = db.query(Asset).filter(
                Asset.expiry_date != None,
                Asset.expiry_date >= lookback,
                Asset.expiry_date <= threshold,
                Asset.is_active == True,
            ).all()
            license_items = [
                {"name": a.name, "asset_tag": a.asset_tag,
                 "days_left": (a.expiry_date - today).days}
                for a in license_assets
            ]

        subscription_items = []
        if cfg.license_enabled:
            sub_lookback  = today - timedelta(days=cfg.license_days)
            sub_threshold = today + timedelta(days=cfg.license_days)
            expiring_subs = db.query(Subscription).filter(
                Subscription.renewal_date != None,
                Subscription.renewal_date >= sub_lookback,
                Subscription.renewal_date <= sub_threshold,
                Subscription.is_active == True,
                Subscription.status == 'active',
            ).all()
            subscription_items = [
                {"name": s.name, "asset_tag": s.vendor or "—",
                 "days_left": (s.renewal_date - today).days}
                for s in expiring_subs
            ]

        overdue_items = []
        if cfg.overdue_enabled:
            overdue_rows = (
                db.query(Assignment).join(Assignment.asset)
                .filter(
                    Assignment.is_active == True,
                    Asset.is_active == True,
                    Assignment.expected_return_date != None,
                    Assignment.expected_return_date < today,
                ).all()
            )
            overdue_items = [
                {"asset_name": a.asset.name, "asset_tag": a.asset.asset_tag,
                 "assignee_name": a.assignee_name or "—",
                 "days_overdue": (today - a.expected_return_date).days}
                for a in overdue_rows
                if (today - a.expected_return_date).days >= cfg.overdue_threshold_days
            ]

        if not cfg.email_enabled or cfg.email_frequency == 'on_demand':
            logger.info("Scheduler: email notifications disabled or on-demand only — skipping send")
            return

        # Weekly: only send on the configured weekday (0=Mon … 6=Sun)
        if cfg.email_frequency == 'weekly' and today.weekday() != cfg.email_weekly_day:
            logger.info("Scheduler: weekly email — not the scheduled day, skipping")
            return

        if not warranty_items and not license_items and not overdue_items and not subscription_items:
            logger.info("Scheduler: no active alerts — skipping email send")
            return

        # Filter recipients
        from app.models.models import UserRole
        q = db.query(User).filter(User.is_active == True)
        if cfg.email_recipients == 'admins_only':
            q = q.filter(User.role == UserRole.ADMIN)
        elif cfg.email_recipients == 'managers_and_admins':
            q = q.filter(User.role.in_([UserRole.ADMIN, UserRole.MANAGER]))
        users = q.all()
        sent = 0
        for user in users:
            ok = send_email(
                to_email=user.email,
                to_name=user.full_name,
                subject=f"Asset Inventory — Daily Alert Summary ({today})",
                html_body=notification_alert_email(
                    user.full_name, warranty_items, license_items + subscription_items, overdue_items
                ),
            )
            if ok:
                sent += 1

        logger.info(
            "Scheduler: daily alerts sent",
            sent=sent,
            warranty=len(warranty_items),
            license=len(license_items),
            overdue=len(overdue_items),
        )
    except Exception:
        logger.exception("Scheduler: daily alert job failed")
    finally:
        db.close()


async def _alert_loop() -> None:
    while True:
        wait = _seconds_until_next_run()
        next_run = datetime.now(IST) + timedelta(seconds=wait)
        logger.info(
            "Scheduler: next alert email scheduled",
            next_run_IST=next_run.strftime("%Y-%m-%d %H:%M IST"),
            wait_minutes=int(wait // 60),
        )
        await asyncio.sleep(wait)
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, _send_daily_alerts)


_task: asyncio.Task | None = None


def start_scheduler() -> None:
    global _task
    _task = asyncio.create_task(_alert_loop())
    logger.info("Scheduler started — daily alerts at 20:00 IST")


def stop_scheduler() -> None:
    global _task
    if _task and not _task.done():
        _task.cancel()
        logger.info("Scheduler stopped")
