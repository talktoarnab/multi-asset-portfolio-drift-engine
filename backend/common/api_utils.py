import json
from typing import Dict, Any, Tuple, Optional
from backend.common.auth import verify_token

def make_response(status_code: int, body: Any) -> Dict[str, Any]:
    """
    Formats an API Gateway Proxy response with CORS headers.
    """
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token",
            "Access-Control-Allow-Methods": "DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT"
        },
        "body": json.dumps(body)
    }

def parse_body(event: Dict[str, Any]) -> Dict[str, Any]:
    """
    Safely parses the request body from an API Gateway event.
    """
    body_str = event.get("body") or "{}"
    try:
        # Handle Base64 encoded bodies if any
        if event.get("isBase64Encoded", False):
            import base64
            body_str = base64.b64decode(body_str).decode("utf-8")
        return json.loads(body_str)
    except Exception:
        return {}

def get_authenticated_user(event: Dict[str, Any]) -> Tuple[Optional[str], Optional[Dict[str, Any]]]:
    """
    Extracts the JWT token from the Authorization header and verifies it.
    Returns (email, error_response) tuple. If successful, error_response is None.
    """
    headers = event.get("headers") or {}
    # Case-insensitive header lookup
    auth_header = headers.get("Authorization") or headers.get("authorization")
    
    if not auth_header:
        return None, make_response(401, {"error": "Missing Authorization header"})
        
    if not auth_header.startswith("Bearer "):
        return None, make_response(401, {"error": "Invalid Authorization header format. Must be 'Bearer <token>'"})
        
    token = auth_header.split(" ")[1]
    email = verify_token(token)
    
    if not email:
        return None, make_response(401, {"error": "Invalid or expired session token"})
        
    return email, None
