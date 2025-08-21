import enum


class RequestSource(str, enum.Enum):
    """Enum to identify the source of API requests"""
    MOBILE_APP = "mobile_app"
    ADMIN_PANEL = "admin_panel"
    PROVIDERS_PANEL = "providers_panel"
