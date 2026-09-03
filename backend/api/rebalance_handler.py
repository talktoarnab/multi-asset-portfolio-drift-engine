import sys
import os
import re
# Add current directory and parent directory to path to allow imports when running in AWS Lambda
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.common.api_utils import make_response, parse_body, get_authenticated_user
from backend.common import db
from backend.common import financial_api
from backend.common import math_engine

def handler(event, context):
    """
    Unified Lambda handler for calculating portfolio rebalancing.
    """
    # Handle CORS preflight requests
    if event.get("httpMethod") == "OPTIONS":
        return make_response(200, "OK")
        
    path = event.get("path", "")
    method = event.get("httpMethod", "")
    
    if method != "POST":
        return make_response(405, {"error": "Method not allowed. Use POST."})
        
    # Authenticate user
    email, err = get_authenticated_user(event)
    if err:
        return err
        
    # Parse portfolio_id from path
    portfolio_match = re.search(r"/portfolios/([a-zA-Z0-9\-]+)/rebalance$", path)
    portfolio_id = None
    if portfolio_match:
        portfolio_id = portfolio_match.group(1)
    elif event.get("pathParameters"):
        portfolio_id = event.get("pathParameters", {}).get("portfolio_id") or event.get("pathParameters", {}).get("id")
        
    if not portfolio_id:
        return make_response(400, {"error": "Missing portfolio ID in path"})
        
    # Verify portfolio ownership
    portfolio = db.get_portfolio(email, portfolio_id)
    if not portfolio:
        return make_response(404, {"error": "Portfolio not found or access denied"})
        
    # Get holdings
    holdings = db.get_holdings(portfolio_id)
    if not holdings:
        return make_response(400, {"error": "Portfolio has no holdings to rebalance"})
        
    # Parse cash injection from body or query parameters
    body = parse_body(event)
    cash_injection = body.get("cash_injection")
    
    if cash_injection is None and event.get("queryStringParameters"):
        cash_injection = event.get("queryStringParameters", {}).get("cash_injection")
        
    if cash_injection is None:
        cash_injection = 0.0
        
    try:
        cash_injection = float(cash_injection)
        if cash_injection < 0:
            return make_response(400, {"error": "cash_injection cannot be negative"})
    except ValueError:
        return make_response(400, {"error": "cash_injection must be a valid number"})
        
    # Fetch current prices
    tickers = [h["ticker"] for h in holdings]
    prices = financial_api.fetch_prices(tickers)
    
    # Calculate standard rebalance recommendations
    standard_rebalance = math_engine.rebalance_standard(holdings, prices)
    
    # Calculate cash-injection rebalance recommendations (if cash_injection > 0)
    cash_injection_rebalance = []
    if cash_injection > 0:
        cash_injection_rebalance = math_engine.rebalance_cash_injection(holdings, prices, cash_injection)
        
    # Calculate current drift for reference
    drift_data = math_engine.calculate_drift(holdings, prices)
    
    return make_response(200, {
        "portfolio_id": portfolio_id,
        "portfolio_name": portfolio["name"],
        "total_value": drift_data["total_value"],
        "total_drift": drift_data["total_drift"],
        "cash_injection": cash_injection,
        "standard_rebalance": standard_rebalance,
        "cash_injection_rebalance": cash_injection_rebalance
    })
