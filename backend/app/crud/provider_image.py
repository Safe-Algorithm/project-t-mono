import uuid
from typing import List, Optional

from sqlmodel import Session, select

from app.models.provider_image import ProviderImage


def add_image(
    *,
    session: Session,
    provider_id: uuid.UUID,
    url: str,
    b2_file_id: str,
    b2_file_name: str,
    original_filename: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    size_bytes: Optional[int] = None,
) -> ProviderImage:
    img = ProviderImage(
        provider_id=provider_id,
        url=url,
        b2_file_id=b2_file_id,
        b2_file_name=b2_file_name,
        original_filename=original_filename,
        width=width,
        height=height,
        size_bytes=size_bytes,
    )
    session.add(img)
    session.commit()
    session.refresh(img)
    return img


def get_images_by_provider(
    *,
    session: Session,
    provider_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
) -> List[ProviderImage]:
    stmt = (
        select(ProviderImage)
        .where(ProviderImage.provider_id == provider_id)
        .order_by(ProviderImage.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return list(session.exec(stmt).all())


def count_images_by_provider(*, session: Session, provider_id: uuid.UUID) -> int:
    from sqlmodel import func
    stmt = select(func.count()).where(ProviderImage.provider_id == provider_id).select_from(ProviderImage)
    return session.exec(stmt).one()


def get_image(*, session: Session, image_id: uuid.UUID) -> Optional[ProviderImage]:
    return session.get(ProviderImage, image_id)


def delete_image(*, session: Session, image: ProviderImage) -> None:
    session.delete(image)
    session.commit()


def get_image_by_url(*, session: Session, provider_id: uuid.UUID, url: str) -> Optional[ProviderImage]:
    stmt = select(ProviderImage).where(
        ProviderImage.provider_id == provider_id,
        ProviderImage.url == url,
    )
    return session.exec(stmt).first()
