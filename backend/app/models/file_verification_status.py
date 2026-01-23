"""
File Verification Status Enum

Defines the verification status for provider uploaded files.
"""

from enum import Enum


class FileVerificationStatus(str, Enum):
    """
    Status of file verification by admin.
    
    - PROCESSING: File uploaded but not yet reviewed by admin (default)
    - ACCEPTED: File reviewed and accepted by admin
    - REJECTED: File reviewed and rejected by admin (provider can replace)
    """
    PROCESSING = "processing"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
