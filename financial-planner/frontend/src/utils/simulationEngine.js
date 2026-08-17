/**
 * Core waterfall simulation engine for distributing expected monthly savings
 * amongst active goals based on their target amounts and deadlines.
 *
 * @param {Array} goals - Array of goal objects {id, targetAmount, targetDate, balance}
 * @param {number} monthlySavings - Expected monthly savings amount
 * @returns {Object} { timeline, balances, balancesAtDeadline, projectedDates }
 */
export const runWaterfallSimulation = (goals, monthlySavings) => {
  const sorted = [...goals].filter(g => g.targetAmount > 0 && g.balance < g.targetAmount);
  sorted.sort((a, b) => new Date(a.targetDate) - new Date(b.targetDate));

  let maxDate = new Date();
  sorted.forEach(g => {
    const d = new Date(g.targetDate);
    if (d > maxDate) maxDate = d;
  });

  const extendedMax = new Date(maxDate);
  extendedMax.setFullYear(extendedMax.getFullYear() + 5);

  let cy = new Date().getFullYear();
  let cm = new Date().getMonth();
  const maxY = extendedMax.getFullYear();
  const maxM = extendedMax.getMonth();

  const timeline = {};
  const balances = {};
  const balancesAtDeadline = {};
  const projectedDates = {};

  sorted.forEach(g => balances[g.id] = g.balance || 0);

  while (cy < maxY || (cy === maxY && cm <= maxM)) {
    const monthKey = `${cy}-${String(cm + 1).padStart(2, '0')}`;
    timeline[monthKey] = {};
    let available = monthlySavings;

    sorted.forEach(g => {
      if (balances[g.id] >= g.targetAmount) {
        timeline[monthKey][g.id] = 0;
        return;
      }
      if (available <= 0) {
        timeline[monthKey][g.id] = 0;
        return;
      }
      const tDate = new Date(g.targetDate);
      
      const isPastDeadline = cy > tDate.getFullYear() ||
        (cy === tDate.getFullYear() && cm > tDate.getMonth());

      const missing = g.targetAmount - balances[g.id];
      const mLeft = Math.max(1, (tDate.getFullYear() - cy) * 12 + (tDate.getMonth() - cm));
      const required = missing / mLeft;
      const alloc = Math.min(available, required);
      const pct = (alloc / monthlySavings) * 100;

      // Only show in display timeline if within deadline
      timeline[monthKey][g.id] = isPastDeadline ? 0 : pct;
      balances[g.id] += alloc;
      available -= alloc;

      // Snapshot balance at the goal's deadline month (to compute real shortfall)
      if (cy === tDate.getFullYear() && cm === tDate.getMonth()) {
        balancesAtDeadline[g.id] = balances[g.id];
      }

      if (!projectedDates[g.id] && balances[g.id] >= g.targetAmount) {
        projectedDates[g.id] = monthKey;
      }
    });

    cm++;
    if (cm > 11) { cm = 0; cy++; }
    if (cy > new Date().getFullYear() + 15) break;
  }

  return { timeline, balances, balancesAtDeadline, projectedDates };
};
