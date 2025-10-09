var getPercent = function getPercent(completed, maxCompleted) {
  if (completed <= 0 || maxCompleted <= 0) {
    return 0;
  }
  if (completed > maxCompleted) {
    return 100;
  }
  return Math.round(completed / maxCompleted * 100 * 100) / 100;
};
export { getPercent };