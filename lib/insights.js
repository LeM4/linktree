const pct = (x) => `${Math.round(x * 100)}%`;

/**
 * Turns the stats into a few plain-language findings, most useful first.
 * @param {ReturnType<import('./stats.js').getStats>} stats
 * @param {{ countryName: (code: string) => string, linkLabel: (url: string) => string, focus?: string|null }} labels
 */
export function buildInsights(stats, { countryName, linkLabel, focus = null }) {
  const out = [];
  const { kpis, previous, deltas, range, countries, heatmaps, referrers, matrix } = stats;

  if (previous && previous.visits >= 5 && deltas.visits != null && Math.abs(deltas.visits) >= 0.05) {
    out.push({
      icon: 'chart',
      tone: deltas.visits > 0 ? 'up' : 'down',
      text: `Visits are ${deltas.visits > 0 ? 'up' : 'down'} ${pct(Math.abs(deltas.visits))} compared to the previous ${range.title.replace('last ', '')}.`,
    });
  }

  const top = countries[0];
  if (focus === null && top && top.visits >= 5 && top.share >= 0.2 && top.code) {
    out.push({ icon: 'globe', text: `${countryName(top.code)} brings ${pct(top.share)} of your visitors.` });
  }

  const peak = heatmaps.clicks.peak;
  if (peak && heatmaps.clicks.total >= 10) {
    const hour = String(peak.hour).padStart(2, '0');
    out.push({ icon: 'clock', text: `Fans click most on ${peak.day} between ${hour}:00 and ${hour}:59.` });
  }

  const pair = matrix.rows
    .flatMap((row) => row.cells.map((c, i) => ({ ...c, code: row.code, url: matrix.links[i].url })))
    .filter((c) => c.code && c.n >= 5 && c.lift >= 1.5)
    .sort((a, b) => b.lift - a.lift)[0];
  if (pair) {
    out.push({
      icon: 'link',
      text: `Visitors from ${countryName(pair.code)} pick “${linkLabel(pair.url)}” ${pair.lift.toFixed(1)}× more often than average.`,
    });
  }

  const best = referrers
    .filter((r) => r.referrer && r.visits >= 10)
    .sort((a, b) => b.ctr - a.ctr)[0];
  if (best && best.ctr > kpis.ctr * 1.2) {
    const host = best.referrer.replace(/^https?:\/\//, '').replace(/\/$/, '');
    out.push({ icon: 'sparkle', text: `${pct(best.ctr)} of visitors from ${host} click a link, your best-converting source.` });
  }

  if (kpis.visitors >= 10 && kpis.returning >= 0.25) {
    out.push({ icon: 'user', text: `${pct(kpis.returning)} of your visitors came back on another day.` });
  }

  return out.slice(0, 4);
}
