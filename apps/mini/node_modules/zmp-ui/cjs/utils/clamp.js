"use strict";

exports.__esModule = true;
exports.clamp = clamp;
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}