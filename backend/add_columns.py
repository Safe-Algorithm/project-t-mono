from app.core.db import engine
from sqlalchemy import text

with engine.connect() as conn:
    try:
        conn.execute(text("ALTER TABLE providerfile ADD COLUMN IF NOT EXISTS backblaze_file_id VARCHAR(255)"))
        conn.execute(text("ALTER TABLE providerfile ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(500)"))
        conn.commit()
        print("Columns added successfully")
    except Exception as e:
        print(f"Error: {e}")
