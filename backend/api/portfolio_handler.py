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
    Unified Lambda handler for portfolio and holding routes.
    """
    # Handle CORS preflight requests
    if event.get("httpMethod") == "OPTIONS":
        return make_response(200, "OK")
        
    path = event.get("path", "")
    method = event.get("httpMethod", "")
    
    # Authenticate user
    email, err = get_authenticated_user(event)
    if err:
        return err
        
    # Parse path to check if it has a portfolio ID
    # e.g., /portfolios or /portfolios/123-456
    portfolio_match = re.search(r"/portfolios/([a-zA-Z0-9\-]+)$", path)
    portfolio_id = None
    if portfolio_match:
        portfolio_id = portfolio_match.group(1)
    elif event.get("pathParameters"):
        portfolio_id = event.get("pathParameters", {}).get("portfolio_id") or event.get("pathParameters", {}).get("id")
        
    if portfolio_id:
        if method == "GET":
            return get_portfolio_route(email, portfolio_id)
        elif method == "PUT":
            return save_holdings_route(email, portfolio_id, event)
        elif method == "DELETE":
            return delete_portfolio_route(email, portfolio_id)
        else:
            return make_response(404, {"error": f"Method not allowed on portfolio item: {method}"})
    else:
        if path.endswith("/portfolios") or path.endswith("/portfolios/"):
            if method == "GET":
                return list_portfolios_route(email)
            elif method == "POST":
                return create_portfolio_route(email, event)
            else:
                return make_response(404, {"error": f"Method not allowed on portfolios list: {method}"})
        else:
            return make_response(404, {"error": f"Route not found: {method} {path}"})

def list_portfolios_route(email: str):
    portfolios = db.list_portfolios(email)
    
    # Format and return portfolios, sorting by created_at descending
    portfolios.sort(key=lambda x: x.get("created_at", 0), reverse=True)
    
    # Convert decimal values to standard python types for JSON serialization
    for p in portfolios:
        p["created_at"] = int(p.get("created_at", 0))
        p["updated_at"] = int(p.get("updated_at", 0))
        
    return make_response(200, {"portfolios": portfolios})

def create_portfolio_route(email: str, event):
    body = parse_body(event)
    name = body.get("name", "").strip()
    description = body.get("description", "").strip()
    
    if not name:
        return make_response(400, {"error": "Portfolio name is required"})
        
    try:
        portfolio = db.create_portfolio(email, name, description)
        return make_response(201, {"portfolio": portfolio})
    except Exception as e:
        return make_response(500, {"error": f"Failed to create portfolio: {str(e)}"})

def get_portfolio_route(email: str, portfolio_id: str):
    portfolio = db.get_portfolio(email, portfolio_id)
    if not portfolio:
        return make_response(404, {"error": "Portfolio not found"})
        
    # Get holdings
    holdings = db.get_holdings(portfolio_id)
    
    # Fetch current prices
    tickers = [h["ticker"] for h in holdings]
    prices = financial_api.fetch_prices(tickers) if tickers else {}
    
    # Calculate drift
    drift_data = math_engine.calculate_drift(holdings, prices)
    
    # Get historical drift snapshots
    snapshots = db.get_drift_snapshots(portfolio_id, limit=30)
    
    # Format snapshots for frontend
    formatted_snapshots = []
    for s in snapshots:
        formatted_snapshots.append({
            "timestamp": int(s["timestamp"]),
            "total_value": float(s["total_value"]),
            "total_drift": float(s["total_drift"]),
            "triggered_alert": bool(s.get("triggered_alert", False))
        })
    # Sort chronological (oldest to newest) for charts
    formatted_snapshots.sort(key=lambda x: x["timestamp"])
    
    # Prepare response
    response_data = {
        "portfolio": {
            "portfolio_id": portfolio["portfolio_id"],
            "name": portfolio["name"],
            "description": portfolio.get("description", ""),
            "created_at": int(portfolio.get("created_at", 0)),
            "updated_at": int(portfolio.get("updated_at", 0))
        },
        "holdings": drift_data["holdings"],
        "total_value": drift_data["total_value"],
        "total_drift": drift_data["total_drift"],
        "snapshots": formatted_snapshots
    }
    
    return make_response(200, response_data)

def save_holdings_route(email: str, portfolio_id: str, event):
    # Verify portfolio ownership first
    portfolio = db.get_portfolio(email, portfolio_id)
    if not portfolio:
        return make_response(404, {"error": "Portfolio not found or access denied"})
        
    body = parse_body(event)
    holdings = body.get("holdings", [])
    
    if not isinstance(holdings, list):
        return make_response(400, {"error": "Holdings must be a list"})
        
    # Validate holdings and calculate total target weight
    total_weight = 0.0
    cleaned_holdings = []
    
    for idx, h in enumerate(holdings):
        ticker = h.get("ticker", "").upper().strip()
        if not ticker:
            return make_response(400, {"error": f"Holding at index {idx} is missing a ticker"})
            
        target_weight = h.get("target_weight")
        if target_weight is None:
            return make_response(400, {"error": f"Holding '{ticker}' is missing target_weight"})
            
        try:
            target_weight = float(target_weight)
            if target_weight < 0 or target_weight > 1.0:
                return make_response(400, {"error": f"Holding '{ticker}' target_weight must be between 0 and 1.0"})
        except ValueError:
            return make_response(400, {"error": f"Holding '{ticker}' target_weight must be a valid number"})
            
        qty = h.get("quantity", 0.0)
        try:
            qty = float(qty)
            if qty < 0:
                return make_response(400, {"error": f"Holding '{ticker}' quantity cannot be negative"})
        except ValueError:
            return make_response(400, {"error": f"Holding '{ticker}' quantity must be a valid number"})
            
        purchase_price = h.get("purchase_price", 0.0)
        try:
            purchase_price = float(purchase_price)
            if purchase_price < 0:
                return make_response(400, {"error": f"Holding '{ticker}' purchase price cannot be negative"})
        except ValueError:
            return make_response(400, {"error": f"Holding '{ticker}' purchase price must be a valid number"})
            
        total_weight += target_weight
        cleaned_holdings.append({
            "ticker": ticker,
            "asset_class": h.get("asset_class", "Equity").strip(),
            "target_weight": target_weight,
            "quantity": qty,
            "purchase_price": purchase_price
        })
        
    # Validate that total target weight is exactly 100% (with small floating point tolerance)
    if cleaned_holdings and abs(total_weight - 1.0) > 0.0001:
        return make_response(400, {"error": f"Total target weight must sum to 100% (currently {round(total_weight * 100, 2)}%)"})
        
    try:
        db.save_holdings(portfolio_id, cleaned_holdings)
        return make_response(200, {"message": "Holdings saved successfully"})
    except Exception as e:
        return make_response(500, {"error": f"Failed to save holdings: {str(e)}"})

def delete_portfolio_route(email: str, portfolio_id: str):
    # Verify portfolio ownership first
    portfolio = db.get_portfolio(email, portfolio_id)
    if not portfolio:
        return make_response(404, {"error": "Portfolio not found or access denied"})
        
    try:
        db.delete_portfolio(email, portfolio_id)
        return make_response(200, {"message": "Portfolio deleted successfully"})
    except Exception as e:
        return make_response(500, {"error": f"Failed to delete portfolio: {str(e)}"})
