import { PricingTier, TripPackage, Trip } from '../types/trip';

/**
 * Compute the total price for a given package and participant count.
 * - If use_flexible_pricing is true and pricing_tiers are provided, applies
 *   marginal (band-based) pricing: participants in each band pay that band's rate.
 * - Otherwise falls back to flat price * count.
 */
export function computePackagePrice(pkg: TripPackage, count: number): number {
  if (!pkg.use_flexible_pricing || !pkg.pricing_tiers || pkg.pricing_tiers.length === 0) {
    return Number(pkg.price) * count;
  }

  const tiers = [...pkg.pricing_tiers].sort(
    (a, b) => a.from_participant - b.from_participant
  );

  let total = 0;
  for (let i = 0; i < tiers.length; i++) {
    const tierStart = tiers[i].from_participant;
    const tierEnd = tiers[i + 1] ? tiers[i + 1].from_participant - 1 : Infinity;
    const rate = Number(tiers[i].price_per_person);

    if (count < tierStart) break;

    const participantsInBand = Math.min(count, tierEnd === Infinity ? count : tierEnd) - tierStart + 1;
    total += participantsInBand * rate;
  }

  return total;
}

/**
 * Compute the effective per-person price for display purposes.
 * Returns the price for exactly `count` participants, divided by count.
 * For flat pricing this equals the package price.
 */
export function effectivePricePerPerson(pkg: TripPackage, count: number): number {
  if (count <= 0) return Number(pkg.price);
  return computePackagePrice(pkg, count) / count;
}

/**
 * Get the minimum possible per-person price (first tier or flat price).
 * Used for "From SAR X" display when count is unknown.
 */
export function minPricePerPerson(pkg: TripPackage): number {
  if (!pkg.use_flexible_pricing || !pkg.pricing_tiers || pkg.pricing_tiers.length === 0) {
    return Number(pkg.price);
  }
  const sorted = [...pkg.pricing_tiers].sort((a, b) => a.from_participant - b.from_participant);
  return Number(sorted[0].price_per_person);
}

/**
 * Get the maximum possible per-person price (last tier or flat price).
 */
export function maxPricePerPerson(pkg: TripPackage): number {
  if (!pkg.use_flexible_pricing || !pkg.pricing_tiers || pkg.pricing_tiers.length === 0) {
    return Number(pkg.price);
  }
  const sorted = [...pkg.pricing_tiers].sort((a, b) => a.from_participant - b.from_participant);
  return Number(sorted[sorted.length - 1].price_per_person);
}

/**
 * Returns true if any package in a packaged trip uses flexible pricing.
 */
export function tripHasFlexiblePricing(trip: Trip): boolean {
  if (trip.is_packaged_trip) {
    return trip.packages.some(pkg => pkg.use_flexible_pricing);
  }
  return trip.simple_trip_use_flexible_pricing ?? false;
}

/**
 * Format a price for display, e.g. "SAR 250" or "250.00".
 */
export function formatPrice(amount: number, currency = 'SAR'): string {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/**
 * Build a human-readable summary of pricing tiers for display.
 * e.g. ["1–4 pax: SAR 300/person", "5+ pax: SAR 250/person"]
 */
export function buildTierSummary(tiers: PricingTier[], currency = 'SAR'): string[] {
  const sorted = [...tiers].sort((a, b) => a.from_participant - b.from_participant);
  return sorted.map((tier, idx) => {
    const next = sorted[idx + 1];
    const rangeLabel = next
      ? `${tier.from_participant}–${next.from_participant - 1} pax`
      : `${tier.from_participant}+ pax`;
    return `${rangeLabel}: ${currency} ${Number(tier.price_per_person).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}/person`;
  });
}

/**
 * Build a waterfall billing breakdown for a specific participant count.
 * Shows exactly how many participants fell in each band and what they were charged.
 * e.g. for count=4 with tiers [{from:1,rate:5000},{from:4,rate:1000}]:
 *   ["pax 1–3: 3 × SAR 5,000 = SAR 15,000", "pax 4: 1 × SAR 1,000 = SAR 1,000"]
 * Only returns lines for bands that actually have participants.
 */
export function buildTierBillingBreakdown(tiers: PricingTier[], count: number, currency = 'SAR'): string[] {
  if (count <= 0 || !tiers || tiers.length === 0) return [];
  const sorted = [...tiers].sort((a, b) => a.from_participant - b.from_participant);
  const lines: string[] = [];
  let remaining = count;

  for (let i = 0; i < sorted.length; i++) {
    if (remaining <= 0) break;
    const tierStart = sorted[i].from_participant;
    const tierEnd = sorted[i + 1] ? sorted[i + 1].from_participant - 1 : Infinity;
    const rate = Number(sorted[i].price_per_person);

    if (count < tierStart) break;

    const inBand = tierEnd === Infinity ? remaining : Math.min(remaining, tierEnd - tierStart + 1);
    const bandTotal = inBand * rate;
    const bandFrom = tierStart;
    const bandTo = tierStart + inBand - 1;
    const rangeLabel = inBand === 1 ? `pax ${bandFrom}` : `pax ${bandFrom}–${bandTo}`;
    lines.push(
      `${rangeLabel}: ${inBand} × ${currency} ${rate.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} = ${currency} ${bandTotal.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
    );
    remaining -= inBand;
  }

  return lines;
}
