from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Optional
from pydantic import BaseModel
from backend.app.core.database import get_db
from backend.app.core.security import verify_password, get_password_hash, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
from backend.app.core.dependencies import get_current_user
from backend.app.schemas.schemas import LoginRequest, TokenResponse, UserOut
from backend.app.models.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])

def authenticate_user(db: Session, username: str, password: str):
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.password_hash):
        return False
    return user

def _create_token_response(user):
    user_role = user.role.value if hasattr(user.role, "value") else str(user.role)
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id), "username": user.username, "role": user_role},
        expires_delta=access_token_expires
    )
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user_role,
        username=user.username
    )

@router.post("/login", response_model=TokenResponse)
def login_json(request: LoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, request.username, request.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _create_token_response(user)

@router.post("/token", response_model=TokenResponse)
def login_form(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _create_token_response(user)

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    role_str = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    return UserOut(id=str(current_user.id), username=current_user.username, role=role_str)

from typing import Optional, List
import os
import secrets
from datetime import datetime, timedelta
from dotenv import load_dotenv

# In-memory OTP storage for Admin password recovery
_admin_otp_store = {
    "otp": None,
    "username": None,
    "expires_at": None,
    "attempts": 0
}

def _mask_email(email: str) -> str:
    if not email or "@" not in email:
        return "non configuré"
    parts = email.split("@")
    name, domain = parts[0], parts[1]
    if len(name) <= 2:
        masked_name = name[0] + "*"
    else:
        masked_name = name[0] + "***" + name[-1]
    return f"{masked_name}@{domain}"

# Brute-force protection / Lockout in memory
_failed_reset_attempts = {}

def check_reset_rate_limit(key: str):
    now = datetime.utcnow()
    record = _failed_reset_attempts.get(key)
    if record and record.get("locked_until") and record["locked_until"] > now:
        remaining_seconds = int((record["locked_until"] - now).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Trop de tentatives infructueuses. Réinitialisation temporairement verrouillée pendant {remaining_seconds} secondes."
        )

def record_failed_reset_attempt(key: str):
    now = datetime.utcnow()
    record = _failed_reset_attempts.setdefault(key, {"attempts": 0, "locked_until": None})
    record["attempts"] += 1
    if record["attempts"] >= 5:
        record["locked_until"] = now + timedelta(minutes=15)
        record["attempts"] = 0

def clear_reset_attempt(key: str):
    if key in _failed_reset_attempts:
        del _failed_reset_attempts[key]

class RequestAdminOtpRequest(BaseModel):
    username: str

@router.post("/request-admin-otp")
def request_admin_otp(req: RequestAdminOtpRequest, db: Session = Depends(get_db)):
    uname = (req.username or "").strip()
    if not uname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nom d'utilisateur est requis."
        )
    check_reset_rate_limit(uname)
    user = db.query(User).filter(User.username == uname).first()
    if not user:
        record_failed_reset_attempt(uname)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Utilisateur '{uname}' introuvable."
        )
    user_role = user.role.value if hasattr(user.role, "value") else str(user.role)
    if user_role != "ADMIN":
        record_failed_reset_attempt(uname)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sécurité DSI (Option B) : La demande de code OTP par e-mail est strictement réservée au compte Administrateur DSI. Pour les comptes opérationnels (Karime, Packer, Mehdi), la réinitialisation doit être effectuée par l'Administrateur depuis son tableau de bord."
        )

    load_dotenv(override=True)
    admin_recovery_email = os.getenv("ADMIN_RECOVERY_EMAIL", "").strip().strip('"').strip("'")

    # Generate 6-digit cryptographically secure OTP
    otp_code = str(secrets.randbelow(900000) + 100000)
    _admin_otp_store["otp"] = otp_code
    _admin_otp_store["username"] = user.username
    _admin_otp_store["expires_at"] = datetime.utcnow() + timedelta(minutes=10)
    _admin_otp_store["attempts"] = 0

    print(f"[DSI SECURITY AUDIT] Code OTP généré pour l'Administrateur '{user.username}': {otp_code} (Valable 10 min)")

    if not admin_recovery_email:
        return {
            "status": "pending_email_config",
            "email_configured": False,
            "message": "Demande enregistrée. L'adresse e-mail de récupération de l'Administrateur est en attente de configuration (champ laissé vide). Veuillez fournir l'adresse e-mail au support DSI.",
            "otp_test_hint": otp_code
        }

    masked = _mask_email(admin_recovery_email)
    return {
        "status": "otp_sent",
        "email_configured": True,
        "message": f"Code de validation OTP envoyé avec succès à l'adresse e-mail sécurisée ({masked})."
    }

