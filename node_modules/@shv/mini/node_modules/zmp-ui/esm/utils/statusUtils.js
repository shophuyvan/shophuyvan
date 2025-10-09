import classNames from "clsx";
import { tuple } from "./type";
var ValidateStatuses = tuple("success", "warning", "error", "validating", "");
var InputStatuses = tuple("success", "error", "");
export function getStatusClassNames(prefixCls, status, hasFeedback) {
  var _classNames;
  return classNames((_classNames = {}, _classNames[prefixCls + "-status-success"] = status === "success", _classNames[prefixCls + "-status-warning"] = status === "warning", _classNames[prefixCls + "-status-error"] = status === "error", _classNames[prefixCls + "-status-validating"] = status === "validating", _classNames[prefixCls + "-has-feedback"] = hasFeedback, _classNames));
}
export var getMergedStatus = function getMergedStatus(contextStatus, customStatus) {
  return customStatus || contextStatus;
};