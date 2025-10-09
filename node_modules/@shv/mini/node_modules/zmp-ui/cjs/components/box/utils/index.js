"use strict";

exports.__esModule = true;
exports.validateSpacingNumber = exports.isValidBoxProps = void 0;
var _constants = require("./constants");
var isValidBoxProps = exports.isValidBoxProps = function isValidBoxProps(value, prop) {
  if (!value || !prop) return false;
  if (!_constants.BOX_PROPS[prop]) return false;
  return _constants.BOX_PROPS[prop].find(function (val) {
    return val === value;
  });
};
var validateSpacingNumber = exports.validateSpacingNumber = function validateSpacingNumber(num) {
  return !Number.isNaN(num) && num >= 0 && num <= 10;
};