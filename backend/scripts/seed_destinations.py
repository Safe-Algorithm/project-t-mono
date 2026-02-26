"""
Seed worldwide destinations (countries + cities) into the database.

All data is fully offline — no external API calls.
- Countries: loaded from scripts/countries_data.json (snapshotted 2026-02-26).
- Cities: hardcoded in CITIES_BY_COUNTRY below.

To add a country or city: edit the source data and open a PR.

Usage (standalone):
    docker compose exec backend python -m scripts.seed_destinations

Called automatically from app/initial_data.py on startup.
"""

import json
import re
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select

from app.models.destination import Destination, DestinationType

_COUNTRIES_JSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "countries_data.json")


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_]+', '-', text)
    text = re.sub(r'-+', '-', text)
    return text.strip('-')


def seed_countries(session: Session) -> None:
    """Seed countries from the local countries_data.json snapshot (fully offline)."""
    with open(_COUNTRIES_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    existing = session.exec(
        select(Destination).where(Destination.type == DestinationType.COUNTRY)
    ).all()
    existing_codes = {d.country_code for d in existing}

    created = 0
    for c in data:
        code = c["code"]
        if code in existing_codes:
            continue
        slug = c["slug"] or slugify(c["name_en"])
        if not slug:
            continue
        destination = Destination(
            type=DestinationType.COUNTRY,
            parent_id=None,
            country_code=code,
            slug=slug,
            full_slug=slug,
            name_en=c["name_en"],
            name_ar=c["name_ar"],
            timezone=c.get("tz"),
            currency_code=c.get("cur"),
            is_active=False,
            display_order=0,
        )
        session.add(destination)
        existing_codes.add(code)
        created += 1

    session.commit()
    print(f"Countries: seeded {created} new, {len(existing_codes) - created} already existed.")


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


def seed_cities(session: Session) -> None:
    """Seed major cities into existing countries."""
    countries = session.exec(
        select(Destination).where(Destination.type == DestinationType.COUNTRY)
    ).all()
    country_map = {c.country_code: c for c in countries}

    existing_cities = session.exec(
        select(Destination).where(Destination.type == DestinationType.CITY)
    ).all()
    existing_slugs = {(c.parent_id, c.slug) for c in existing_cities}

    created = 0
    skipped = 0

    for country_code, cities in CITIES_BY_COUNTRY.items():
        country = country_map.get(country_code)
        if not country:
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
                is_active=country.is_active,
                display_order=0,
            )
            session.add(city)
            created += 1
            existing_slugs.add((country.id, city_slug))

    session.commit()
    print(f"Cities: seeded {created} new, skipped {skipped} already existing.")


def seed_destinations(session: Session) -> None:
    """Seed countries then cities. Called from initial_data.py on startup."""
    seed_countries(session)
    seed_cities(session)


if __name__ == "__main__":
    with Session(engine) as session:
        seed_destinations(session)
