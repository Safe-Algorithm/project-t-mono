from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session
import secrets
import json
import uuid

from app import crud
from app.api import deps
from app.models.user import User, UserRole
from app.models.source import RequestSource
from app.schemas.user import UserCreate, UserPublic, UserRoleUpdate
from app.core.redis import redis_client
from app.core.config import settings
from app.services.email import email_service

router = APIRouter()


@router.post("/invite", response_model=UserPublic)
async def invite_team_member(
    *, 
    background_tasks: BackgroundTasks,
    session: Session = Depends(deps.get_session), 
    current_user: User = Depends(deps.get_current_active_super_provider),
    user_in: UserCreate
):
    """
    Invite a new team member to the provider's team.
    Sends an invitation email with a link to accept and set up their account.
    """
    # Check if user with email already exists in PROVIDERS_PANEL source
    user = crud.user.get_user_by_email_and_source(session, email=user_in.email, source=RequestSource.PROVIDERS_PANEL)
    if user:
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists in the providers panel.",
        )
    
    # Check if user with phone already exists in PROVIDERS_PANEL source
    user_by_phone = crud.user.get_user_by_phone_and_source(session, phone=user_in.phone, source=RequestSource.PROVIDERS_PANEL)
    if user_by_phone:
        raise HTTPException(
            status_code=400,
            detail="A user with this phone number already exists in the providers panel.",
        )
    
    # Generate invitation token
    invitation_token = secrets.token_urlsafe(32)
    
    # Store invitation data in Redis with 7-day expiry
    redis_key = f"team_invitation:{invitation_token}"
    invitation_data = {
        "email": user_in.email,
        "name": user_in.name,
        "phone": user_in.phone,
        "password": user_in.password,
        "provider_id": str(current_user.provider_id),
        "inviter_name": current_user.name
    }
    redis_client.setex(redis_key, 7 * 24 * 60 * 60, json.dumps(invitation_data))
    
    # Get provider info for email
    provider = crud.provider.get_provider(session, provider_id=current_user.provider_id)
    company_name = provider.company_name if provider else "Our Company"
    
    # Send invitation email in background
    invitation_url = f"{settings.PROVIDERS_PANEL_URL}/accept-invitation?token={invitation_token}"
    background_tasks.add_task(
        email_service.send_team_invitation_email,
        to_email=user_in.email,
        to_name=user_in.name,
        inviter_name=current_user.name,
        company_name=company_name,
        invitation_token=invitation_token,
        invitation_url=invitation_url
    )
    
    # Create user with is_active=False until they accept invitation
    user_in.role = UserRole.NORMAL
    user_in.provider_id = current_user.provider_id
    user = crud.user.create_user(session, user_in=user_in, source=RequestSource.PROVIDERS_PANEL)
    user.is_active = False  # User must accept invitation to activate
    session.add(user)
    session.commit()
    session.refresh(user)
    
    return user


@router.post("/accept-invitation", response_model=UserPublic)
def accept_team_invitation(
    token: str,
    session: Session = Depends(deps.get_session),
):
    """
    Accept team invitation using token from email.
    Activates the user account.
    """
    # Check token in Redis
    redis_key = f"team_invitation:{token}"
    invitation_data = redis_client.get(redis_key)
    
    if not invitation_data:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired invitation token"
        )
    
    # Parse invitation data (handle both bytes and string from Redis)
    if isinstance(invitation_data, bytes):
        data = json.loads(invitation_data.decode())
    else:
        data = json.loads(invitation_data)
    
    # Find user by email and source (PROVIDERS_PANEL)
    user = crud.user.get_user_by_email_and_source(
        session, 
        email=data["email"], 
        source=RequestSource.PROVIDERS_PANEL
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Activate user account
    user.is_active = True
    session.add(user)
    session.commit()
    session.refresh(user)
    
    # Delete token from Redis
    redis_client.delete(redis_key)
    
    return user


@router.get("/", response_model=list[UserPublic])
def get_team_members(
    *, 
    session: Session = Depends(deps.get_session), 
    current_user: User = Depends(deps.get_current_active_provider)
):
    """
    Get all team members for the provider.
    """
    users = crud.user.get_users_by_provider_id(
        session, provider_id=current_user.provider_id
    )
    return users


@router.delete("/{user_id}", status_code=204)
def delete_team_member(
    *, 
    session: Session = Depends(deps.get_session), 
    current_user: User = Depends(deps.get_current_active_super_provider),
    user_id: uuid.UUID
):
    """
    Delete a team member.
    """
    user_to_delete = crud.user.get_user_by_id(session, user_id=user_id)
    if not user_to_delete:
        raise HTTPException(status_code=404, detail="User not found")

    if user_to_delete.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if user_to_delete.id == current_user.id:
        raise HTTPException(
            status_code=400, detail="Cannot delete yourself"
        )

    if user_to_delete.role == UserRole.SUPER_USER:
        raise HTTPException(
            status_code=403, detail="Cannot delete a workspace owner"
        )

    crud.user.delete_user(session, db_user=user_to_delete)
    return


@router.put("/{user_id}/role", response_model=UserPublic)
def update_team_member_role(
    *,
    session: Session = Depends(deps.get_session),
    current_user: User = Depends(deps.get_current_active_super_provider),
    user_id: uuid.UUID,
    role_in: UserRoleUpdate,
):
    """
    Update a team member's role.
    """
    user_to_update = crud.user.get_user_by_id(session, user_id=user_id)
    if not user_to_update:
        raise HTTPException(status_code=404, detail="User not found")

    if user_to_update.provider_id != current_user.provider_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if user_to_update.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")

    if user_to_update.role == UserRole.SUPER_USER:
        raise HTTPException(status_code=403, detail="Cannot demote a workspace owner")

    if role_in.role == UserRole.SUPER_USER:
        raise HTTPException(status_code=403, detail="Cannot promote a user to workspace owner")

    # Ensure only provider-related roles can be assigned
    if role_in.role not in [UserRole.NORMAL, UserRole.SUPER_USER]:
        raise HTTPException(status_code=400, detail="Invalid role for a team member")

    updated_user = crud.user.update_user_role(
        session, db_user=user_to_update, role=role_in.role
    )
    return updated_user
