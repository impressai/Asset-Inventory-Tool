"""Email sending utility using smtplib."""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.core.config import settings

logger = logging.getLogger(__name__)


def send_email(*, to_email: str, to_name: str, subject: str, html_body: str) -> bool:
    """Send an HTML email. Returns True on success, False on failure."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("SMTP not configured — skipping email to %s", to_email)
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{settings.EMAILS_FROM_NAME} <{settings.EMAILS_FROM_EMAIL}>"
        msg["To"] = f"{to_name} <{to_email}>"
        msg.attach(MIMEText(html_body, "html"))

        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAILS_FROM_EMAIL, to_email, msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAILS_FROM_EMAIL, to_email, msg.as_string())

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


def clearance_email(
    employee_name: str,
    employee_id: str | None,
    department: str | None,
    designation: str | None,
    current_assets: list,
    history_assets: list,
    note: str | None,
    generated_by: str,
    clearance_date: str,
) -> str:
    def _asset_rows(assets: list) -> str:
        rows = ""
        for a in assets:
            brand_model = " / ".join(filter(None, [a.get("brand"), a.get("model_number")])) or "—"
            rows += (
                f"<tr>"
                f"<td style='padding:8px 10px;border:1px solid #e2e8f0;font-family:monospace;font-size:12px'>{a.get('asset_tag','—')}</td>"
                f"<td style='padding:8px 10px;border:1px solid #e2e8f0'>{a.get('name','—')}</td>"
                f"<td style='padding:8px 10px;border:1px solid #e2e8f0'>{a.get('category','—')}</td>"
                f"<td style='padding:8px 10px;border:1px solid #e2e8f0'>{brand_model}</td>"
                f"<td style='padding:8px 10px;border:1px solid #e2e8f0'>{a.get('assignment_date','—')}</td>"
                f"<td style='padding:8px 10px;border:1px solid #e2e8f0'>{a.get('return_date') or clearance_date}</td>"
                f"</tr>"
            )
        return rows

    def _table(rows_html: str) -> str:
        return f"""
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:10px">
          <thead><tr style="background:#f8fafc">
            <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b">Tag</th>
            <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b">Asset Name</th>
            <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b">Category</th>
            <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b">Brand / Model</th>
            <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b">Assigned</th>
            <th style="padding:8px 10px;border:1px solid #e2e8f0;text-align:left;color:#64748b">Returned</th>
          </tr></thead>
          <tbody>{rows_html}</tbody>
        </table>"""

    meta_rows = "".join([
        f"<tr><td style='padding:6px 10px;font-weight:600;color:#374151;width:150px'>Employee Name</td><td style='padding:6px 10px;color:#0f172a'>{employee_name}</td></tr>",
        f"<tr><td style='padding:6px 10px;font-weight:600;color:#374151'>Employee ID</td><td style='padding:6px 10px;color:#0f172a'>{employee_id or '—'}</td></tr>",
        f"<tr><td style='padding:6px 10px;font-weight:600;color:#374151'>Department</td><td style='padding:6px 10px;color:#0f172a'>{department or '—'}</td></tr>",
        f"<tr><td style='padding:6px 10px;font-weight:600;color:#374151'>Designation</td><td style='padding:6px 10px;color:#0f172a'>{designation or '—'}</td></tr>",
        f"<tr><td style='padding:6px 10px;font-weight:600;color:#374151'>Clearance Date</td><td style='padding:6px 10px;color:#0f172a'>{clearance_date}</td></tr>",
        f"<tr><td style='padding:6px 10px;font-weight:600;color:#374151'>Issued By</td><td style='padding:6px 10px;color:#0f172a'>{generated_by}</td></tr>",
    ])

    if not current_assets:
        clearance_banner = f"""
        <div style="border:2px solid #166534;border-radius:6px;padding:14px 18px;background:#f0fdf4;margin:16px 0;text-align:center">
          <div style="font-size:15px;font-weight:700;color:#166534;margin-bottom:6px">✓ CLEARED FOR EXIT</div>
          <div style="font-size:13px;color:#166534;line-height:1.6">
            This is to certify that <strong>{employee_name}</strong> has returned all company assets
            in their possession. All items have been duly accounted for and verified. This employee is
            formally cleared of any outstanding asset obligations and is approved for offboarding.
          </div>
        </div>"""
    else:
        clearance_banner = f"""
        <div style="border:2px solid #b91c1c;border-radius:6px;padding:12px 16px;background:#fef2f2;margin:16px 0;text-align:center">
          <div style="font-size:13px;font-weight:700;color:#b91c1c">
            ⚠ PENDING — {len(current_assets)} asset{"s" if len(current_assets) != 1 else ""} yet to be returned
          </div>
        </div>"""

    current_section = ""
    if current_assets:
        current_section = f"""
        <h4 style="margin:24px 0 6px;color:#dc2626">Assets Pending Return ({len(current_assets)})</h4>
        {_table(_asset_rows(current_assets))}"""

    history_section = ""
    if history_assets:
        history_section = f"""
        <h4 style="margin:24px 0 6px;color:#0f172a">Previously Returned Assets ({len(history_assets)})</h4>
        {_table(_asset_rows(history_assets))}"""

    note_section = ""
    if note:
        note_section = f"""
        <div style="margin-top:20px;padding:12px 16px;background:#fef9c3;border-left:4px solid #eab308;border-radius:4px;font-size:13px;color:#713f12">
          <strong>Note:</strong> {note}
        </div>"""

    return _base_html(f"""
      <div style="background:#0f172a;color:#fff;padding:14px 20px;border-radius:8px 8px 0 0;margin-bottom:0">
        <h3 style="margin:0;font-size:16px;letter-spacing:0.02em">ASSET CLEARANCE CERTIFICATE</h3>
        <div style="font-size:12px;color:#94a3b8;margin-top:3px">Employee Exit Clearance — Asset Inventory</div>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;padding:20px;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse;font-size:13px;background:#f8fafc;border-radius:6px;overflow:hidden">
          <tbody>{meta_rows}</tbody>
        </table>
        {clearance_banner}
        {current_section}
        {history_section}
        {note_section}
      </div>
      <p style="font-size:12px;color:#94a3b8;margin-top:8px">
        This clearance certificate was generated by <strong>{generated_by}</strong> on {clearance_date}.
      </p>
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
