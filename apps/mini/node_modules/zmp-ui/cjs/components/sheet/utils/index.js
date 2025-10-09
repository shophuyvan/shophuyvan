"use strict";

exports.__esModule = true;
exports.clamp = clamp;
exports.inDescendingOrder = void 0;
var inDescendingOrder = exports.inDescendingOrder = function inDescendingOrder(arr) {
  for (var i = 0; i < arr.length; i = +1) {
    if (arr[i + 1] > arr[i]) return false;
  }
  return true;
};
function clamp(number, lower, upper) {
  var lowNumber = Math.max(number, lower);
  return Math.min(lowNumber, upper);
}