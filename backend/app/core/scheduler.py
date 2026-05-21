"""Daily alert email scheduler — fires at 20:00 IST (14:30 UTC) every day."""
import structlog
from datetime import date, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.db.session import SessionLocal
from app.models.models import Asset, Assignment, User
from app.core.email import send_email, notification_alert_email

logger = structlog.get_logger(__name__)

_scheduler = BackgroundScheduler(timezone="UTC")


def _send_daily_alerts(days: int = 30) -> None:
    logger.info("Scheduler: running daily alert email job")
    db = SessionLocal()
    try:
        today = date.today()
        lookback  = today - timedelta(days=days)
        threshold = today + timedelta(days=days)

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

        overdue_rows = (
            db.query(Assignment).join(Assignment.asset)
            .filter(
                Assignment.is_active == True,
                Assignment.expected_return_date != None,
                Assignment.expected_return_date < today,
            ).all()
        )
        overdue_items = [
            {"asset_name": a.asset.name, "asset_tag": a.asset.asset_tag,
             "assignee_name": a.assignee_name or "—",
             "days_overdue": (today - a.expected_return_date).days}
            for a in overdue_rows
        ]

        if not warranty_items and not license_items and not overdue_items:
            logger.info("Scheduler: no active alerts — skipping email send")
            return

        users = db.query(User).filter(User.is_active == True).all()
        sent = 0
        for user in users:
            ok = send_email(
                to_email=user.email,
                to_name=user.full_name,
                subject=f"Asset Inventory — Daily Alert Summary ({today})",
                html_body=notification_alert_email(
                    user.full_name, warranty_items, license_items, overdue_items
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


def start_scheduler() -> None:
    # 20:00 IST = 14:30 UTC
    _scheduler.add_job(
        _send_daily_alerts,
        trigger=CronTrigger(hour=14, minute=30, timezone="UTC"),
        id="daily_alert_email",
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("Scheduler started — daily alerts at 20:00 IST (14:30 UTC)")


def stop_scheduler() -> None:
    if _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler stopped")
