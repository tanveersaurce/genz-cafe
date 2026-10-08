export interface PartnerShare {
  partnerId: string;
  partnerName: string;
  basisPoints: number; // Integer (10000 = 100%)
}

export interface AllocationResult {
  netProfit: number; // in integer paise
  retainedProfit: number; // in paise
  distributableProfit: number; // in paise (netProfit - retainedProfit)
  allocations: Array<{
    partnerId: string;
    partnerName: string;
    basisPoints: number;
    amount: number; // signed integer paise (profit or loss share)
  }>;
}

/**
 * Distributes profit or loss across partners using the Largest-Remainder Method.
 * Guarantees that the sum of allocated partner amounts equals distributable profit EXACTLY (no paise drift).
 * Deterministically tie-breaks remainder equalities by partnerId ascending.
 */
export function allocateProfit(
  netProfit: number,
  shares: readonly PartnerShare[],
  retainedBasisPoints = 0
): AllocationResult {
  const totalBps = shares.reduce((sum, s) => sum + s.basisPoints, 0);
  if (totalBps !== 10000) {
    throw new Error(`Total share basis points must equal 10000 exactly, got ${totalBps}`);
  }

  // Retained profit is only retained on positive net profit
  const retainedProfit =
    netProfit > 0 ? Math.floor((netProfit * retainedBasisPoints) / 10000) : 0;
  const distributableProfit = netProfit - retainedProfit;

  if (distributableProfit === 0 || shares.length === 0) {
    return {
      netProfit,
      retainedProfit,
      distributableProfit,
      allocations: shares.map((s) => ({
        partnerId: s.partnerId,
        partnerName: s.partnerName,
        basisPoints: s.basisPoints,
        amount: 0,
      })),
    };
  }

  const isNegative = distributableProfit < 0;
  const absDistributable = Math.abs(distributableProfit);

  // Integer division parts
  const integerParts = shares.map((s) =>
    Math.floor((absDistributable * s.basisPoints) / 10000)
  );

  // Remainder parts
  const remainders = shares.map((s, idx) => ({
    partnerId: s.partnerId,
    idx,
    remainder: (absDistributable * s.basisPoints) % 10000,
  }));

  const sumInteger = integerParts.reduce((a, b) => a + b, 0);
  const diff = absDistributable - sumInteger; // Number of paise left to distribute

  // Sort remainder descending, tie-break by partnerId ascending
  remainders.sort((a, b) => {
    if (b.remainder !== a.remainder) {
      return b.remainder - a.remainder;
    }
    return a.partnerId.localeCompare(b.partnerId);
  });

  const finalAmounts = [...integerParts];
  for (let i = 0; i < diff; i++) {
    const target = remainders[i];
    if (target) {
      const cur = finalAmounts[target.idx] ?? 0;
      finalAmounts[target.idx] = cur + 1;
    }
  }

  const allocations = shares.map((s, idx) => ({
    partnerId: s.partnerId,
    partnerName: s.partnerName,
    basisPoints: s.basisPoints,
    amount: isNegative ? -finalAmounts[idx]! : finalAmounts[idx]!,
  }));

  return {
    netProfit,
    retainedProfit,
    distributableProfit,
    allocations,
  };
}
