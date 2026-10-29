/** Deterministic baselines. No provider calls, random fitting or future data. */
const day = 86400000;
export interface DemandBucket {
  day: number;
  hour: number;
  count: number;
}
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round = (x: number) => Math.round(x * 10) / 10;
export function forecastDemand(
  buckets: DemandBucket[],
  today: number,
  firstObservedDay = Math.min(...buckets.map((b) => b.day)),
) {
  const days = Array.from({ length: 56 }, (_, i) => today - (56 - i) * day);
  const daily = days.map((d) =>
    buckets.filter((b) => b.day === d).reduce((n, b) => n + b.count, 0),
  );
  const orders = daily.reduce((a, b) => a + b, 0);
  // Earliest observed demand is a conservative proxy for usable history.
  const sufficient =
    firstObservedDay <= today - 56 * day &&
    orders >= 100 &&
    daily.filter((n) => n > 0).length >= 28;
  if (!sufficient)
    return {
      sufficient: false as const,
      orders,
      activeDays: daily.filter((n) => n > 0).length,
    };
  const predict = (index: number, seasonalMean: boolean) =>
    seasonalMean
      ? mean([1, 2, 3, 4].map((k) => daily[index - 7 * k]))
      : daily[index - 7];
  // Rolling-origin last fourteen days: every prediction sees only earlier days.
  const errors = (seasonalMean: boolean) =>
    Array.from({ length: 14 }, (_, j) => {
      const i = 42 + j;
      return Math.abs(daily[i] - predict(i, seasonalMean));
    });
  const averageErrors = errors(true),
    naiveErrors = errors(false);
  const useMean = mean(averageErrors) < mean(naiveErrors);
  const residuals = [...(useMean ? averageErrors : naiveErrors)].sort(
    (a, b) => a - b,
  );
  const radius = residuals[Math.ceil(residuals.length * 0.9) - 1];
  const forecasts = Array.from({ length: 7 }, (_, h) => {
    const i = 56 + h,
      estimate = predict(i, useMean);
    return {
      day: today + h * day,
      estimate: round(estimate),
      lower: Math.max(0, Math.floor(estimate - radius)),
      upper: Math.ceil(estimate + radius),
    };
  });
  return {
    sufficient: true as const,
    orders,
    activeDays: daily.filter((n) => n > 0).length,
    method: useMean ? 'میانگین چهار روز هم‌نام هفته' : 'همان روز هفته قبل',
    mae: round(mean(useMean ? averageErrors : naiveErrors)),
    baselineMae: round(mean(naiveErrors)),
    forecasts,
  };
}

export function hourlyDemand(
  buckets: DemandBucket[],
  today: number,
  anchor: number,
) {
  const localHour = Math.floor((anchor - today) / 3600000);
  return Array.from({ length: 24 }, (_, i) => {
    const offset = localHour + i + 1;
    const date = today + Math.floor(offset / 24) * day,
      hour = offset % 24;
    const samples = [1, 2, 3, 4].map((week) =>
      buckets
        .filter((b) => b.day === date - week * 7 * day && b.hour === hour)
        .reduce((n, b) => n + b.count, 0),
    );
    return {
      at: date + hour * 3600000,
      estimate: round(mean(samples)),
      lower: Math.min(...samples),
      upper: Math.max(...samples),
      samples: 4,
    };
  });
}
