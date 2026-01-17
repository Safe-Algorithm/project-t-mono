from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app import crud
from app.api import deps
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserPublic, UserRoleUpdate
import uuid

router = APIRouter()


@router.post("/invite", response_model=UserPublic)
def invite_team_member(
    *, 
    session: Session = Depends(deps.get_session), 
    current_user: User = Depends(deps.get_current_active_super_provider),
    user_in: UserCreate
):
    """
    Invite a new team member to the provider's team.
    """
    user = crud.user.get_user_by_email(session, email=user_in.email)
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists in the system.",
        )
    
    user_in.role = UserRole.NORMAL
    user_in.provider_id = current_user.provider_id
    user = crud.user.create_user(session, user_in=user_in)
    return user


@router.get("/", response_model=list[UserPublic])
def get_team_members(
    *, 
    session: Session = Depends(deps.get_session), 
    current_user: User = Depends(deps.get_current_active_super_provider)
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

    # Ensure only provider-related roles can be assigned
    if role_in.role not in [UserRole.NORMAL, UserRole.SUPER_USER]:
        raise HTTPException(status_code=400, detail="Invalid role for a team member")

    updated_user = crud.user.update_user_role(
        session, db_user=user_to_update, role=role_in.role
    )
    return updated_user
