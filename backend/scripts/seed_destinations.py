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
    existing_by_code = {d.country_code: d for d in existing}

    created = 0
    updated = 0
    for c in data:
        code = c["code"]
        if code in existing_by_code:
            dest = existing_by_code[code]
            if dest.name_ar != c["name_ar"] or dest.name_en != c["name_en"]:
                dest.name_ar = c["name_ar"]
                dest.name_en = c["name_en"]
                session.add(dest)
                updated += 1
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
        existing_by_code[code] = destination
        created += 1

    session.commit()
    print(f"Countries: seeded {created} new, {updated} updated, {len(existing_by_code) - created} already up-to-date.")


# Major cities per country code: list of (name_en, name_ar, timezone_override, currency_override)
# timezone/currency are optional overrides; if None, inherits from country
CITIES_BY_COUNTRY = {
    "SA": [
        ("Riyadh", "الرياض", "Asia/Riyadh", None),
        ("Jeddah", "جدة", "Asia/Riyadh", None),
        ("Makkah", "مكة المكرمة", "Asia/Riyadh", None),
        ("Madinah", "المدينة المنورة", "Asia/Riyadh", None),
        ("Dammam", "الدمام", "Asia/Riyadh", None),
        ("Khobar", "الخبر", "Asia/Riyadh", None),
        ("Tabuk", "تبوك", "Asia/Riyadh", None),
        ("Abha", "أبها", "Asia/Riyadh", None),
        ("Taif", "الطائف", "Asia/Riyadh", None),
        ("Yanbu", "ينبع", "Asia/Riyadh", None),
        ("Al Ula", "العلا", "Asia/Riyadh", None),
        ("Neom", "نيوم", "Asia/Riyadh", None),
        ("Jubail", "الجبيل", "Asia/Riyadh", None),
        ("Hail", "حائل", "Asia/Riyadh", None),
        ("Jazan", "جازان", "Asia/Riyadh", None),
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
        ("Alexandria", "الإسكندرية", "Africa/Cairo", None),
        ("Sharm El Sheikh", "شرم الشيخ", "Africa/Cairo", None),
        ("Hurghada", "الغردقة", "Africa/Cairo", None),
        ("Luxor", "الأقصر", "Africa/Cairo", None),
        ("Aswan", "أسوان", "Africa/Cairo", None),
    ],
    "JO": [
        ("Amman", "عمّان", "Asia/Amman", None),
        ("Aqaba", "العقبة", "Asia/Amman", None),
        ("Petra", "البتراء", "Asia/Amman", None),
        ("Dead Sea", "البحر الميت", "Asia/Amman", None),
    ],
    "TR": [
        ("Istanbul", "إسطنبول", "Europe/Istanbul", None),
        ("Ankara", "أنقرة", "Europe/Istanbul", None),
        ("Antalya", "أنطاليا", "Europe/Istanbul", None),
        ("Izmir", "إزمير", "Europe/Istanbul", None),
        ("Bodrum", "بودروم", "Europe/Istanbul", None),
        ("Cappadocia", "كابادوكيا", "Europe/Istanbul", None),
        ("Trabzon", "طرابزون", "Europe/Istanbul", None),
        ("Bursa", "بورصة", "Europe/Istanbul", None),
        ("Fethiye", "فتحية", "Europe/Istanbul", None),
    ],
    "GB": [
        ("London", "لندن", "Europe/London", None),
        ("Manchester", "مانشستر", "Europe/London", None),
        ("Edinburgh", "إدنبرة", "Europe/London", None),
        ("Birmingham", "برمنغهام", "Europe/London", None),
        ("Liverpool", "ليفربول", "Europe/London", None),
        ("Oxford", "أكسفورد", "Europe/London", None),
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
        ("Nice", "نيس", "Europe/Paris", None),
        ("Lyon", "ليون", "Europe/Paris", None),
        ("Marseille", "مارسيليا", "Europe/Paris", None),
    ],
    "DE": [
        ("Berlin", "برلين", "Europe/Berlin", None),
        ("Munich", "ميونخ", "Europe/Berlin", None),
        ("Frankfurt", "فرانكفورت", "Europe/Berlin", None),
        ("Hamburg", "هامبورغ", "Europe/Berlin", None),
    ],
    "IT": [
        ("Rome", "روما", "Europe/Rome", None),
        ("Milan", "ميلانو", "Europe/Rome", None),
        ("Venice", "البندقية", "Europe/Rome", None),
        ("Florence", "فلورنسا", "Europe/Rome", None),
        ("Naples", "نابولي", "Europe/Rome", None),
    ],
    "ES": [
        ("Madrid", "مدريد", "Europe/Madrid", None),
        ("Barcelona", "برشلونة", "Europe/Madrid", None),
        ("Seville", "إشبيلية", "Europe/Madrid", None),
        ("Malaga", "ملقة", "Europe/Madrid", None),
    ],
    "JP": [
        ("Tokyo", "طوكيو", "Asia/Tokyo", None),
        ("Osaka", "أوساكا", "Asia/Tokyo", None),
        ("Kyoto", "كيوتو", "Asia/Tokyo", None),
        ("Hiroshima", "هيروشيما", "Asia/Tokyo", None),
    ],
    "CN": [
        ("Beijing", "بكين", "Asia/Shanghai", None),
        ("Shanghai", "شنغهاي", "Asia/Shanghai", None),
        ("Guangzhou", "قوانغتشو", "Asia/Shanghai", None),
        ("Shenzhen", "شنجن", "Asia/Shanghai", None),
    ],
    "IN": [
        ("Mumbai", "مومباي", "Asia/Kolkata", None),
        ("Delhi", "دلهي", "Asia/Kolkata", None),
        ("Bangalore", "بنغالور", "Asia/Kolkata", None),
        ("Goa", "غوا", "Asia/Kolkata", None),
    ],
    "MY": [
        ("Kuala Lumpur", "كوالالمبور", "Asia/Kuala_Lumpur", None),
        ("Penang", "بينانغ", "Asia/Kuala_Lumpur", None),
        ("Langkawi", "لنكاوي", "Asia/Kuala_Lumpur", None),
    ],
    "TH": [
        ("Bangkok", "بانكوك", "Asia/Bangkok", None),
        ("Phuket", "بوكيت", "Asia/Bangkok", None),
        ("Chiang Mai", "شيانغ ماي", "Asia/Bangkok", None),
        ("Pattaya", "باتايا", "Asia/Bangkok", None),
    ],
    "ID": [
        ("Jakarta", "جاكرتا", "Asia/Jakarta", None),
        ("Bali", "بالي", "Asia/Makassar", None),
        ("Yogyakarta", "يوغياكارتا", "Asia/Jakarta", None),
    ],
    "KR": [
        ("Seoul", "سيول", "Asia/Seoul", None),
        ("Busan", "بوسان", "Asia/Seoul", None),
        ("Jeju", "جيجو", "Asia/Seoul", None),
    ],
    "AU": [
        ("Sydney", "سيدني", "Australia/Sydney", None),
        ("Melbourne", "ملبورن", "Australia/Melbourne", None),
        ("Brisbane", "بريزبن", "Australia/Brisbane", None),
        ("Perth", "بيرث", "Australia/Perth", None),
    ],
    "BR": [
        ("Sao Paulo", "ساو باولو", "America/Sao_Paulo", None),
        ("Rio de Janeiro", "ريو دي جانيرو", "America/Sao_Paulo", None),
    ],
    "CA": [
        ("Toronto", "تورنتو", "America/Toronto", None),
        ("Vancouver", "فانكوفر", "America/Vancouver", None),
        ("Montreal", "مونتريال", "America/Montreal", None),
    ],
    "RU": [
        ("Moscow", "موسكو", "Europe/Moscow", None),
        ("Saint Petersburg", "سانت بطرسبرغ", "Europe/Moscow", None),
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
        ("Salalah", "صلالة", "Asia/Muscat", None),
    ],
    "LB": [
        ("Beirut", "بيروت", "Asia/Beirut", None),
    ],
    "MA": [
        ("Casablanca", "الدار البيضاء", "Africa/Casablanca", None),
        ("Marrakech", "مراكش", "Africa/Casablanca", None),
        ("Fez", "فاس", "Africa/Casablanca", None),
        ("Tangier", "طنجة", "Africa/Casablanca", None),
    ],
    "TN": [
        ("Tunis", "تونس العاصمة", "Africa/Tunis", None),
        ("Sousse", "سوسة", "Africa/Tunis", None),
    ],
    "SG": [
        ("Singapore", "سنغافورة", "Asia/Singapore", None),
    ],
    "NZ": [
        ("Auckland", "أوكلاند", "Pacific/Auckland", None),
        ("Queenstown", "كوينزتاون", "Pacific/Auckland", None),
    ],
    "GR": [
        ("Athens", "أثينا", "Europe/Athens", None),
        ("Santorini", "سانتوريني", "Europe/Athens", None),
        ("Mykonos", "ميكونوس", "Europe/Athens", None),
    ],
    "CH": [
        ("Zurich", "زيوريخ", "Europe/Zurich", None),
        ("Geneva", "جنيف", "Europe/Zurich", None),
        ("Interlaken", "إنترلاكن", "Europe/Zurich", None),
    ],
    "AT": [
        ("Vienna", "فيينا", "Europe/Vienna", None),
        ("Salzburg", "سالزبورغ", "Europe/Vienna", None),
    ],
    "NL": [
        ("Amsterdam", "أمستردام", "Europe/Amsterdam", None),
        ("Rotterdam", "روتردام", "Europe/Amsterdam", None),
    ],
    "PT": [
        ("Lisbon", "لشبونة", "Europe/Lisbon", None),
        ("Porto", "بورتو", "Europe/Lisbon", None),
    ],
    "MX": [
        ("Mexico City", "مكسيكو سيتي", "America/Mexico_City", None),
        ("Cancun", "كانكون", "America/Cancun", None),
    ],
    "PH": [
        ("Manila", "مانيلا", "Asia/Manila", None),
        ("Cebu", "سيبو", "Asia/Manila", None),
        ("Boracay", "بوراكاي", "Asia/Manila", None),
    ],
    "IQ": [
        ("Baghdad", "بغداد", "Asia/Baghdad", None),
        ("Erbil", "أربيل", "Asia/Baghdad", None),
        ("Najaf", "النجف", "Asia/Baghdad", None),
        ("Karbala", "كربلاء", "Asia/Baghdad", None),
    ],
    "PS": [
        ("Jerusalem", "القدس", "Asia/Jerusalem", None),
        ("Ramallah", "رام الله", "Asia/Gaza", None),
        ("Gaza", "غزة", "Asia/Gaza", None),
        ("Bethlehem", "بيت لحم", "Asia/Hebron", None),
        ("Nablus", "نابلس", "Asia/Hebron", None),
        ("Hebron", "الخليل", "Asia/Hebron", None),
    ],
    "SY": [
        ("Damascus", "دمشق", "Asia/Damascus", None),
        ("Aleppo", "حلب", "Asia/Damascus", None),
    ],
    "SD": [
        ("Khartoum", "الخرطوم", "Africa/Khartoum", None),
    ],
    "DZ": [
        ("Algiers", "الجزائر العاصمة", "Africa/Algiers", None),
        ("Oran", "وهران", "Africa/Algiers", None),
    ],
    "LY": [
        ("Tripoli", "طرابلس", "Africa/Tripoli", None),
        ("Benghazi", "بنغازي", "Africa/Tripoli", None),
    ],
    "YE": [
        ("Sanaa", "صنعاء", "Asia/Aden", None),
        ("Aden", "عدن", "Asia/Aden", None),
    ],
    "PK": [
        ("Islamabad", "إسلام آباد", "Asia/Karachi", None),
        ("Lahore", "لاهور", "Asia/Karachi", None),
        ("Karachi", "كراتشي", "Asia/Karachi", None),
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
        ("Batumi", "باتومي", "Asia/Tbilisi", None),
    ],
    "AZ": [
        ("Baku", "باكو", "Asia/Baku", None),
    ],
    "KE": [
        ("Nairobi", "نيروبي", "Africa/Nairobi", None),
        ("Mombasa", "ممباسا", "Africa/Nairobi", None),
    ],
    "ZA": [
        ("Cape Town", "كيب تاون", "Africa/Johannesburg", None),
        ("Johannesburg", "جوهانسبرغ", "Africa/Johannesburg", None),
    ],
    "TZ": [
        ("Dar es Salaam", "دار السلام", "Africa/Dar_es_Salaam", None),
        ("Zanzibar", "زنجبار", "Africa/Dar_es_Salaam", None),
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
        ("Krakow", "كراكوف", "Europe/Warsaw", None),
    ],
    "CZ": [
        ("Prague", "براغ", "Europe/Prague", None),
    ],
    "HU": [
        ("Budapest", "بودابست", "Europe/Budapest", None),
    ],
    "HR": [
        ("Zagreb", "زغرب", "Europe/Zagreb", None),
        ("Dubrovnik", "دوبروفنيك", "Europe/Zagreb", None),
        ("Split", "سبليت", "Europe/Zagreb", None),
    ],
    "BA": [
        ("Sarajevo", "سراييفو", "Europe/Sarajevo", None),
        ("Mostar", "موستار", "Europe/Sarajevo", None),
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
    from app.core.db import engine
    with Session(engine) as session:
        seed_destinations(session)
