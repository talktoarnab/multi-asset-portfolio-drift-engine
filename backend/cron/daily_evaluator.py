import sys
import os
import boto3
# Add current directory and parent directory to path to allow imports when running in AWS Lambda
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.common import db
from backend.common import financial_api
from backend.common import math_engine

# SES Client
SES_REGION = os.environ.get("AWS_REGION", "us-east-1")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "alerts@portfolio-drift-engine.com")

def send_drift_email_alert(user_email: str, portfolio_name: str, total_drift: float, threshold: float, total_value: float, holdings: list):
    """
    Sends a beautiful HTML email alert via Amazon SES when a portfolio drifts beyond its threshold.
    """
    subject = f"⚠️ PORTFOLIO DRIFT ALERT: {portfolio_name} requires rebalancing"
    
    # Generate holdings table rows
    holdings_rows = ""
    for h in holdings:
        ticker = h["ticker"]
        target_w = h["target_weight"] * 100
        current_w = h["current_weight"] * 100
        drift = h["drift"] * 100
        val = h["current_value"]
        qty = h["quantity"]
        price = h["price"]
        
        # Color code the drift
        drift_color = "#e11d48" if abs(drift) >= 5.0 else ("#ea580c" if abs(drift) >= 2.0 else "#16a34a")
        drift_sign = "+" if drift > 0 else ""
        
        holdings_rows += f"""
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 12px; font-weight: bold; color: #1e293b;">{ticker}</td>
            <td style="padding: 12px; text-align: right; color: #475569;">{qty:,.2f} @ ${price:,.2f}</td>
            <td style="padding: 12px; text-align: right; color: #1e293b; font-weight: 500;">${val:,.2f}</td>
            <td style="padding: 12px; text-align: right; color: #475569;">{target_w:.1f}%</td>
            <td style="padding: 12px; text-align: right; color: #1e293b; font-weight: 500;">{current_w:.1f}%</td>
            <td style="padding: 12px; text-align: right; color: {drift_color}; font-weight: bold;">{drift_sign}{drift:.1f}%</td>
        </tr>
        """
        
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Portfolio Drift Alert</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden; border: 1px solid #e2e8f0;">
                        <!-- Header -->
                        <tr>
                            <td style="background-color: #0f172a; padding: 32px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.025em;">Multi-Asset Portfolio Drift Engine</h1>
                            </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                            <td style="padding: 40px 32px;">
                                <h2 style="color: #0f172a; margin-top: 0; margin-bottom: 16px; font-size: 20px; font-weight: 600;">Portfolio Drift Threshold Exceeded!</h2>
                                <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                                    Hello, <br><br>
                                    Your portfolio <strong>{portfolio_name}</strong> has drifted beyond your configured alert threshold of <strong>{threshold * 100:.1f}%</strong>. 
                                    The current total absolute drift is <strong>{total_drift * 100:.1f}%</strong>.
                                </p>
                                
                                <!-- Summary Cards -->
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 32px;">
                                    <tr>
                                        <td width="48%" style="background-color: #f1f5f9; border-radius: 8px; padding: 16px; border: 1px solid #e2e8f0;">
                                            <div style="font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px;">Total Portfolio Value</div>
                                            <div style="font-size: 20px; color: #0f172a; font-weight: bold;">${total_value:,.2f}</div>
                                        </td>
                                        <td width="4%"></td>
                                        <td width="48%" style="background-color: #fef2f2; border-radius: 8px; padding: 16px; border: 1px solid #fee2e2;">
                                            <div style="font-size: 12px; text-transform: uppercase; color: #991b1b; font-weight: bold; margin-bottom: 4px;">Current Total Drift</div>
                                            <div style="font-size: 20px; color: #991b1b; font-weight: bold;">{total_drift * 100:.1f}%</div>
                                        </td>
                                    </tr>
                                </table>
                                
                                <!-- Holdings Table -->
                                <h3 style="color: #0f172a; font-size: 16px; font-weight: 600; margin-bottom: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Current Holdings Breakdown</h3>
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-bottom: 32px; font-size: 14px;">
                                    <thead>
                                        <tr style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                                            <th style="padding: 12px; text-align: left; color: #475569; font-weight: 600;">Asset</th>
                                            <th style="padding: 12px; text-align: right; color: #475569; font-weight: 600;">Shares</th>
                                            <th style="padding: 12px; text-align: right; color: #475569; font-weight: 600;">Value</th>
                                            <th style="padding: 12px; text-align: right; color: #475569; font-weight: 600;">Target %</th>
                                            <th style="padding: 12px; text-align: right; color: #475569; font-weight: 600;">Current %</th>
                                            <th style="padding: 12px; text-align: right; color: #475569; font-weight: 600;">Drift</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {holdings_rows}
                                    </tbody>
                                </table>
                                
                                <!-- Action Button -->
                                <table width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                                    <tr>
                                        <td align="center">
                                            <a href="https://portfolio-drift-engine.com/dashboard" style="background-color: #0f172a; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.2);">
                                                Rebalance Portfolio Now
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                                
                                <p style="color: #64748b; font-size: 12px; text-align: center; margin-top: 32px; line-height: 1.5;">
                                    You received this email because you enabled drift alerts for your account.<br>
                                    To adjust your threshold or disable alerts, update your settings in the app.
                                </p>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f1f5f9; padding: 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                                <p style="color: #64748b; font-size: 12px; margin: 0;">&copy; 2026 Multi-Asset Portfolio Drift Engine. All rights reserved.</p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    
    # Try sending via SES
    try:
        ses = boto3.client("ses", region_name=SES_REGION)
        response = ses.send_email(
            Source=SENDER_EMAIL,
            Destination={"ToAddresses": [user_email]},
            Message={
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {
                    "Html": {"Data": html_body, "Charset": "UTF-8"}
                }
            }
        )
        print(f"Successfully sent SES alert email to {user_email}. MessageId: {response['MessageId']}")
        return True
    except Exception as e:
        print(f"Failed to send SES email to {user_email}: {e}")
        print("--- EMAIL CONTENT LOG (FOR LOCAL TESTING) ---")
        print(f"To: {user_email}")
        print(f"Subject: {subject}")
        print(f"Drift: {total_drift*100:.2f}% (Threshold: {threshold*100:.2f}%)")
        print(f"Total Portfolio Value: ${total_value:,.2f}")
        print("---------------------------------------------")
        return False

