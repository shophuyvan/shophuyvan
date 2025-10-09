"use strict";

exports.__esModule = true;
exports.getPrefixCls = void 0;
var _config = require("../constants/config");
var getPrefixCls = exports.getPrefixCls = function getPrefixCls(suffixCls, customizePrefixCls) {
  if (customizePrefixCls) return customizePrefixCls;
  return suffixCls ? _config.CLASS_PREFIX + "-" + suffixCls : _config.CLASS_PREFIX;
};