import 'dotenv/config';
import { getAnalyticsSummary, getBreakdowns } from '../src/lib/analytics';

async function main() {
  const filters = { datasetKey: 'nbi-bridges-2026v14', datePreset: 'year' as const };
  const summary = await getAnalyticsSummary(filters);
  const byCondition = await getBreakdowns({ ...filters, groupBy: 'failureType' });
  const byCd = await getBreakdowns({ ...filters, groupBy: 'status' });

  console.log('NBI summary:', {
    totalReports: summary.totalReports,
    criticalReports: summary.criticalReports,
    estimatedCostTotal: Math.round(summary.estimatedCostTotal),
    uniqueReporters: summary.uniqueReporters,
  });
  console.log('Failure types:', byCondition.slice(0, 5));
  console.log('Statuses:', byCd.slice(0, 6));

  if (summary.totalReports < 1400) {
    throw new Error(`Expected ~1454 NBI reports in year window, got ${summary.totalReports}`);
  }
  console.log('verify-nbi-seed ok');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => process.exit(0));
