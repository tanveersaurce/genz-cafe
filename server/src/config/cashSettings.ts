export const cashSettings = {
  // DUMMY: confirm with cafe
  largeCashOutThresholdPaise: 200000, // ₹2,000 threshold above which cash out requires manager approval

  // DUMMY: confirm with cafe / CA
  differenceTolerancePaise: 5000, // ₹50 difference tolerance beyond which closing note is mandatory

  // DUMMY: confirm with cafe
  defaultOpeningFloatPaise: 200000, // ₹2,000 default drawer float if no prior closing exists

  supportedDenominations: ['500', '200', '100', '50', '20', '10', '5', '2', '1'] as const,
};