def lambda_handler(event, context):
    """
    Daily cron job execution handler.
    """
    print("Starting daily portfolio drift evaluation...")
    
    try:
        # 1. Scan all active portfolios
        portfolios = db.scan_all_portfolios()
        print(f"Found {len(portfolios)} portfolios to evaluate.")
        
        # Group portfolios by user to minimize user profile lookups
        user_cache = {}
        
        for p in portfolios:
            portfolio_id = p["portfolio_id"]
            portfolio_name = p["name"]
            user_email = p["email"]
            
            print(f"Evaluating portfolio: {portfolio_name} ({portfolio_id}) for user {user_email}")
            
            # Fetch user profile settings
            if user_email not in user_cache:
                user_profile = db.get_user(user_email)
                if user_profile:
                    user_cache[user_email] = user_profile
                else:
                    # Fallback default settings if user metadata is missing
                    user_cache[user_email] = {
                        "alert_threshold": 0.05,
                        "notification_enabled": True
                    }
                    
            user_settings = user_cache[user_email]
            alert_threshold = float(user_settings.get("alert_threshold", 0.05))
            notification_enabled = bool(user_settings.get("notification_enabled", True))
            
            # 2. Get holdings for portfolio
            holdings = db.get_holdings(portfolio_id)
            if not holdings:
                print(f"Portfolio {portfolio_name} has no holdings. Skipping.")
                continue
                
            # 3. Fetch current prices
            tickers = [h["ticker"] for h in holdings]
            prices = financial_api.fetch_prices(tickers)
            
            # 4. Calculate drift
            drift_data = math_engine.calculate_drift(holdings, prices)
            total_value = drift_data["total_value"]
            total_drift = drift_data["total_drift"]
            calculated_holdings = drift_data["holdings"]
            
            # 5. Check if threshold exceeded
            triggered_alert = False
            if total_drift > alert_threshold:
                triggered_alert = True
                
            # 6. Save drift snapshot
            # Convert holdings snapshot to a serializable list
            holdings_snapshot = []
            for ch in calculated_holdings:
                holdings_snapshot.append({
                    "ticker": ch["ticker"],
                    "asset_class": ch["asset_class"],
                    "target_weight": ch["target_weight"],
                    "current_weight": ch["current_weight"],
                    "quantity": ch["quantity"],
                    "price": ch["price"],
                    "current_value": ch["current_value"]
                })
                
            db.save_drift_snapshot(
                portfolio_id=portfolio_id,
                total_value=total_value,
                total_drift=total_drift,
                holdings_snapshot=holdings_snapshot,
                triggered_alert=triggered_alert
            )
            print(f"Saved drift snapshot for {portfolio_name}. Total Drift: {total_drift*100:.2f}%")
            
            # 7. Dispatch SES email alert if triggered and enabled
            if triggered_alert and notification_enabled:
                send_drift_email_alert(
                    user_email=user_email,
                    portfolio_name=portfolio_name,
                    total_drift=total_drift,
                    threshold=alert_threshold,
                    total_value=total_value,
                    holdings=calculated_holdings
                )
            else:
                print(f"No alert triggered (or notifications disabled) for {portfolio_name}.")
                
        print("Daily portfolio drift evaluation completed successfully.")
        return {
            "statusCode": 200,
            "body": "Daily evaluation completed successfully"
        }
    except Exception as e:
        print(f"Error executing daily evaluation: {e}")
        return {
            "statusCode": 500,
            "body": f"Error executing daily evaluation: {str(e)}"
        }

if __name__ == "__main__":
    # Allow running the script locally for testing
    os.environ["MOCK_DB"] = "true"
    
    # Setup mock data for testing
    print("Setting up local mock data for testing...")
    db.create_user("test@example.com", "pbkdf2_sha256$100000$salt$hash", alert_threshold=0.05, notification_enabled=True)
    p = db.create_portfolio("test@example.com", "My Test Portfolio", "A test portfolio of Equities and Gold")
    db.save_holdings(p["portfolio_id"], [
        {"ticker": "SPY", "asset_class": "Equity", "target_weight": 0.70, "quantity": 10, "purchase_price": 440.0},
        {"ticker": "GLD", "asset_class": "Gold", "target_weight": 0.15, "quantity": 5, "purchase_price": 180.0},
        {"ticker": "SLV", "asset_class": "Silver", "target_weight": 0.15, "quantity": 8, "purchase_price": 22.0}
    ])
    
    # Run evaluation
    lambda_handler(None, None)
