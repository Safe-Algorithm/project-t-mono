"""
Seed script to create example file definitions for provider registration.
Run this script to populate the database with sample file definitions.
"""

import asyncio
from sqlmodel import Session, select

from app.core.db import engine
from app.models.file_definition import FileDefinition


def seed_file_definitions():
    """Create example file definitions"""
    
    file_definitions = [
        {
            "key": "zakat_certificate",
            "name_en": "Zakat Registration Certificate",
            "name_ar": "شهادة تسجيل الزكاة",
            "description_en": "Your Zakat Registration Certificate that proves you have registered with Zakat, Tax and Customs Authority",
            "description_ar": "شهادة تسجيل الزكاة الخاصة بك والتي تثبت تسجيلك لدى هيئة الزكاة والضريبة والجمارك",
            "allowed_extensions": ["pdf", "jpg", "png"],
            "max_size_mb": 100,
            "is_required": True,
            "is_active": True,
            "display_order": 1
        },
        {
            "key": "commercial_registration",
            "name_en": "Commercial Registration",
            "name_ar": "السجل التجاري",
            "description_en": "Your company's commercial registration certificate issued by the Ministry of Commerce",
            "description_ar": "شهادة السجل التجاري لشركتك الصادرة عن وزارة التجارة",
            "allowed_extensions": ["pdf", "jpg", "png"],
            "max_size_mb": 50,
            "is_required": True,
            "is_active": True,
            "display_order": 2
        },
        {
            "key": "tourism_license",
            "name_en": "Tourism License",
            "name_ar": "رخصة السياحة",
            "description_en": "Your tourism license issued by the Ministry of Tourism",
            "description_ar": "رخصة السياحة الخاصة بك الصادرة عن وزارة السياحة",
            "allowed_extensions": ["pdf", "jpg", "png"],
            "max_size_mb": 50,
            "is_required": True,
            "is_active": True,
            "display_order": 3
        },
        {
            "key": "vat_certificate",
            "name_en": "VAT Registration Certificate",
            "name_ar": "شهادة تسجيل ضريبة القيمة المضافة",
            "description_en": "Your VAT registration certificate if your company is VAT registered",
            "description_ar": "شهادة تسجيل ضريبة القيمة المضافة إذا كانت شركتك مسجلة في ضريبة القيمة المضافة",
            "allowed_extensions": ["pdf", "jpg", "png"],
            "max_size_mb": 50,
            "is_required": False,
            "is_active": True,
            "display_order": 4
        },
        {
            "key": "company_profile",
            "name_en": "Company Profile",
            "name_ar": "ملف الشركة",
            "description_en": "A comprehensive company profile document describing your services and experience",
            "description_ar": "وثيقة ملف شركة شاملة تصف خدماتك وخبرتك",
            "allowed_extensions": ["pdf", "doc", "docx"],
            "max_size_mb": 25,
            "is_required": False,
            "is_active": True,
            "display_order": 5
        },
        {
            "key": "insurance_certificate",
            "name_en": "Insurance Certificate",
            "name_ar": "شهادة التأمين",
            "description_en": "Valid insurance certificate covering your tourism operations",
            "description_ar": "شهادة تأمين سارية تغطي عملياتك السياحية",
            "allowed_extensions": ["pdf", "jpg", "png"],
            "max_size_mb": 50,
            "is_required": True,
            "is_active": True,
            "display_order": 6
        }
    ]
    
    with Session(engine) as session:
        # Check if any file definitions already exist
        existing = session.exec(select(FileDefinition)).first()
        if existing:
            print("File definitions already exist. Skipping seed.")
            return
        
        # Create file definitions
        for fd_data in file_definitions:
            file_definition = FileDefinition(**fd_data)
            session.add(file_definition)
        
        session.commit()
        print(f"✅ Successfully created {len(file_definitions)} file definitions")
        
        # Print created definitions
        for fd in file_definitions:
            print(f"  - {fd['name_en']} ({fd['key']})")


if __name__ == "__main__":
    print("Seeding file definitions...")
    seed_file_definitions()
    print("Done!")
