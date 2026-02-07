"""
Seed worldwide destinations (countries) into the database.

Uses the REST Countries API to fetch country data with ISO codes, timezones, and currencies.
All countries are seeded as inactive — admin activates them as needed.

Usage:
    docker compose exec backend python -m scripts.seed_destinations
"""

import re
import sys
import os

# Add the backend directory to the path so we can import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import requests
from sqlmodel import Session, select

from app.core.db import engine
from app.models.destination import Destination, DestinationType


# Arabic name mapping for countries that have Arabic native names
# The REST Countries API provides translations, but we also check nativeName for Arabic
ARABIC_COUNTRY_NAMES = {
    "SA": "المملكة العربية السعودية",
    "AE": "الإمارات العربية المتحدة",
    "EG": "مصر",
    "JO": "الأردن",
    "LB": "لبنان",
    "IQ": "العراق",
    "SY": "سوريا",
    "PS": "فلسطين",
    "KW": "الكويت",
    "BH": "البحرين",
    "QA": "قطر",
    "OM": "عمان",
    "YE": "اليمن",
    "LY": "ليبيا",
    "TN": "تونس",
    "DZ": "الجزائر",
    "MA": "المغرب",
    "SD": "السودان",
    "SO": "الصومال",
    "DJ": "جيبوتي",
    "MR": "موريتانيا",
    "TR": "تركيا",
    "MY": "ماليزيا",
    "ID": "إندونيسيا",
    "GB": "المملكة المتحدة",
    "US": "الولايات المتحدة",
    "FR": "فرنسا",
    "DE": "ألمانيا",
    "IT": "إيطاليا",
    "ES": "إسبانيا",
    "JP": "اليابان",
    "CN": "الصين",
    "IN": "الهند",
    "BR": "البرازيل",
    "AU": "أستراليا",
    "CA": "كندا",
    "RU": "روسيا",
    "KR": "كوريا الجنوبية",
    "TH": "تايلاند",
    "PH": "الفلبين",
    "PK": "باكستان",
    "BD": "بنغلاديش",
    "NG": "نيجيريا",
    "ZA": "جنوب أفريقيا",
    "KE": "كينيا",
    "ET": "إثيوبيا",
    "GH": "غانا",
    "TZ": "تنزانيا",
    "MX": "المكسيك",
    "AR": "الأرجنتين",
    "CO": "كولومبيا",
    "CL": "تشيلي",
    "PE": "بيرو",
    "NZ": "نيوزيلندا",
    "SG": "سنغافورة",
    "HK": "هونغ كونغ",
    "SE": "السويد",
    "NO": "النرويج",
    "DK": "الدنمارك",
    "FI": "فنلندا",
    "NL": "هولندا",
    "BE": "بلجيكا",
    "CH": "سويسرا",
    "AT": "النمسا",
    "PT": "البرتغال",
    "GR": "اليونان",
    "PL": "بولندا",
    "CZ": "التشيك",
    "IE": "أيرلندا",
}


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')


def get_arabic_name(country_data: dict, country_code: str) -> str:
    """Extract Arabic name from country data, API translations, or fallback mapping."""
    # 1. Check API translations (most reliable for all countries)
    translations = country_data.get("translations", {})
    if "ara" in translations:
        return translations["ara"].get("official", translations["ara"].get("common", ""))

    # 2. Check our manual mapping for well-known countries
    if country_code in ARABIC_COUNTRY_NAMES:
        return ARABIC_COUNTRY_NAMES[country_code]

    # 3. Try nativeName (for Arab countries)
    native_names = country_data.get("name", {}).get("nativeName", {})
    if "ara" in native_names:
        return native_names["ara"].get("official", native_names["ara"].get("common", ""))

    # 4. Fallback to English name
    return country_data["name"]["common"]


def seed_countries_from_api():
    """Fetch countries from REST Countries API and seed the database."""
    print("Fetching countries from REST Countries API...")
    try:
        response = requests.get(
            "https://restcountries.com/v3.1/all?fields=name,cca2,timezones,currencies,translations",
            timeout=30,
        )
        response.raise_for_status()
        countries = response.json()
    except Exception as e:
        print(f"Failed to fetch from API: {e}")
        print("Falling back to local countries.json...")
        seed_countries_from_local()
        return

    print(f"Fetched {len(countries)} countries from API")
    _seed_countries(countries, source="api")


