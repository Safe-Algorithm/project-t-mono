import {
  computePackagePrice,
  effectivePricePerPerson,
  minPricePerPerson,
  maxPricePerPerson,
  tripHasFlexiblePricing,
  formatPrice,
  buildTierSummary,
  buildTierBillingBreakdown,
} from '../../lib/pricingUtils';
import { TripPackage, PricingTier, Trip } from '../../types/trip';

// ─── helpers ────────────────────────────────────────────────────────────────

function makeFlatPkg(price: number): TripPackage {
  return {
    id: 'p1', trip_id: 't1',
    name_en: 'Flat', name_ar: null,
    description_en: null, description_ar: null,
    price, currency: 'SAR', is_active: true,
    required_fields: [],
    use_flexible_pricing: false,
    pricing_tiers: [],
  };
}

function makeFlexPkg(tiers: PricingTier[]): TripPackage {
  return {
    id: 'p2', trip_id: 't1',
    name_en: 'Flex', name_ar: null,
    description_en: null, description_ar: null,
    price: 0, currency: 'SAR', is_active: true,
    required_fields: [],
    use_flexible_pricing: true,
    pricing_tiers: tiers,
  };
}

const TIERS_TWO: PricingTier[] = [
  { from_participant: 1, price_per_person: 300 },
  { from_participant: 5, price_per_person: 250 },
];

const TIERS_THREE: PricingTier[] = [
  { from_participant: 1, price_per_person: 500 },
  { from_participant: 4, price_per_person: 300 },
  { from_participant: 6, price_per_person: 100 },
];

// ─── computePackagePrice ─────────────────────────────────────────────────────

describe('computePackagePrice', () => {
  describe('flat pricing', () => {
    it('returns price × count', () => {
      expect(computePackagePrice(makeFlatPkg(100), 3)).toBe(300);
    });

    it('handles count = 1', () => {
      expect(computePackagePrice(makeFlatPkg(150), 1)).toBe(150);
    });

    it('falls back to flat when use_flexible_pricing is false even if tiers present', () => {
      const pkg = { ...makeFlexPkg(TIERS_TWO), use_flexible_pricing: false };
      expect(computePackagePrice(pkg, 6)).toBe(0); // price is 0, flat × 6 = 0
    });

    it('falls back to flat when pricing_tiers is empty', () => {
      const pkg = { ...makeFlexPkg([]), price: 200 };
      expect(computePackagePrice(pkg, 3)).toBe(600);
    });
  });

  describe('flexible pricing — two tiers', () => {
    // tier 1: 1–4 pax @ 300, tier 2: 5+ pax @ 250
    const pkg = () => makeFlexPkg(TIERS_TWO);

    it('all participants within first band', () => {
      // 4 × 300 = 1200
      expect(computePackagePrice(pkg(), 4)).toBe(1200);
    });

    it('exactly at band boundary', () => {
      // 4 × 300 + 1 × 250 = 1450
      expect(computePackagePrice(pkg(), 5)).toBe(1450);
    });

    it('spans both bands', () => {
      // 4 × 300 + 3 × 250 = 1200 + 750 = 1950
      expect(computePackagePrice(pkg(), 7)).toBe(1950);
    });

    it('count = 1', () => {
      expect(computePackagePrice(pkg(), 1)).toBe(300);
    });
  });

  describe('flexible pricing — three tiers', () => {
    // 1–3 @ 500, 4–5 @ 300, 6+ @ 100
    const pkg = () => makeFlexPkg(TIERS_THREE);

    it('within first band only', () => {
      // 3 × 500 = 1500
      expect(computePackagePrice(pkg(), 3)).toBe(1500);
    });

    it('spans first and second band', () => {
      // 3 × 500 + 2 × 300 = 1500 + 600 = 2100
      expect(computePackagePrice(pkg(), 5)).toBe(2100);
    });

    it('spans all three bands', () => {
      // 3 × 500 + 2 × 300 + 2 × 100 = 1500 + 600 + 200 = 2300
      expect(computePackagePrice(pkg(), 7)).toBe(2300);
    });

    it('unsorted tiers are handled correctly', () => {
      // Same tiers in reversed order — must still sort internally
      const reversed = [...TIERS_THREE].reverse();
      const pkg2 = makeFlexPkg(reversed);
      expect(computePackagePrice(pkg2, 7)).toBe(2300);
    });
  });
});

// ─── effectivePricePerPerson ─────────────────────────────────────────────────

