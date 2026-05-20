"""Email sending utility using the `emails` library."""
import logging
import emails as emails_lib
from app.core.config import settings

logger = logging.getLogger(__name__)


def _smtp_options() -> dict:
    return {
        "host": settings.SMTP_HOST,
        "port": settings.SMTP_PORT,
        "user": settings.SMTP_USER,
        "password": settings.SMTP_PASSWORD,
        "tls": settings.SMTP_PORT == 587,
        "ssl": settings.SMTP_PORT == 465,
        "timeout": 10,
    }


def send_email(*, to_email: str, to_name: str, subject: str, html_body: str) -> bool:
    """Send an HTML email. Returns True on success, False on failure."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured — skipping email to %s", to_email)
        return False
    try:
        message = emails_lib.html(
            subject=subject,
            html=html_body,
            mail_from=(settings.EMAILS_FROM_NAME, settings.EMAILS_FROM_EMAIL),
        )
        response = message.send(to=(to_name, to_email), smtp=_smtp_options())
        if response.status_code not in (250, 200):
            logger.error("Email send failed to %s: %s", to_email, response)
            return False
        logger.info("Email sent to %s — %s", to_email, subject)
        return True
    except Exception as exc:
        logger.error("Email exception for %s: %s", to_email, exc)
        return False


# ─── Templates ────────────────────────────────────────────────

def _base_html(content: str) -> str:
    return f"""
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#fff">
      <div style="margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #f1f5f9">
        <h2 style="margin:0;font-size:20px;color:#0f172a">{settings.EMAILS_FROM_NAME}</h2>
      </div>
      {content}
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #f1f5f9;font-size:12px;color:#94a3b8">
        This is an automated message from {settings.EMAILS_FROM_NAME}. Do not reply to this email.
      </div>
    </div>
    """


def asset_added_email(admin_name: str, asset_name: str, asset_tag: str, category: str, brand: str | None, added_by: str) -> str:
    return _base_html(f"""
      <h3 style="color:#0f172a;margin-top:0">New Asset Added</h3>
      <p style="color:#374151">Hi <strong>{admin_name}</strong>,</p>
      <p style="color:#374151">A new asset has been added to the inventory by <strong>{added_by}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151;width:40%">Asset Name</td>
            <td style="padding:8px 12px">{asset_name}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Asset Tag</td>
            <td style="padding:8px 12px;font-family:monospace">{asset_tag}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Category</td>
            <td style="padding:8px 12px">{category}</td></tr>
        {'<tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Brand</td><td style="padding:8px 12px">' + brand + '</td></tr>' if brand else ''}
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Added By</td>
            <td style="padding:8px 12px">{added_by}</td></tr>
      </table>
    """)


def asset_deleted_email(admin_name: str, asset_name: str, asset_tag: str, category: str, deleted_by: str) -> str:
    return _base_html(f"""
      <h3 style="color:#0f172a;margin-top:0">Asset Removed from Inventory</h3>
      <p style="color:#374151">Hi <strong>{admin_name}</strong>,</p>
      <p style="color:#374151">The following asset has been removed from the inventory by <strong>{deleted_by}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151;width:40%">Asset Name</td>
            <td style="padding:8px 12px">{asset_name}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Asset Tag</td>
            <td style="padding:8px 12px;font-family:monospace">{asset_tag}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Category</td>
            <td style="padding:8px 12px">{category}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Removed By</td>
            <td style="padding:8px 12px">{deleted_by}</td></tr>
      </table>
      <p style="margin-top:16px;color:#64748b;font-size:13px">This action has been logged in the asset history.</p>
    """)


def password_reset_email(reset_url: str, full_name: str) -> str:
    return _base_html(f"""
      <h3 style="color:#0f172a;margin-top:0">Password Reset Request</h3>
      <p style="color:#374151">Hi <strong>{full_name}</strong>,</p>
      <p style="color:#374151">We received a request to reset your password. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
      <div style="text-align:center;margin:28px 0">
        <a href="{reset_url}" style="background:#3b82f6;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;display:inline-block">
          Reset Password
        </a>
      </div>
      <p style="color:#64748b;font-size:13px">If you didn't request this, you can safely ignore this email. Your password will not be changed.</p>
      <p style="color:#64748b;font-size:12px;word-break:break-all">Or copy this link: {reset_url}</p>
    """)


def asset_assigned_email(
    full_name: str, asset_name: str, asset_tag: str, category: str,
    brand: str | None, assignment_date: str, expected_return_date: str | None, notes: str | None,
) -> str:
    details = f"""
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151;width:40%">Asset</td>
            <td style="padding:8px 12px">{asset_name}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Asset Tag</td>
            <td style="padding:8px 12px;font-family:monospace">{asset_tag}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Category</td>
            <td style="padding:8px 12px">{category}</td></tr>
        {'<tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Brand</td><td style="padding:8px 12px">' + brand + '</td></tr>' if brand else ''}
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Assigned On</td>
            <td style="padding:8px 12px">{assignment_date}</td></tr>
        {'<tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Expected Return</td><td style="padding:8px 12px">' + expected_return_date + '</td></tr>' if expected_return_date else ''}
        {'<tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Notes</td><td style="padding:8px 12px">' + notes + '</td></tr>' if notes else ''}
      </table>"""
    return _base_html(f"""
      <h3 style="color:#0f172a;margin-top:0">Asset Assigned to You</h3>
      <p style="color:#374151">Hi <strong>{full_name}</strong>,</p>
      <p style="color:#374151">The following asset has been assigned to you:</p>
      {details}
      <p style="margin-top:20px;color:#64748b;font-size:13px">
        Please take good care of the asset and return it by the expected date if applicable.
        Contact your IT/admin team if you have any questions.
      </p>
    """)


def asset_returned_email(
    full_name: str, asset_name: str, asset_tag: str, category: str, return_date: str,
) -> str:
    return _base_html(f"""
      <h3 style="color:#0f172a;margin-top:0">Asset Return Confirmed</h3>
      <p style="color:#374151">Hi <strong>{full_name}</strong>,</p>
      <p style="color:#374151">The following asset has been successfully returned:</p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:16px">
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151;width:40%">Asset</td>
            <td style="padding:8px 12px">{asset_name}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Asset Tag</td>
            <td style="padding:8px 12px;font-family:monospace">{asset_tag}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Category</td>
            <td style="padding:8px 12px">{category}</td></tr>
        <tr><td style="padding:8px 12px;background:#f8fafc;font-weight:600;color:#374151">Returned On</td>
            <td style="padding:8px 12px">{return_date}</td></tr>
      </table>
      <p style="margin-top:20px;color:#64748b;font-size:13px">Thank you for returning the asset. No further action is required.</p>
    """)


def notification_alert_email(full_name: str, warranty_items: list, license_items: list, overdue_items: list) -> str:
    sections = ""

    def _days_label(days_left: int) -> str:
        if days_left < 0:
            return f"Expired {abs(days_left)}d ago"
        if days_left == 0:
            return "Expires today"
        return f"In {days_left} days"

    def _days_color(days_left: int) -> str:
        return "#ef4444" if days_left <= 0 else ("#f59e0b" if days_left <= 7 else "#f59e0b")

    if warranty_items:
        rows = "".join(
            f"<tr><td style='padding:8px 12px;border-bottom:1px solid #f1f5f9'>{a['name']}</td>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #f1f5f9'>{a['asset_tag']}</td>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #f1f5f9;color:{_days_color(a['days_left'])};font-weight:600'>{_days_label(a['days_left'])}</td></tr>"
            for a in warranty_items
        )
        sections += f"""
        <h4 style="color:#0f172a;margin-top:24px">⚠ Warranty Expiry Alert</h4>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;color:#64748b">Asset</th>
            <th style="padding:8px 12px;text-align:left;color:#64748b">Tag</th>
            <th style="padding:8px 12px;text-align:left;color:#64748b">Status</th>
          </tr></thead><tbody>{rows}</tbody>
        </table>"""

    if license_items:
        rows = "".join(
            f"<tr><td style='padding:8px 12px;border-bottom:1px solid #f1f5f9'>{a['name']}</td>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #f1f5f9'>{a['asset_tag']}</td>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #f1f5f9;color:{_days_color(a['days_left'])};font-weight:600'>{_days_label(a['days_left'])}</td></tr>"
            for a in license_items
        )
        sections += f"""
        <h4 style="color:#0f172a;margin-top:24px">📋 License / Subscription Alert</h4>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;color:#64748b">Asset</th>
            <th style="padding:8px 12px;text-align:left;color:#64748b">Tag</th>
            <th style="padding:8px 12px;text-align:left;color:#64748b">Status</th>
          </tr></thead><tbody>{rows}</tbody>
        </table>"""

    if overdue_items:
        rows = "".join(
            f"<tr><td style='padding:8px 12px;border-bottom:1px solid #f1f5f9'>{a['asset_name']}</td>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #f1f5f9'>{a['assignee_name']}</td>"
            f"<td style='padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#ef4444;font-weight:600'>{a['days_overdue']} days overdue</td></tr>"
            for a in overdue_items
        )
        sections += f"""
        <h4 style="color:#0f172a;margin-top:24px">🔴 Overdue Returns</h4>
        <table style="width:100%;border-collapse:collapse;font-size:13px">
          <thead><tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;color:#64748b">Asset</th>
            <th style="padding:8px 12px;text-align:left;color:#64748b">Assigned To</th>
            <th style="padding:8px 12px;text-align:left;color:#64748b">Status</th>
          </tr></thead><tbody>{rows}</tbody>
        </table>"""

    return _base_html(f"""
      <h3 style="color:#0f172a;margin-top:0">Asset Inventory — Notification Summary</h3>
      <p style="color:#374151">Hi <strong>{full_name}</strong>,</p>
      <p style="color:#374151">Here is your latest asset notification summary:</p>
      {sections}
      <p style="margin-top:24px;color:#64748b;font-size:13px">Log in to the Asset Inventory portal to take action.</p>
    """)