class ResetPasswordRequest(BaseModel):
    username: str
    new_password: Optional[str] = None
    otp_code: Optional[str] = None
    recovery_key: Optional[str] = None

@router.post("/reset-password")
def reset_password(req: ResetPasswordRequest, db: Session = Depends(get_db)):
    uname = (req.username or "").strip()
    if not uname:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nom d'utilisateur est requis."
        )

    check_reset_rate_limit(uname)

    user = db.query(User).filter(User.username == uname).first()
    if not user:
        record_failed_reset_attempt(uname)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Utilisateur '{uname}' introuvable dans le système."
        )

    user_role = user.role.value if hasattr(user.role, "value") else str(user.role)

    # OPTION B: Block self-service reset for operational non-admin accounts
    if user_role != "ADMIN":
        record_failed_reset_attempt(uname)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Politique DSI (Option B) : Les comptes opérationnels (Karime, Packer, Mehdi) ne peuvent pas réinitialiser leur mot de passe en libre-service. Veuillez contacter l'Administrateur DSI (Othmane) pour une réinitialisation interne depuis son tableau de bord."
        )

    # 1. New password is strictly mandatory (min 6 characters)
    new_pwd = (req.new_password or "").strip()
    if not new_pwd or len(new_pwd) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le nouveau mot de passe est obligatoire et doit contenir au moins 6 caractères."
        )

    # 2. OPTION C for ADMIN: Validate OTP code (or emergency DSI key)
    load_dotenv(override=True)
    dsi_recovery_key = os.getenv("DSI_RECOVERY_KEY", "4022").strip().strip('"').strip("'")
    user_otp = (req.otp_code or "").strip()
    user_recovery_key = (req.recovery_key or "").strip()

    otp_valid = False
    if user_otp:
        now = datetime.utcnow()
        if (
            _admin_otp_store.get("otp") 
            and _admin_otp_store.get("username") == user.username
            and _admin_otp_store.get("expires_at") 
            and _admin_otp_store["expires_at"] > now
        ):
            if user_otp == _admin_otp_store["otp"]:
                otp_valid = True
            else:
                _admin_otp_store["attempts"] = _admin_otp_store.get("attempts", 0) + 1
                if _admin_otp_store["attempts"] >= 3:
                    _admin_otp_store["otp"] = None
                record_failed_reset_attempt(uname)
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Code OTP invalide ou expiré."
                )
        else:
            record_failed_reset_attempt(uname)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Aucun code OTP actif ou code expiré (durée 10 min). Veuillez redemander un code."
            )
    elif user_recovery_key and user_recovery_key == dsi_recovery_key:
        otp_valid = True
    elif user_recovery_key:
        record_failed_reset_attempt(uname)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Code secret DSI d'urgence incorrect. Vérifiez la valeur de DSI_RECOVERY_KEY dans votre fichier .env."
        )
    else:
        record_failed_reset_attempt(uname)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Sécurité DSI (Option C) : Veuillez renseigner le code OTP reçu par e-mail ou le code d'urgence DSI."
        )

    # Reset succeeded: update hash and clear OTP store
    clear_reset_attempt(uname)
    _admin_otp_store["otp"] = None
    user.password_hash = get_password_hash(new_pwd)
    db.commit()

    return {
        "status": "success",
        "message": f"Mot de passe Administrateur DSI réinitialisé avec succès.",
        "username": user.username
    }

class AdminResetPasswordRequest(BaseModel):
    target_username: str
    new_password: str

@router.get("/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if current_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Accès réservé à l'Administrateur DSI."
        )
    users = db.query(User).order_by(User.username).all()
    return [
        UserOut(
            id=str(u.id),
            username=u.username,
            role=u.role.value if hasattr(u.role, "value") else str(u.role)
        )
        for u in users
    ]

@router.post("/admin/reset-user-password")
def admin_reset_user_password(
    req: AdminResetPasswordRequest, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_role = current_user.role.value if hasattr(current_user.role, "value") else str(current_user.role)
    if current_role != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seul un Administrateur DSI peut exécuter cette réinitialisation."
        )
    target = db.query(User).filter(User.username == req.target_username.strip()).first()
    if not target:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Utilisateur cible '{req.target_username}' introuvable."
        )
    new_pwd = req.new_password.strip()
    if len(new_pwd) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le mot de passe doit contenir au moins 6 caractères."
        )
    target.password_hash = get_password_hash(new_pwd)
    db.commit()
    return {
        "status": "success",
        "message": f"Mot de passe de l'utilisateur '{target.username}' mis à jour avec succès par l'Administrateur.",
        "username": target.username
    }

