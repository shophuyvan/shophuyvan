export function getPosition(_ref) {
  var value = _ref.value,
    min = _ref.min,
    max = _ref.max;
  var position = (value - min) / (max - min) * 100;
  return Math.min(Math.max(position, 0), 100);
}