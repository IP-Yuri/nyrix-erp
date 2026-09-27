from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from backend.app.core.database import get_db
from backend.app.core.security import verify_password, create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES
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
