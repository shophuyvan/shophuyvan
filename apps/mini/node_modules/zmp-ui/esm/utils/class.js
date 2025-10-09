import { CLASS_PREFIX } from "../constants/config";
export var getPrefixCls = function getPrefixCls(suffixCls, customizePrefixCls) {
  if (customizePrefixCls) return customizePrefixCls;
  return suffixCls ? CLASS_PREFIX + "-" + suffixCls : CLASS_PREFIX;
};