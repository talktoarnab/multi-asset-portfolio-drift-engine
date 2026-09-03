import requests
import hashlib
import random
from typing import Dict, List

def get_base_mock_price(ticker: str) -> float:
    """
    Returns a realistic base mock price for a ticker based on its hash,
    ensuring consistency for the same ticker.
    """
    ticker_upper = ticker.upper().strip()
    
    # Well-known tickers get realistic base prices
    well_known = {
        "SPY": 450.0,
        "VOO": 410.0,
        "QQQ": 380.0,
        "GLD": 185.0,
        "SLV": 23.0,
        "AAPL": 175.0,
        "MSFT": 350.0,
        "AMZN": 130.0,
        "TSLA": 240.0,
        "BTC-USD": 60000.0,
        "ETH-USD": 3000.0,
        "IAU": 35.0,
        "BND": 72.0
    }
    
    if ticker_upper in well_known:
        return well_known[ticker_upper]
        
    # For other tickers, generate a stable pseudo-random price between $10 and $500
    hasher = hashlib.md5(ticker_upper.encode("utf-8"))
    hash_val = int(hasher.hexdigest(), 16)
    
    # Map to a range of 10.0 to 500.0
    price = 10.0 + (hash_val % 49000) / 100.0
    return round(price, 2)

def fetch_live_price_yahoo(ticker: str) -> float:
    """
    Fetches the live price of a ticker using the public Yahoo Finance Chart API.
    """
    ticker_upper = ticker.upper().strip()
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker_upper}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            meta = data.get("chart", {}).get("result", [{}])[0].get("meta", {})
            price = meta.get("regularMarketPrice")
            if price is not None:
                return float(price)
    except Exception as e:
        print(f"Error fetching live price for {ticker_upper} from Yahoo: {e}")
        
    return 0.0

def fetch_prices(tickers: List[str]) -> Dict[str, float]:
    """
    Fetches prices for a list of tickers.
    First tries Yahoo Finance API. If that fails or returns 0, falls back to realistic mock prices.
    """
    prices = {}
    for ticker in tickers:
        ticker_clean = ticker.upper().strip()
        if not ticker_clean:
            continue
            
        price = fetch_live_price_yahoo(ticker_clean)
        if price > 0:
            prices[ticker_clean] = price
        else:
            # Fallback to mock price
            prices[ticker_clean] = get_base_mock_price(ticker_clean)
            
    return prices
