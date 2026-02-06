"""
Unit tests for localization utility functions.
"""

import pytest
from unittest.mock import MagicMock
from app.utils.localization import get_localized_field, get_name, get_description


class TestGetLocalizedField:
    """Tests for get_localized_field()."""

    def test_returns_en_when_both_present(self):
        """When both languages present, prefer_lang='en' returns English."""
        obj = MagicMock(name_en="English Name", name_ar="Arabic Name")
        assert get_localized_field(obj, "name") == "English Name"

    def test_returns_ar_when_prefer_ar(self):
        """When both languages present, prefer_lang='ar' returns Arabic."""
        obj = MagicMock(name_en="English Name", name_ar="Arabic Name")
        assert get_localized_field(obj, "name", prefer_lang="ar") == "Arabic Name"

    def test_falls_back_to_ar_when_en_missing(self):
        """When English is None, falls back to Arabic."""
        obj = MagicMock(name_en=None, name_ar="Arabic Name")
        assert get_localized_field(obj, "name") == "Arabic Name"

    def test_falls_back_to_en_when_ar_missing(self):
        """When Arabic is None and prefer_lang='ar', falls back to English."""
        obj = MagicMock(name_en="English Name", name_ar=None)
        assert get_localized_field(obj, "name", prefer_lang="ar") == "English Name"

    def test_returns_none_when_both_missing(self):
        """When both languages are None, returns None."""
        obj = MagicMock(name_en=None, name_ar=None)
        assert get_localized_field(obj, "name") is None

    def test_falls_back_to_ar_when_en_empty_string(self):
        """Empty string is falsy, so falls back to Arabic."""
        obj = MagicMock(name_en="", name_ar="Arabic Name")
        assert get_localized_field(obj, "name") == "Arabic Name"

    def test_works_with_description_field(self):
        """Works with 'description' field base."""
        obj = MagicMock(description_en="English Desc", description_ar="Arabic Desc")
        assert get_localized_field(obj, "description") == "English Desc"

    def test_returns_none_when_field_doesnt_exist(self):
        """Returns None when the object doesn't have the field (getattr default)."""
        obj = MagicMock(spec=[])  # No attributes
        assert get_localized_field(obj, "nonexistent") is None


class TestGetName:
    """Tests for get_name()."""

    def test_returns_name_en(self):
        obj = MagicMock(name_en="Trip Name", name_ar=None)
        assert get_name(obj) == "Trip Name"

    def test_returns_name_ar_when_en_missing(self):
        obj = MagicMock(name_en=None, name_ar="اسم الرحلة")
        assert get_name(obj) == "اسم الرحلة"

    def test_returns_unnamed_when_both_missing(self):
        obj = MagicMock(name_en=None, name_ar=None)
        assert get_name(obj) == "Unnamed"

    def test_prefers_ar_when_requested(self):
        obj = MagicMock(name_en="English", name_ar="عربي")
        assert get_name(obj, prefer_lang="ar") == "عربي"


class TestGetDescription:
    """Tests for get_description()."""

    def test_returns_description_en(self):
        obj = MagicMock(description_en="English Desc", description_ar=None)
        assert get_description(obj) == "English Desc"

    def test_returns_description_ar_when_en_missing(self):
        obj = MagicMock(description_en=None, description_ar="وصف عربي")
        assert get_description(obj) == "وصف عربي"

    def test_returns_empty_string_when_both_missing(self):
        obj = MagicMock(description_en=None, description_ar=None)
        assert get_description(obj) == ""

    def test_prefers_ar_when_requested(self):
        obj = MagicMock(description_en="English", description_ar="عربي")
        assert get_description(obj, prefer_lang="ar") == "عربي"
