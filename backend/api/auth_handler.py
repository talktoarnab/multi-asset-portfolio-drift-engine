import sys
import os
# Add current directory and parent directory to path to allow imports when running in AWS Lambda
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

from backend.common.api_utils import make_response, parse_body, get_authenticated_user
from backend.common import db
from backend.common import auth

def handler(event, context):
    """
    Unified Lambda handler for authentication routes.
    """
    # Handle CORS preflight requests
    if event.get("httpMethod") == "OPTIONS":
        return make_response(200, "OK")
        
    path = event.get("path", "")
    method = event.get("httpMethod", "")
    
    if path.endswith("/auth/register") and method == "POST":
        return register_route(event)
    elif path.endswith("/auth/login") and method == "POST":
        return login_route(event)
    elif path.endswith("/auth/me") and method == "GET":
        return me_route(event)
    elif path.endswith("/auth/settings") and method == "PUT":
        return update_settings_route(event)
    else:
        return make_response(404, {"error": f"Route not found: {method} {path}"})

def register_route(event):
    body = parse_body(event)
    email = body.get("email", "").strip()
    password = body.get("password", "")
    
    if not email or not password:
        return make_response(400, {"error": "Email and password are required"})
        
    if len(password) < 6:
        return make_response(400, {"error": "Password must be at least 6 characters long"})
        
    # Check if user already exists
    existing_user = db.get_user(email)
    if existing_user:
        return make_response(400, {"error": "A user with this email already exists"})
        
    # Hash password and create user
    pwd_hash = auth.hash_password(password)
    try:
        user = db.create_user(email, pwd_hash)
        token = auth.generate_token(email)
        
        return make_response(201, {
            "token": token,
            "user": {
                "email": user["email"],
                "alert_threshold": user["alert_threshold"],
                "notification_enabled": user["notification_enabled"]
            }
        })
    except Exception as e:
        return make_response(500, {"error": f"Failed to register user: {str(e)}"})

def login_route(event):
    body = parse_body(event)
    email = body.get("email", "").strip()
    password = body.get("password", "")
    
    if not email or not password:
        return make_response(400, {"error": "Email and password are required"})
        
    user = db.get_user(email)
    if not user or not auth.verify_password(password, user["password_hash"]):
        return make_response(401, {"error": "Invalid email or password"})
        
    token = auth.generate_token(email)
    return make_response(200, {
        "token": token,
        "user": {
            "email": user["email"],
            "alert_threshold": float(user["alert_threshold"]),
            "notification_enabled": bool(user["notification_enabled"])
        }
    })

def me_route(event):
    email, err = get_authenticated_user(event)
    if err:
        return err
        
    user = db.get_user(email)
    if not user:
        return make_response(404, {"error": "User profile not found"})
        
    return make_response(200, {
        "user": {
            "email": user["email"],
            "alert_threshold": float(user["alert_threshold"]),
            "notification_enabled": bool(user["notification_enabled"])
        }
    })

def update_settings_route(event):
    email, err = get_authenticated_user(event)
    if err:
        return err
        
    body = parse_body(event)
    alert_threshold = body.get("alert_threshold")
    notification_enabled = body.get("notification_enabled")
    
    if alert_threshold is None or notification_enabled is None:
        return make_response(400, {"error": "alert_threshold and notification_enabled are required"})
        
    try:
        alert_threshold = float(alert_threshold)
        if alert_threshold <= 0 or alert_threshold > 1.0:
            return make_response(400, {"error": "alert_threshold must be between 0 and 1 (e.g., 0.05 for 5%)"})
            
        user = db.update_user_settings(email, alert_threshold, bool(notification_enabled))
        if not user:
            return make_response(404, {"error": "User not found"})
            
        return make_response(200, {
            "user": {
                "email": user["email"],
                "alert_threshold": float(user["alert_threshold"]),
                "notification_enabled": bool(user["notification_enabled"])
            }
        })
    except ValueError:
        return make_response(400, {"error": "alert_threshold must be a valid decimal number"})
    except Exception as e:
        return make_response(500, {"error": f"Failed to update settings: {str(e)}"})
