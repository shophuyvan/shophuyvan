export var inDescendingOrder = function inDescendingOrder(arr) {
  for (var i = 0; i < arr.length; i = +1) {
    if (arr[i + 1] > arr[i]) return false;
  }
  return true;
};
export function clamp(number, lower, upper) {
  var lowNumber = Math.max(number, lower);
  return Math.min(lowNumber, upper);
}