describe('effectivePricePerPerson', () => {
  it('equals flat price for flat packages', () => {
    expect(effectivePricePerPerson(makeFlatPkg(200), 5)).toBe(200);
  });

  it('returns package.price when count <= 0', () => {
    expect(effectivePricePerPerson(makeFlatPkg(200), 0)).toBe(200);
  });

  it('computes average per-person cost for flexible pricing', () => {
    // 7 people → 2300 total (from three-tier test above) → 2300/7 ≈ 328.57
    const pkg = makeFlexPkg(TIERS_THREE);
    expect(effectivePricePerPerson(pkg, 7)).toBeCloseTo(2300 / 7, 5);
  });
});

// ─── minPricePerPerson ───────────────────────────────────────────────────────

describe('minPricePerPerson', () => {
  it('returns flat price for flat packages', () => {
    expect(minPricePerPerson(makeFlatPkg(150))).toBe(150);
  });

  it('returns the rate of the FIRST (lowest from_participant) tier', () => {
    // First tier is 300 (from_participant=1)
    expect(minPricePerPerson(makeFlexPkg(TIERS_TWO))).toBe(300);
  });

  it('handles unsorted tiers (picks lowest from_participant)', () => {
    const reversed = [...TIERS_TWO].reverse();
    expect(minPricePerPerson(makeFlexPkg(reversed))).toBe(300);
  });
});

// ─── maxPricePerPerson ───────────────────────────────────────────────────────

describe('maxPricePerPerson', () => {
  it('returns flat price for flat packages', () => {
    expect(maxPricePerPerson(makeFlatPkg(150))).toBe(150);
  });

  it('returns the rate of the LAST tier (highest from_participant)', () => {
    // Last tier is 250 (from_participant=5)
    expect(maxPricePerPerson(makeFlexPkg(TIERS_TWO))).toBe(250);
  });

  it('min equals max for single-tier flexible pricing', () => {
    const single: PricingTier[] = [{ from_participant: 1, price_per_person: 400 }];
    const pkg = makeFlexPkg(single);
    expect(minPricePerPerson(pkg)).toBe(maxPricePerPerson(pkg));
  });
});

// ─── tripHasFlexiblePricing ──────────────────────────────────────────────────

describe('tripHasFlexiblePricing', () => {
  const basePkg = makeFlatPkg(100);

  it('returns false for packaged trip with only flat packages', () => {
    const trip = { is_packaged_trip: true, packages: [basePkg], simple_trip_use_flexible_pricing: false } as unknown as Trip;
    expect(tripHasFlexiblePricing(trip)).toBe(false);
  });

  it('returns true when any package in a packaged trip uses flexible pricing', () => {
    const flexPkg = makeFlexPkg(TIERS_TWO);
    const trip = { is_packaged_trip: true, packages: [basePkg, flexPkg], simple_trip_use_flexible_pricing: false } as unknown as Trip;
    expect(tripHasFlexiblePricing(trip)).toBe(true);
  });

  it('returns false for simple trip without flexible pricing', () => {
    const trip = { is_packaged_trip: false, packages: [], simple_trip_use_flexible_pricing: false } as unknown as Trip;
    expect(tripHasFlexiblePricing(trip)).toBe(false);
  });

  it('returns true for simple trip with flexible pricing enabled', () => {
    const trip = { is_packaged_trip: false, packages: [], simple_trip_use_flexible_pricing: true } as unknown as Trip;
    expect(tripHasFlexiblePricing(trip)).toBe(true);
  });

  it('returns false when simple_trip_use_flexible_pricing is undefined', () => {
    const trip = { is_packaged_trip: false, packages: [] } as unknown as Trip;
    expect(tripHasFlexiblePricing(trip)).toBe(false);
  });
});

// ─── formatPrice ─────────────────────────────────────────────────────────────

describe('formatPrice', () => {
  it('formats integer amounts', () => {
    expect(formatPrice(300)).toBe('SAR 300');
  });

  it('formats fractional amounts (strips trailing zeros)', () => {
    expect(formatPrice(299.5)).toBe('SAR 299.5');
  });

  it('rounds to 2 decimal places', () => {
    expect(formatPrice(100.999)).toBe('SAR 101');
  });

  it('accepts custom currency', () => {
    expect(formatPrice(100, 'USD')).toBe('USD 100');
  });
});

// ─── buildTierSummary ────────────────────────────────────────────────────────