def seed_countries_from_local():
    """Seed countries from local countries.json file (names only)."""
    import json

    json_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "..",
        "countries.json",
    )
    if not os.path.exists(json_path):
        print(f"Local countries.json not found at {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        countries = json.load(f)

    print(f"Loaded {len(countries)} countries from local file")
    _seed_countries(countries, source="local")


def _seed_countries(countries: list, source: str):
    """Insert countries into the database."""
    with Session(engine) as session:
        # Check how many already exist
        existing = session.exec(
            select(Destination).where(Destination.type == DestinationType.COUNTRY)
        ).all()
        existing_codes = {d.country_code for d in existing}

        created = 0
        skipped = 0

        for country in countries:
            name_en = country["name"]["common"]

            if source == "api":
                country_code = country.get("cca2", "")
                timezones = country.get("timezones", [])
                timezone = timezones[0] if timezones else None
                currencies = country.get("currencies", {})
                currency_code = list(currencies.keys())[0] if currencies else None
                name_ar = get_arabic_name(country, country_code)
            else:
                # Local file has no codes — skip entries without enough data
                country_code = ""
                timezone = None
                currency_code = None
                name_ar = get_arabic_name(country, "")

            if not country_code or len(country_code) != 2:
                skipped += 1
                continue

            if country_code in existing_codes:
                skipped += 1
                continue

            slug = slugify(name_en)
            if not slug:
                skipped += 1
                continue

            destination = Destination(
                type=DestinationType.COUNTRY,
                parent_id=None,
                country_code=country_code.upper(),
                slug=slug,
                full_slug=slug,
                name_en=name_en,
                name_ar=name_ar,
                timezone=timezone,
                currency_code=currency_code,
                is_active=False,
                display_order=0,
            )

            session.add(destination)
            created += 1
            existing_codes.add(country_code)

        session.commit()
        print(f"Seeded {created} countries, skipped {skipped}")
        print("All countries are inactive by default. Use admin panel to activate.")


# Major cities per country code: list of (name_en, name_ar, timezone_override, currency_override)
# timezone/currency are optional overrides; if None, inherits from country
CITIES_BY_COUNTRY = {
    "SA": [
        ("Riyadh", "الرياض", None, None),
        ("Jeddah", "جدة", None, None),
        ("Makkah", "مكة المكرمة", None, None),
        ("Madinah", "المدينة المنورة", None, None),
        ("Dammam", "الدمام", None, None),
        ("Khobar", "الخبر", None, None),
        ("Tabuk", "تبوك", None, None),
        ("Abha", "أبها", None, None),
        ("Taif", "الطائف", None, None),
        ("Yanbu", "ينبع", None, None),
        ("Al Ula", "العلا", None, None),
        ("Neom", "نيوم", None, None),
        ("Jubail", "الجبيل", None, None),
        ("Hail", "حائل", None, None),
        ("Jazan", "جازان", None, None),
    ],
    "AE": [
        ("Dubai", "دبي", "Asia/Dubai", None),
        ("Abu Dhabi", "أبوظبي", "Asia/Dubai", None),
        ("Sharjah", "الشارقة", "Asia/Dubai", None),
        ("Ajman", "عجمان", "Asia/Dubai", None),
        ("Ras Al Khaimah", "رأس الخيمة", "Asia/Dubai", None),
        ("Fujairah", "الفجيرة", "Asia/Dubai", None),
    ],
    "EG": [
        ("Cairo", "القاهرة", "Africa/Cairo", None),
        ("Alexandria", "الإسكندرية", None, None),
        ("Sharm El Sheikh", "شرم الشيخ", None, None),
        ("Hurghada", "الغردقة", None, None),
        ("Luxor", "الأقصر", None, None),
        ("Aswan", "أسوان", None, None),
    ],
    "JO": [
        ("Amman", "عمّان", "Asia/Amman", None),
        ("Aqaba", "العقبة", None, None),
        ("Petra", "البتراء", None, None),
        ("Dead Sea", "البحر الميت", None, None),
    ],
    "TR": [
        ("Istanbul", "إسطنبول", "Europe/Istanbul", None),
        ("Ankara", "أنقرة", None, None),
        ("Antalya", "أنطاليا", None, None),
        ("Izmir", "إزمير", None, None),
        ("Bodrum", "بودروم", None, None),
        ("Cappadocia", "كابادوكيا", None, None),
        ("Trabzon", "طرابزون", None, None),
        ("Bursa", "بورصة", None, None),
        ("Fethiye", "فتحية", None, None),
    ],
    "GB": [
        ("London", "لندن", "Europe/London", None),
        ("Manchester", "مانشستر", None, None),
        ("Edinburgh", "إدنبرة", None, None),
        ("Birmingham", "برمنغهام", None, None),
        ("Liverpool", "ليفربول", None, None),
        ("Oxford", "أكسفورد", None, None),
    ],
    "US": [
        ("New York", "نيويورك", "America/New_York", None),
        ("Los Angeles", "لوس أنجلوس", "America/Los_Angeles", None),
        ("Chicago", "شيكاغو", "America/Chicago", None),
        ("Miami", "ميامي", "America/New_York", None),
        ("San Francisco", "سان فرانسيسكو", "America/Los_Angeles", None),
        ("Las Vegas", "لاس فيغاس", "America/Los_Angeles", None),
        ("Washington DC", "واشنطن", "America/New_York", None),
        ("Orlando", "أورلاندو", "America/New_York", None),
        ("Houston", "هيوستن", "America/Chicago", None),
    ],
    "FR": [
        ("Paris", "باريس", "Europe/Paris", None),
        ("Nice", "نيس", None, None),
        ("Lyon", "ليون", None, None),
        ("Marseille", "مارسيليا", None, None),
    ],
    "DE": [
        ("Berlin", "برلين", "Europe/Berlin", None),
        ("Munich", "ميونخ", None, None),
        ("Frankfurt", "فرانكفورت", None, None),
        ("Hamburg", "هامبورغ", None, None),
    ],
    "IT": [
        ("Rome", "روما", "Europe/Rome", None),
        ("Milan", "ميلانو", None, None),
        ("Venice", "البندقية", None, None),
        ("Florence", "فلورنسا", None, None),
        ("Naples", "نابولي", None, None),
    ],
    "ES": [
        ("Madrid", "مدريد", "Europe/Madrid", None),
        ("Barcelona", "برشلونة", None, None),
        ("Seville", "إشبيلية", None, None),
        ("Malaga", "ملقة", None, None),
    ],
    "JP": [
        ("Tokyo", "طوكيو", "Asia/Tokyo", None),
        ("Osaka", "أوساكا", None, None),
        ("Kyoto", "كيوتو", None, None),
        ("Hiroshima", "هيروشيما", None, None),
    ],
    "CN": [
        ("Beijing", "بكين", "Asia/Shanghai", None),
        ("Shanghai", "شنغهاي", None, None),
        ("Guangzhou", "قوانغتشو", None, None),
        ("Shenzhen", "شنجن", None, None),
    ],
    "IN": [
        ("Mumbai", "مومباي", "Asia/Kolkata", None),
        ("Delhi", "دلهي", None, None),
        ("Bangalore", "بنغالور", None, None),
        ("Goa", "غوا", None, None),
    ],
    "MY": [
        ("Kuala Lumpur", "كوالالمبور", "Asia/Kuala_Lumpur", None),
        ("Penang", "بينانغ", None, None),
        ("Langkawi", "لنكاوي", None, None),
    ],
    "TH": [
        ("Bangkok", "بانكوك", "Asia/Bangkok", None),
        ("Phuket", "بوكيت", None, None),
        ("Chiang Mai", "شيانغ ماي", None, None),
        ("Pattaya", "باتايا", None, None),
    ],
    "ID": [
        ("Jakarta", "جاكرتا", "Asia/Jakarta", None),
        ("Bali", "بالي", None, None),
        ("Yogyakarta", "يوغياكارتا", None, None),
    ],
    "KR": [
        ("Seoul", "سيول", "Asia/Seoul", None),
        ("Busan", "بوسان", None, None),
        ("Jeju", "جيجو", None, None),
    ],
    "AU": [
        ("Sydney", "سيدني", "Australia/Sydney", None),
        ("Melbourne", "ملبورن", "Australia/Melbourne", None),
        ("Brisbane", "بريزبن", None, None),
        ("Perth", "بيرث", "Australia/Perth", None),
    ],
    "BR": [
        ("Sao Paulo", "ساو باولو", "America/Sao_Paulo", None),
        ("Rio de Janeiro", "ريو دي جانيرو", None, None),
    ],
    "CA": [
        ("Toronto", "تورنتو", "America/Toronto", None),
        ("Vancouver", "فانكوفر", "America/Vancouver", None),
        ("Montreal", "مونتريال", "America/Montreal", None),
    ],
    "RU": [
        ("Moscow", "موسكو", "Europe/Moscow", None),
        ("Saint Petersburg", "سانت بطرسبرغ", None, None),
    ],
    "QA": [
        ("Doha", "الدوحة", "Asia/Qatar", None),
    ],
    "KW": [
        ("Kuwait City", "مدينة الكويت", "Asia/Kuwait", None),
    ],
    "BH": [
        ("Manama", "المنامة", "Asia/Bahrain", None),
    ],
    "OM": [
        ("Muscat", "مسقط", "Asia/Muscat", None),
        ("Salalah", "صلالة", None, None),
    ],
    "LB": [
        ("Beirut", "بيروت", "Asia/Beirut", None),
    ],
    "MA": [
        ("Casablanca", "الدار البيضاء", "Africa/Casablanca", None),
        ("Marrakech", "مراكش", None, None),
        ("Fez", "فاس", None, None),
        ("Tangier", "طنجة", None, None),
    ],
    "TN": [
        ("Tunis", "تونس العاصمة", "Africa/Tunis", None),
        ("Sousse", "سوسة", None, None),
    ],
    "SG": [
        ("Singapore", "سنغافورة", "Asia/Singapore", None),
    ],
    "NZ": [
        ("Auckland", "أوكلاند", "Pacific/Auckland", None),
        ("Queenstown", "كوينزتاون", None, None),
    ],
    "GR": [
        ("Athens", "أثينا", "Europe/Athens", None),
        ("Santorini", "سانتوريني", None, None),
        ("Mykonos", "ميكونوس", None, None),
    ],
    "CH": [
        ("Zurich", "زيوريخ", "Europe/Zurich", None),
        ("Geneva", "جنيف", None, None),
        ("Interlaken", "إنترلاكن", None, None),
    ],
    "AT": [
        ("Vienna", "فيينا", "Europe/Vienna", None),
        ("Salzburg", "سالزبورغ", None, None),
    ],
    "NL": [
        ("Amsterdam", "أمستردام", "Europe/Amsterdam", None),
        ("Rotterdam", "روتردام", None, None),
    ],
    "PT": [
        ("Lisbon", "لشبونة", "Europe/Lisbon", None),
        ("Porto", "بورتو", None, None),
    ],
    "MX": [
        ("Mexico City", "مكسيكو سيتي", "America/Mexico_City", None),
        ("Cancun", "كانكون", None, None),
    ],
    "PH": [
        ("Manila", "مانيلا", "Asia/Manila", None),
        ("Cebu", "سيبو", None, None),
        ("Boracay", "بوراكاي", None, None),
    ],
    "IQ": [
        ("Baghdad", "بغداد", "Asia/Baghdad", None),
        ("Erbil", "أربيل", None, None),
        ("Najaf", "النجف", None, None),
        ("Karbala", "كربلاء", None, None),
    ],
    "PS": [
        ("Jerusalem", "القدس", "Asia/Jerusalem", None),
        ("Ramallah", "رام الله", None, None),
        ("Gaza", "غزة", None, None),
        ("Bethlehem", "بيت لحم", None, None),
        ("Nablus", "نابلس", None, None),
        ("Hebron", "الخليل", None, None),
    ],
    "SY": [
        ("Damascus", "دمشق", "Asia/Damascus", None),
        ("Aleppo", "حلب", None, None),
    ],
    "SD": [
        ("Khartoum", "الخرطوم", "Africa/Khartoum", None),
    ],
    "DZ": [
        ("Algiers", "الجزائر العاصمة", "Africa/Algiers", None),
        ("Oran", "وهران", None, None),
    ],
    "LY": [
        ("Tripoli", "طرابلس", "Africa/Tripoli", None),
        ("Benghazi", "بنغازي", None, None),
    ],
    "YE": [
        ("Sanaa", "صنعاء", "Asia/Aden", None),
        ("Aden", "عدن", None, None),
    ],
    "PK": [
        ("Islamabad", "إسلام آباد", "Asia/Karachi", None),
        ("Lahore", "لاهور", None, None),
        ("Karachi", "كراتشي", None, None),
    ],
    "BD": [
        ("Dhaka", "دكا", "Asia/Dhaka", None),
    ],
    "MV": [
        ("Male", "ماليه", "Indian/Maldives", None),
    ],
    "LK": [
        ("Colombo", "كولومبو", "Asia/Colombo", None),
    ],
    "GE": [
        ("Tbilisi", "تبليسي", "Asia/Tbilisi", None),
        ("Batumi", "باتومي", None, None),
    ],
    "AZ": [
        ("Baku", "باكو", "Asia/Baku", None),
    ],
    "KE": [
        ("Nairobi", "نيروبي", "Africa/Nairobi", None),
        ("Mombasa", "ممباسا", None, None),
    ],
    "ZA": [
        ("Cape Town", "كيب تاون", "Africa/Johannesburg", None),
        ("Johannesburg", "جوهانسبرغ", None, None),
    ],
    "TZ": [
        ("Dar es Salaam", "دار السلام", "Africa/Dar_es_Salaam", None),
        ("Zanzibar", "زنجبار", None, None),
    ],
    "SE": [
        ("Stockholm", "ستوكهولم", "Europe/Stockholm", None),
    ],
    "NO": [
        ("Oslo", "أوسلو", "Europe/Oslo", None),
    ],
    "DK": [
        ("Copenhagen", "كوبنهاغن", "Europe/Copenhagen", None),
    ],
    "FI": [
        ("Helsinki", "هلسنكي", "Europe/Helsinki", None),
    ],
    "PL": [
        ("Warsaw", "وارسو", "Europe/Warsaw", None),
        ("Krakow", "كراكوف", None, None),
    ],
    "CZ": [
        ("Prague", "براغ", "Europe/Prague", None),
    ],
    "HU": [
        ("Budapest", "بودابست", "Europe/Budapest", None),
    ],
    "HR": [
        ("Zagreb", "زغرب", "Europe/Zagreb", None),
        ("Dubrovnik", "دوبروفنيك", None, None),
        ("Split", "سبليت", None, None),
    ],
    "BA": [
        ("Sarajevo", "سراييفو", "Europe/Sarajevo", None),
        ("Mostar", "موستار", None, None),
    ],
    "RS": [
        ("Belgrade", "بلغراد", "Europe/Belgrade", None),
    ],
    "ME": [
        ("Podgorica", "بودغوريتسا", "Europe/Podgorica", None),
    ],
    "AL": [
        ("Tirana", "تيرانا", "Europe/Tirane", None),
    ],
}


def seed_cities():
    """Seed major cities into existing countries."""
    print("Seeding cities...")

    with Session(engine) as session:
        # Get all countries
        countries = session.exec(
            select(Destination).where(Destination.type == DestinationType.COUNTRY)
        ).all()
        country_map = {c.country_code: c for c in countries}

        # Get existing cities to avoid duplicates
        existing_cities = session.exec(
            select(Destination).where(Destination.type == DestinationType.CITY)
        ).all()
        existing_slugs = {(c.parent_id, c.slug) for c in existing_cities}

        created = 0
        skipped = 0

        for country_code, cities in CITIES_BY_COUNTRY.items():
            country = country_map.get(country_code)
            if not country:
                print(f"  Country {country_code} not found, skipping its cities")
                skipped += len(cities)
                continue

            for name_en, name_ar, tz_override, cur_override in cities:
                city_slug = slugify(name_en)
                if (country.id, city_slug) in existing_slugs:
                    skipped += 1
                    continue

                city = Destination(
                    type=DestinationType.CITY,
                    parent_id=country.id,
                    country_code=country_code,
                    slug=city_slug,
                    full_slug=f"{country.slug}/{city_slug}",
                    name_en=name_en,
                    name_ar=name_ar,
                    timezone=tz_override or country.timezone,
                    currency_code=cur_override or country.currency_code,
                    is_active=country.is_active,  # Inherit active status from country
                    display_order=0,
                )
                session.add(city)
                created += 1
                existing_slugs.add((country.id, city_slug))

        session.commit()
        print(f"Seeded {created} cities, skipped {skipped}")


if __name__ == "__main__":
    seed_countries_from_api()
    seed_cities()
