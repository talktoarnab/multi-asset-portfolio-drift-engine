import os
import hashlib
import hmac
import jwt
import time
from typing import Optional, Tuple

JWT_SECRET = os.environ.get("JWT_SECRET", "super-secret-drift-engine-key-2026")
JWT_ALGORITHM = "HS256"
TOKEN_EXPIRATION_SECONDS = 24 * 60 * 60  # 24 hours

def hash_password(password: str) -> str:
    """
    Hashes a password securely using PBKDF2 with SHA256.
    Returns a string in the format: pbkdf2_sha256$iterations$salt$hash
    """
    salt = os.urandom(16).hex()
    iterations = 100000
    
    pwd_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        iterations
    ).hex()
    
    return f"pbkdf2_sha256${iterations}${salt}${pwd_hash}"

def verify_password(password: str, hashed: str) -> bool:
    """
    Verifies a password against its PBKDF2 hash.
    """
    try:
        parts = hashed.split("$")
        if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
            return False
            
        iterations = int(parts[1])
        salt = parts[2]
        original_hash = parts[3]
        
        test_hash = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt.encode("utf-8"),
            iterations
        ).hex()
        
        return hmac.compare_digest(original_hash, test_hash)
    except Exception:
        return False

def generate_token(email: str) -> str:
    """
    Generates a JWT token for a user session.
    """
    payload = {
        "sub": email.lower().strip(),
        "iat": int(time.time()),
        "exp": int(time.time()) + TOKEN_EXPIRATION_SECONDS
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_token(token: str) -> Optional[str]:
    """
    Verifies a JWT token and returns the user's email if valid.
    """
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        print("JWT token expired")
        return None
    except jwt.InvalidTokenError as e:
        print(f"Invalid JWT token: {e}")
        return None
    except Exception as e:
        print(f"JWT verification error: {e}")
        return None
