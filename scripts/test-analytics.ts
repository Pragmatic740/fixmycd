import assert from 'assert';
import {
  parseAnalyticsFilters,
  resolveDateRange,
  haversineKm,
  normalizeStateFilter,
} from '../src/lib/analytics';

function testHaversine() {
  const d = haversineKm(38.9072, -77.0369, 38.9072, -77.0369);
  assert.ok(d < 0.001, 'same point ~0');
  const d2 = haversineKm(40.7128, -74.006, 34.0522, -118.2437);
  assert.ok(d2 > 3000 && d2 < 5000, `NYC-LA distance plausible, got ${d2}`);
}

function testFilterParsing() {
  const params = new URLSearchParams(
    'state=NY&severityMin=3&datePreset=month&radiusLat=40.7&radiusLng=-74&radiusKm=10&groupBy=status'
  );
  const f = parseAnalyticsFilters(params);
  assert.equal(f.state, 'NY');
  assert.equal(f.severityMin, 3);
  assert.equal(f.datePreset, 'month');
  assert.equal(f.radiusKm, 10);
  assert.equal(f.groupBy, 'status');
}

function testDateRange() {
  const { start, end } = resolveDateRange({ datePreset: 'week' });
  assert.ok(start && end);
  const days = (end!.getTime() - start!.getTime()) / 86400000;
  assert.ok(days >= 6.9 && days <= 7.1, `week range ~7 days, got ${days}`);
}

function testCacheKeyStability() {
  const a = parseAnalyticsFilters(new URLSearchParams('state=CA&severityMin=2'));
  const b = parseAnalyticsFilters(new URLSearchParams('severityMin=2&state=CA'));
  assert.equal(a.state, b.state);
  assert.equal(a.severityMin, b.severityMin);
}

function testStateNormalize() {
  assert.equal(normalizeStateFilter('fl'), 'FL');
  assert.equal(normalizeStateFilter('Florida'), 'FL');
  assert.equal(normalizeStateFilter('IA'), 'IA');
  assert.equal(normalizeStateFilter('new york'), 'NY');
}

testHaversine();
testFilterParsing();
testDateRange();
testCacheKeyStability();
testStateNormalize();
console.log('analytics unit checks passed');