describe('buildTierSummary', () => {
  it('generates one line per tier', () => {
    const lines = buildTierSummary(TIERS_TWO);
    expect(lines).toHaveLength(2);
  });

  it('formats range for non-last tiers', () => {
    const lines = buildTierSummary(TIERS_TWO);
    // tier 1: 1–4 pax
    expect(lines[0]).toBe('1–4 pax: SAR 300/person');
  });

  it('formats open-ended last tier with + suffix', () => {
    const lines = buildTierSummary(TIERS_TWO);
    expect(lines[1]).toBe('5+ pax: SAR 250/person');
  });

  it('works for three-tier config', () => {
    const lines = buildTierSummary(TIERS_THREE);
    expect(lines[0]).toBe('1–3 pax: SAR 500/person');
    expect(lines[1]).toBe('4–5 pax: SAR 300/person');
    expect(lines[2]).toBe('6+ pax: SAR 100/person');
  });

  it('handles single tier as open-ended', () => {
    const single: PricingTier[] = [{ from_participant: 1, price_per_person: 200 }];
    const lines = buildTierSummary(single);
    expect(lines[0]).toBe('1+ pax: SAR 200/person');
  });

  it('sorts tiers before formatting (unsorted input)', () => {
    const reversed = [...TIERS_TWO].reverse();
    const lines = buildTierSummary(reversed);
    expect(lines[0]).toContain('1–4 pax');
    expect(lines[1]).toContain('5+');
  });

  it('accepts custom currency', () => {
    const single: PricingTier[] = [{ from_participant: 1, price_per_person: 100 }];
    const lines = buildTierSummary(single, 'USD');
    expect(lines[0]).toContain('USD');
  });
});

describe('buildTierBillingBreakdown', () => {
  // User's Tier A: [{from:1, rate:5000}, {from:4, rate:1000}], 4 people
  // Expected: pax 1-3: 3×5000=15000, pax 4: 1×1000=1000
  const TIER_A: PricingTier[] = [
    { from_participant: 1, price_per_person: 5000 },
    { from_participant: 4, price_per_person: 1000 },
  ];

  // User's Tier B: [{from:1, rate:3000}, {from:2, rate:2000}], 5 people
  // Expected: pax 1: 1×3000=3000, pax 2-5: 4×2000=8000
  const TIER_B: PricingTier[] = [
    { from_participant: 1, price_per_person: 3000 },
    { from_participant: 2, price_per_person: 2000 },
  ];

  it('Tier A with 4 people: 3×5000 + 1×1000 = 16000', () => {
    const lines = buildTierBillingBreakdown(TIER_A, 4);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('pax 1–3');
    expect(lines[0]).toContain('3 × SAR 5,000');
    expect(lines[0]).toContain('SAR 15,000');
    expect(lines[1]).toContain('pax 4');
    expect(lines[1]).toContain('1 × SAR 1,000');
    expect(lines[1]).toContain('SAR 1,000');
  });

  it('Tier B with 5 people: 1×3000 + 4×2000 = 11000', () => {
    const lines = buildTierBillingBreakdown(TIER_B, 5);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain('pax 1');
    expect(lines[0]).toContain('1 × SAR 3,000');
    expect(lines[0]).toContain('SAR 3,000');
    expect(lines[1]).toContain('pax 2–5');
    expect(lines[1]).toContain('4 × SAR 2,000');
    expect(lines[1]).toContain('SAR 8,000');
  });

  it('combined Tier A (4 pax) + Tier B (5 pax) totals 27000', () => {
    const pkgA = { use_flexible_pricing: true, pricing_tiers: TIER_A, price: 0 } as unknown as import('../../types/trip').TripPackage;
    const pkgB = { use_flexible_pricing: true, pricing_tiers: TIER_B, price: 0 } as unknown as import('../../types/trip').TripPackage;
    expect(computePackagePrice(pkgA, 4) + computePackagePrice(pkgB, 5)).toBe(27000);
  });

  it('returns empty array for count=0', () => {
    expect(buildTierBillingBreakdown(TIER_A, 0)).toEqual([]);
  });

  it('returns empty array for empty tiers', () => {
    expect(buildTierBillingBreakdown([], 4)).toEqual([]);
  });

  it('single tier open-ended: all participants in one band', () => {
    const tiers: PricingTier[] = [{ from_participant: 1, price_per_person: 200 }];
    const lines = buildTierBillingBreakdown(tiers, 6);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('pax 1–6');
    expect(lines[0]).toContain('6 × SAR 200');
    expect(lines[0]).toContain('SAR 1,200');
  });

  it('count within first band only shows one line', () => {
    const lines = buildTierBillingBreakdown(TIER_A, 2);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('pax 1–2');
    expect(lines[0]).toContain('2 × SAR 5,000');
  });

  it('sorts unsorted tiers before processing', () => {
    const reversed = [...TIER_A].reverse();
    const lines = buildTierBillingBreakdown(reversed, 4);
    expect(lines[0]).toContain('pax 1');
    expect(lines[1]).toContain('pax 4');
  });

  it('accepts custom currency', () => {
    const tiers: PricingTier[] = [{ from_participant: 1, price_per_person: 100 }];
    const lines = buildTierBillingBreakdown(tiers, 3, 'USD');
    expect(lines[0]).toContain('USD');
  });
});
