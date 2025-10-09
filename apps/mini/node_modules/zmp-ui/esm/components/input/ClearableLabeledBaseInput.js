import _extends from "@babel/runtime/helpers/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["label", "helperText", "errorText", "status", "clearable", "addonBefore", "addonAfter", "suffix", "disabled", "value", "affixWrapperClassName", "groupClassName", "maxLength", "showCount"];
import classNames from "clsx";
import React from "react";
import { getStatusClassNames } from "../../utils/statusUtils";
import { getPrefixCls } from "../../utils/class";
import BaseInput from "./BaseInput";
import CloseCircleIcon from "./icons/close-circle";
import InfoCircleIcon from "./icons/info-circle";
import SuccessCircleIcon from "./icons/success-circle";
import WarningIcon from "./icons/warning";
import { fixControlledValue } from "./utils/commonUtils";
var ClearableLabeledBaseInput = function ClearableLabeledBaseInput(props) {
  var label = props.label,
    helperText = props.helperText,
    errorText = props.errorText,
    status = props.status,
    clearable = props.clearable,
    addonBefore = props.addonBefore,
    addonAfter = props.addonAfter,
    suffix = props.suffix,
    disabled = props.disabled,
    value = props.value,
    affixWrapperClassName = props.affixWrapperClassName,
    groupClassName = props.groupClassName,
    maxLength = props.maxLength,
    showCount = props.showCount,
    rest = _objectWithoutPropertiesLoose(props, _excluded);
  var prefixCls = getPrefixCls("input");
  var getSuffix = function getSuffix() {
    var hasMaxLength = Number(maxLength) > 0;
    if (suffix || showCount || status === "success") {
      var _classNames, _classNames2;
      var val = fixControlledValue(value);
      var valueLength = val.length;
      var maxLengthStr = hasMaxLength ? "/ " + maxLength : "";
      var dataCount = typeof showCount === "object" ? showCount.formatter({
        value: val,
        count: valueLength,
        maxLength: maxLength
      }) : "" + valueLength + maxLengthStr;
      return /*#__PURE__*/React.createElement(React.Fragment, null, status === "success" && value && !disabled && /*#__PURE__*/React.createElement("span", {
        className: classNames(prefixCls + "-status-success", (_classNames = {}, _classNames[prefixCls + "-status-success-has-suffix"] = !!suffix, _classNames))
      }, /*#__PURE__*/React.createElement(SuccessCircleIcon, {
        className: prefixCls + "-status-success-icon"
      })), !!showCount && /*#__PURE__*/React.createElement("span", {
        className: classNames(prefixCls + "-show-count-suffix", (_classNames2 = {}, _classNames2[prefixCls + "-show-count-has-suffix"] = !!suffix, _classNames2))
      }, dataCount), suffix);
    }
    return null;
  };
  var getAddonBefore = function getAddonBefore() {
    if (label) {
      return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
        className: prefixCls + "-label"
      }, label), addonBefore);
    }
    return null;
  };
  var getAddonAfter = function getAddonAfter() {
    if (addonAfter || helperText || errorText) {
      var _classNames3;
      var hasError = status === "error";
      return /*#__PURE__*/React.createElement(React.Fragment, null, (helperText || errorText) && /*#__PURE__*/React.createElement("span", {
        className: classNames(prefixCls + "-helper-text", (_classNames3 = {}, _classNames3[prefixCls + "-helper-text-has-error"] = hasError && !disabled, _classNames3))
      }, hasError && !disabled ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(WarningIcon, {
        className: prefixCls + "-helper-text-icon"
      }), /*#__PURE__*/React.createElement("span", {
        className: prefixCls + "-helper-text-content"
      }, errorText)) : helperText ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(InfoCircleIcon, {
        className: prefixCls + "-helper-text-icon"
      }), /*#__PURE__*/React.createElement("span", {
        className: prefixCls + "-helper-text-content"
      }, helperText)) : null), addonAfter);
    }
    return null;
  };
  var getAllowClear = function getAllowClear() {
    if (!disabled && clearable) {
      var _classNames4;
      var displayMode = typeof clearable === "object" && clearable != null && clearable.mode ? clearable.mode : "always";
      return {
        clearIcon: /*#__PURE__*/React.createElement(CloseCircleIcon, {
          className: classNames(prefixCls + "-clear-icon", (_classNames4 = {}, _classNames4[prefixCls + "-clear-icon-display-mode-focus"] = displayMode === "focus", _classNames4))
        })
      };
    }
    return false;
  };
  return /*#__PURE__*/React.createElement(BaseInput, _extends({}, rest, {
    disabled: disabled,
    value: fixControlledValue(value),
    addonBefore: getAddonBefore(),
    addonAfter: getAddonAfter(),
    allowClear: getAllowClear(),
    suffix: getSuffix(),
    affixWrapperClassName: classNames(getStatusClassNames(prefixCls + "-affix-wrapper", status), affixWrapperClassName),
    groupClassName: classNames(getStatusClassNames(prefixCls + "-group-wrapper", status), groupClassName)
  }));
};
export default ClearableLabeledBaseInput;