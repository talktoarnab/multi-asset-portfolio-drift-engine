from typing import List, Dict, Any

def calculate_drift(holdings: List[Dict[str, Any]], prices: Dict[str, float]) -> Dict[str, Any]:
    """
    Calculates the exact percentage deviation from target asset allocations as market prices fluctuate.
    
    holdings: List of dicts, e.g., [
        {"ticker": "SPY", "target_weight": 0.70, "quantity": 10},
        {"ticker": "GLD", "target_weight": 0.15, "quantity": 5},
        {"ticker": "SLV", "target_weight": 0.15, "quantity": 8}
    ]
    prices: Dict of ticker to current price, e.g., {"SPY": 450.0, "GLD": 180.0, "SLV": 22.0}
    """
    total_value = 0.0
    calculated_holdings = []
    
    # First pass: calculate individual values and total value
    for holding in holdings:
        ticker = holding["ticker"]
        qty = float(holding.get("quantity", 0.0))
        target_weight = float(holding.get("target_weight", 0.0))
        price = float(prices.get(ticker, 0.0))
        
        current_value = qty * price
        total_value += current_value
        
        calculated_holdings.append({
            "ticker": ticker,
            "asset_class": holding.get("asset_class", "Equity"),
            "target_weight": target_weight,
            "quantity": qty,
            "price": price,
            "current_value": current_value,
            "purchase_price": float(holding.get("purchase_price", 0.0))
        })
        
    total_drift = 0.0
    
    # Second pass: calculate weights and drifts
    for ch in calculated_holdings:
        current_weight = ch["current_value"] / total_value if total_value > 0 else 0.0
        drift = current_weight - ch["target_weight"]
        total_drift += abs(drift)
        
        ch["current_weight"] = current_weight
        ch["drift"] = drift

    return {
        "total_value": total_value,
        "total_drift": total_drift,
        "holdings": calculated_holdings
    }

def rebalance_standard(holdings: List[Dict[str, Any]], prices: Dict[str, float]) -> List[Dict[str, Any]]:
    """
    Generates precise fractional buy/sell recommendations to realign the portfolio to target weights.
    """
    drift_data = calculate_drift(holdings, prices)
    total_value = drift_data["total_value"]
    recommendations = []
    
    if total_value <= 0:
        return recommendations
        
    for ch in drift_data["holdings"]:
        ticker = ch["ticker"]
        price = ch["price"]
        if price <= 0:
            continue
            
        target_value = total_value * ch["target_weight"]
        value_diff = target_value - ch["current_value"]
        
        # Round to 4 decimal places for shares and 2 for value
        shares_diff = value_diff / price
        
        if abs(value_diff) >= 0.01: # Only recommend if difference is >= 1 cent
            recommendations.append({
                "ticker": ticker,
                "action": "BUY" if value_diff > 0 else "SELL",
                "amount": round(abs(value_diff), 2),
                "shares": round(abs(shares_diff), 4)
            })
            
    return recommendations

def rebalance_cash_injection(holdings: List[Dict[str, Any]], prices: Dict[str, float], cash_injection: float) -> List[Dict[str, Any]]:
    """
    Greedy water-filling algorithm to allocate a cash injection to buy under-allocated assets.
    Ensures no selling occurs (tax-efficient rebalancing).
    """
    recommendations = []
    if cash_injection <= 0:
        return recommendations
        
    drift_data = calculate_drift(holdings, prices)
    total_value = drift_data["total_value"]
    new_total_value = total_value + cash_injection
    
    # Initialize allocation values
    allocations = {h["ticker"]: 0.0 for h in drift_data["holdings"]}
    current_values = {h["ticker"]: h["current_value"] for h in drift_data["holdings"]}
    target_weights = {h["ticker"]: h["target_weight"] for h in drift_data["holdings"]}
    
    # Greedy water-filling
    # Define step size (min of 1.0 or 0.1% of cash injection)
    step = min(1.0, cash_injection / 1000.0)
    if step <= 0.001:
        step = 0.001
        
    remaining_cash = cash_injection
    
    while remaining_cash >= step:
        # Find the asset that is furthest below its target weight
        best_ticker = None
        max_deficit = -999999.0
        
        for ticker, target_w in target_weights.items():
            current_val = current_values[ticker] + allocations[ticker]
            projected_weight = current_val / new_total_value if new_total_value > 0 else 0.0
            deficit = target_w - projected_weight
            
            if deficit > max_deficit:
                max_deficit = deficit
                best_ticker = ticker
                
        if best_ticker is not None:
            allocations[best_ticker] += step
            remaining_cash -= step
        else:
            break
            
    # Allocate any microscopic remaining cash to the asset with the largest remaining deficit
    if remaining_cash > 0:
        best_ticker = None
        max_deficit = -999999.0
        for ticker, target_w in target_weights.items():
            current_val = current_values[ticker] + allocations[ticker]
            projected_weight = current_val / new_total_value if new_total_value > 0 else 0.0
            deficit = target_w - projected_weight
            if deficit > max_deficit:
                max_deficit = deficit
                best_ticker = ticker
        if best_ticker is not None:
            allocations[best_ticker] += remaining_cash

    # Build recommendations
    for h in drift_data["holdings"]:
        ticker = h["ticker"]
        allocated_amount = allocations[ticker]
        price = h["price"]
        
        if allocated_amount > 0 and price > 0:
            shares_to_buy = allocated_amount / price
            recommendations.append({
                "ticker": ticker,
                "action": "BUY",
                "amount": round(allocated_amount, 2),
                "shares": round(shares_to_buy, 4)
            })
            
    return recommendations
