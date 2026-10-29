import {
  forecastDemand,
  hourlyDemand,
} from '../../../packages/insights/src/forecast';
const day = 86400000,
  today = Date.parse('2026-10-30T00:00:00+03:30');
const weekly = Array.from({ length: 56 }, (_, i) => ({
  day: today - (56 - i) * day,
  hour: 12,
  count: ((i % 7) + 1) * 2,
}));
test('weekly demand baseline is evaluated without future leakage and repeats a known weekly pattern', () => {
  const report = forecastDemand(weekly, today);
  expect(report.sufficient).toBe(true);
  if (!report.sufficient) throw new Error('fixture');
  expect(report.mae).toBe(0);
  expect(report.baselineMae).toBe(0);
  expect(report.forecasts.map((r) => r.estimate)).toEqual([
    2, 4, 6, 8, 10, 12, 14,
  ]);
  expect(report.forecasts[0].day).toBe(today);
  expect(
    report.forecasts.every(
      (r) => r.lower >= 0 && r.lower <= r.estimate && r.upper >= r.estimate,
    ),
  ).toBe(true);
});
test('sparse, short and empty histories do not generate forecasts', () => {
  for (const buckets of [
    [],
    weekly.slice(1),
    weekly.map((b) => ({ ...b, count: 1 })),
    weekly.filter((_, i) => i % 3 === 0),
  ])
    expect(forecastDemand(buckets, today).sufficient).toBe(false);
});
test('next hours cross Tehran midnight and use matching historical weekdays and hours', () => {
  const rows = hourlyDemand(weekly, today, today + 23 * 3600000 + 1800000);
  expect(rows).toHaveLength(24);
  expect(rows[0].at).toBe(today + day);
  expect(rows.find((r) => r.at === today + day + 12 * 3600000)?.estimate).toBe(
    4,
  );
  expect(
    rows.every(
      (r) => r.samples === 4 && r.estimate >= r.lower && r.estimate <= r.upper,
    ),
  ).toBe(true);
});

test('a closed first day does not discard older available history', () => {
  expect(
    forecastDemand(weekly.slice(1), today, today - 60 * day).sufficient,
  ).toBe(true);
});
