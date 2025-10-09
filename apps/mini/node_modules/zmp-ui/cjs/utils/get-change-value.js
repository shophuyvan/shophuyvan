"use strict";

exports.__esModule = true;
exports.getChangeValue = getChangeValue;
function getChangeValue(_ref) {
  var value = _ref.value,
    containerWidth = _ref.containerWidth,
    min = _ref.min,
    max = _ref.max,
    step = _ref.step,
    precision = _ref.precision;
  var left = !containerWidth ? value : Math.min(Math.max(value, 0), containerWidth) / containerWidth;
  var dx = left * (max - min);
  var nextValue = (dx !== 0 ? Math.round(dx / step) * step : 0) + min;
  if (precision !== undefined) {
    return Number(nextValue.toFixed(precision));
  }
  return nextValue;
}