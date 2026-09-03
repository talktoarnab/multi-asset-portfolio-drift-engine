import os
import time
import json
import uuid
import boto3
from boto3.dynamodb.conditions import Key
from typing import List, Dict, Any, Optional
from decimal import Decimal

def _floats_to_decimals(obj):
    if isinstance(obj, float):
        # Use str(obj) to avoid float precision issues in Decimal representation
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: _floats_to_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_floats_to_decimals(x) for x in obj]
    return obj

def _decimals_to_floats(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    elif isinstance(obj, dict):
        return {k: _decimals_to_floats(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_decimals_to_floats(x) for x in obj]
    return obj

# Table name from environment or default
TABLE_NAME = os.environ.get("DYNAMODB_TABLE", "portfolio-drift-engine")
REGION = os.environ.get("AWS_REGION", "us-east-1")

# Determine if we should use mock database
USE_MOCK = os.environ.get("MOCK_DB", "false").lower() in ("true", "1", "yes")

# In-memory database for local mock fallback
_MOCK_STORE: Dict[str, Dict[str, Any]] = {}

def _get_table():
    global USE_MOCK
    if USE_MOCK:
        return None
    try:
        dynamodb = boto3.resource("dynamodb", region_name=REGION)
        return dynamodb.Table(TABLE_NAME)
    except Exception as e:
        print(f"Failed to initialize DynamoDB, falling back to Mock DB: {e}")
        USE_MOCK = True
        return None

# --- Mock DB Implementation ---
def _mock_put_item(item: Dict[str, Any]):
    pk = item["PK"]
    sk = item["SK"]
    if pk not in _MOCK_STORE:
        _MOCK_STORE[pk] = {}
    _MOCK_STORE[pk][sk] = item
    _save_mock_to_file()

def _mock_get_item(pk: str, sk: str) -> Optional[Dict[str, Any]]:
    _load_mock_from_file()
    return _MOCK_STORE.get(pk, {}).get(sk)

def _mock_query(pk: str, sk_prefix: Optional[str] = None) -> List[Dict[str, Any]]:
    _load_mock_from_file()
    if pk not in _MOCK_STORE:
        return []
    items = list(_MOCK_STORE[pk].values())
    if sk_prefix:
        items = [item for item in items if item["SK"].startswith(sk_prefix)]
    return items

def _mock_delete_item(pk: str, sk: str):
    if pk in _MOCK_STORE and sk in _MOCK_STORE[pk]:
        del _MOCK_STORE[pk][sk]
        _save_mock_to_file()

def _mock_delete_partition(pk: str):
    if pk in _MOCK_STORE:
        del _MOCK_STORE[pk]
        _save_mock_to_file()

MOCK_FILE_PATH = "/tmp/portfolio_drift_engine_mock_db.json"

def _save_mock_to_file():
    try:
        with open(MOCK_FILE_PATH, "w") as f:
            json.dump(_MOCK_STORE, f, indent=2)
    except Exception:
        pass

def _load_mock_from_file():
    global _MOCK_STORE
    if not _MOCK_STORE and os.path.exists(MOCK_FILE_PATH):
        try:
            with open(MOCK_FILE_PATH, "r") as f:
                _MOCK_STORE = json.load(f)
        except Exception:
            pass

# --- Database Operations ---

def get_user(email: str) -> Optional[Dict[str, Any]]:
    """Gets user metadata by email."""
    pk = f"USER#{email.lower().strip()}"
    sk = "METADATA"
    
    table = _get_table()
    if table:
        try:
            response = table.get_item(Key={"PK": pk, "SK": sk})
            item = response.get("item") or response.get("Item")
            return _decimals_to_floats(item) if item else None
        except Exception as e:
            print(f"DynamoDB get_user error: {e}")
            return None
    else:
        return _mock_get_item(pk, sk)

def create_user(email: str, password_hash: str, alert_threshold: float = 0.05, notification_enabled: bool = True) -> Dict[str, Any]:
    """Creates a new user profile."""
    email_clean = email.lower().strip()
    pk = f"USER#{email_clean}"
    sk = "METADATA"
    
    user_item = {
        "PK": pk,
        "SK": sk,
        "email": email_clean,
        "password_hash": password_hash,
        "alert_threshold": alert_threshold,
        "notification_enabled": notification_enabled,
        "created_at": int(time.time())
    }
    
    table = _get_table()
    if table:
        try:
            table.put_item(Item=_floats_to_decimals(user_item))
        except Exception as e:
            print(f"DynamoDB create_user error: {e}")
            raise e
    else:
        _mock_put_item(user_item)
        
    return user_item

def update_user_settings(email: str, alert_threshold: float, notification_enabled: bool) -> Optional[Dict[str, Any]]:
    """Updates user settings (alert threshold and notification enabled)."""
    user = get_user(email)
    if not user:
        return None
        
    user["alert_threshold"] = alert_threshold
    user["notification_enabled"] = notification_enabled
    
    table = _get_table()
    if table:
        try:
            table.put_item(Item=_floats_to_decimals(user))
        except Exception as e:
            print(f"DynamoDB update_user_settings error: {e}")
            raise e
    else:
        _mock_put_item(user)
        
    return user

def create_portfolio(email: str, name: str, description: str = "") -> Dict[str, Any]:
    """Creates a new portfolio for a user."""
    email_clean = email.lower().strip()
    portfolio_id = str(uuid.uuid4())
    pk = f"USER#{email_clean}"
    sk = f"PORTFOLIO#{portfolio_id}"
    
    portfolio_item = {
        "PK": pk,
        "SK": sk,
        "portfolio_id": portfolio_id,
        "email": email_clean,
        "name": name,
        "description": description,
        "created_at": int(time.time()),
        "updated_at": int(time.time())
    }
    
    table = _get_table()
    if table:
        try:
            table.put_item(Item=_floats_to_decimals(portfolio_item))
        except Exception as e:
            print(f"DynamoDB create_portfolio error: {e}")
            raise e
    else:
        _mock_put_item(portfolio_item)
        
    return portfolio_item

def get_portfolio(email: str, portfolio_id: str) -> Optional[Dict[str, Any]]:
    """Gets a portfolio's metadata."""
    pk = f"USER#{email.lower().strip()}"
    sk = f"PORTFOLIO#{portfolio_id}"
    
    table = _get_table()
    if table:
        try:
            response = table.get_item(Key={"PK": pk, "SK": sk})
            item = response.get("Item")
            return _decimals_to_floats(item) if item else None
        except Exception as e:
            print(f"DynamoDB get_portfolio error: {e}")
            return None
    else:
        return _mock_get_item(pk, sk)

def list_portfolios(email: str) -> List[Dict[str, Any]]:
    """Lists all portfolios for a user."""
    pk = f"USER#{email.lower().strip()}"
    
    table = _get_table()
    if table:
        try:
            response = table.query(
                KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with("PORTFOLIO#")
            )
            items = response.get("Items", [])
            return [_decimals_to_floats(i) for i in items]
        except Exception as e:
            print(f"DynamoDB list_portfolios error: {e}")
            return []
    else:
        return _mock_query(pk, "PORTFOLIO#")

def delete_portfolio(email: str, portfolio_id: str):
    """Deletes a portfolio and all its holdings."""
    pk_user = f"USER#{email.lower().strip()}"
    sk_portfolio = f"PORTFOLIO#{portfolio_id}"
    
    # Delete portfolio metadata
    table = _get_table()
    if table:
        try:
            table.delete_item(Key={"PK": pk_user, "SK": sk_portfolio})
        except Exception as e:
            print(f"DynamoDB delete_portfolio metadata error: {e}")
    else:
        _mock_delete_item(pk_user, sk_portfolio)
        
    # Delete holdings
    holdings = get_holdings(portfolio_id)
    pk_holdings = f"PORTFOLIO#{portfolio_id}"
    for h in holdings:
        sk_holding = f"HOLDING#{h['ticker']}"
        if table:
            try:
                table.delete_item(Key={"PK": pk_holdings, "SK": sk_holding})
            except Exception as e:
                print(f"DynamoDB delete holding error: {e}")
        else:
            _mock_delete_item(pk_holdings, sk_holding)

def get_holdings(portfolio_id: str) -> List[Dict[str, Any]]:
    """Gets all holdings for a portfolio."""
    pk = f"PORTFOLIO#{portfolio_id}"
    
    table = _get_table()
    if table:
        try:
            response = table.query(
                KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with("HOLDING#")
            )
            items = response.get("Items", [])
            return [_decimals_to_floats(i) for i in items]
        except Exception as e:
            print(f"DynamoDB get_holdings error: {e}")
            return []
    else:
        return _mock_query(pk, "HOLDING#")

def save_holdings(portfolio_id: str, holdings: List[Dict[str, Any]]):
    """Saves the list of holdings for a portfolio, removing any that were deleted."""
    pk = f"PORTFOLIO#{portfolio_id}"
    
    # Get current holdings to find which ones to delete
    current_holdings = get_holdings(portfolio_id)
    current_tickers = {h["ticker"].upper().strip() for h in current_holdings}
    new_tickers = {h["ticker"].upper().strip() for h in holdings}
    
    tickers_to_delete = current_tickers - new_tickers
    
    table = _get_table()
    
    # Delete removed holdings
    for ticker in tickers_to_delete:
        sk = f"HOLDING#{ticker}"
        if table:
            try:
                table.delete_item(Key={"PK": pk, "SK": sk})
            except Exception as e:
                print(f"DynamoDB delete holding error: {e}")
        else:
            _mock_delete_item(pk, sk)
            
    # Save new/updated holdings
    for h in holdings:
        ticker = h["ticker"].upper().strip()
        sk = f"HOLDING#{ticker}"
        
        holding_item = {
            "PK": pk,
            "SK": sk,
            "ticker": ticker,
            "asset_class": h.get("asset_class", "Equity"),
            "target_weight": float(h.get("target_weight", 0.0)),
            "quantity": float(h.get("quantity", 0.0)),
            "purchase_price": float(h.get("purchase_price", 0.0)),
            "updated_at": int(time.time())
        }
        
        if table:
            try:
                table.put_item(Item=_floats_to_decimals(holding_item))
            except Exception as e:
                print(f"DynamoDB save holding error: {e}")
        else:
            _mock_put_item(holding_item)

def save_drift_snapshot(portfolio_id: str, total_value: float, total_drift: float, holdings_snapshot: List[Dict[str, Any]], triggered_alert: bool) -> Dict[str, Any]:
    """Saves a historical drift snapshot."""
    pk = f"PORTFOLIO#{portfolio_id}"
    timestamp = int(time.time())
    sk = f"SNAPSHOT#{timestamp}"
    
    snapshot_item = {
        "PK": pk,
        "SK": sk,
        "timestamp": timestamp,
        "total_value": total_value,
        "total_drift": total_drift,
        "holdings_snapshot": holdings_snapshot,
        "triggered_alert": triggered_alert
    }
    
    table = _get_table()
    if table:
        try:
            table.put_item(Item=_floats_to_decimals(snapshot_item))
        except Exception as e:
            print(f"DynamoDB save_drift_snapshot error: {e}")
            raise e
    else:
        _mock_put_item(snapshot_item)
        
    return snapshot_item

def get_drift_snapshots(portfolio_id: str, limit: int = 30) -> List[Dict[str, Any]]:
    """Gets historical drift snapshots for a portfolio."""
    pk = f"PORTFOLIO#{portfolio_id}"
    
    table = _get_table()
    if table:
        try:
            response = table.query(
                KeyConditionExpression=Key("PK").eq(pk) & Key("SK").begins_with("SNAPSHOT#"),
                ScanIndexForward=False, # Sort descending (newest first)
                Limit=limit
            )
            items = response.get("Items", [])
            return [_decimals_to_floats(i) for i in items]
        except Exception as e:
            print(f"DynamoDB get_drift_snapshots error: {e}")
            return []
    else:
        snapshots = _mock_query(pk, "SNAPSHOT#")
        # Sort descending by timestamp
        snapshots.sort(key=lambda x: x["timestamp"], reverse=True)
        return snapshots[:limit]

def scan_all_portfolios() -> List[Dict[str, Any]]:
    """Scans the entire database for portfolios. Used by the daily batch cron job."""
    table = _get_table()
    if table:
        try:
            # In a real production system, you would use a GSI or parallel scan,
            # but for our SaaS scale, a single scan with FilterExpression is perfect.
            response = table.scan(
                FilterExpression="begins_with(SK, :prefix)",
                ExpressionAttributeValues={":prefix": "PORTFOLIO#"}
            )
            items = response.get("Items", [])
            return [_decimals_to_floats(i) for i in items]
        except Exception as e:
            print(f"DynamoDB scan_all_portfolios error: {e}")
            return []
    else:
        _load_mock_from_file()
        all_portfolios = []
        for pk, sk_dict in _MOCK_STORE.items():
            for sk, item in sk_dict.items():
                if sk.startswith("PORTFOLIO#"):
                    all_portfolios.append(item)
        return all_portfolios

