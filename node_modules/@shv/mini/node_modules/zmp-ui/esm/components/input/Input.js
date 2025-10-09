import _extends from "@babel/runtime/helpers/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["onChange", "onFocus", "onBlur", "onPressEnter", "onKeyDown", "type", "disabled", "className", "inputClassName", "defaultValue", "status", "size"];
import React, { useRef, useState, forwardRef, useImperativeHandle, useEffect } from "react";
import classNames from "clsx";
import { resolveOnChange, triggerFocus } from "./utils/commonUtils";
import omit from "../../utils/omit";
import useMergedState from "../../hooks/useMergedState";
import { getPrefixCls } from "../../utils/class";
import { getMergedStatus, getStatusClassNames } from "../../utils/statusUtils";
import DisabledContext from "../../config-provider/DisabledContext";
import SizeContext from "../../config-provider/SizeContext";
import ClearableLabeledBaseInput from "./ClearableLabeledBaseInput";
var Input = /*#__PURE__*/forwardRef(function (props, ref) {
  var onChange = props.onChange,
    onFocus = props.onFocus,
    onBlur = props.onBlur,
    onPressEnter = props.onPressEnter,
    onKeyDown = props.onKeyDown,
    _props$type = props.type,
    type = _props$type === void 0 ? "text" : _props$type,
    customDisabled = props.disabled,
    className = props.className,
    inputClassName = props.inputClassName,
    defaultValue = props.defaultValue,
    customStatus = props.status,
    customSize = props.size,
    rest = _objectWithoutPropertiesLoose(props, _excluded);
  var prefixCls = getPrefixCls("input");
  var _useMergedState = useMergedState(defaultValue, {
      value: props.value
    }),
    value = _useMergedState[0],
    setValue = _useMergedState[1];
  var _useState = useState(false),
    focused = _useState[0],
    setFocused = _useState[1];
  var inputRef = useRef(null);
  var focus = function focus(option) {
    if (inputRef.current) {
      triggerFocus(inputRef.current, option);
    }
  };

  // ===================== Size =====================
  var size = React.useContext(SizeContext);
  var mergedSize = customSize || size;

  // ===================== Disabled =====================
  var disabled = React.useContext(DisabledContext);
  var mergedDisabled = customDisabled || disabled;

  // ===================== Status =====================
  var contextStatus = "";
  var mergedStatus = getMergedStatus(contextStatus, customStatus);

  // ===================== Remove Password value =====================
  var removePasswordTimeoutRef = useRef([]);
  var removePasswordTimeout = function removePasswordTimeout() {
    removePasswordTimeoutRef.current.push(window.setTimeout(function () {
      var _inputRef$current, _inputRef$current2;
      if (inputRef.current && ((_inputRef$current = inputRef.current) == null ? void 0 : _inputRef$current.getAttribute("type")) === "password" && (_inputRef$current2 = inputRef.current) != null && _inputRef$current2.hasAttribute("value")) {
        var _inputRef$current3;
        (_inputRef$current3 = inputRef.current) == null || _inputRef$current3.removeAttribute("value");
      }
    }));
  };
  useImperativeHandle(ref, function () {
    return {
      focus: focus,
      blur: function blur() {
        var _inputRef$current4;
        (_inputRef$current4 = inputRef.current) == null || _inputRef$current4.blur();
      },
      setSelectionRange: function setSelectionRange(start, end, direction) {
        var _inputRef$current5;
        (_inputRef$current5 = inputRef.current) == null || _inputRef$current5.setSelectionRange(start, end, direction);
      },
      select: function select() {
        var _inputRef$current6;
        (_inputRef$current6 = inputRef.current) == null || _inputRef$current6.select();
      },
      input: inputRef.current
    };
  });
  useEffect(function () {
    setFocused(function (prev) {
      return prev && mergedDisabled ? false : prev;
    });
  }, [mergedDisabled]);
  useEffect(function () {
    removePasswordTimeout();
    return function () {
      return removePasswordTimeoutRef.current.forEach(function (item) {
        return window.clearTimeout(item);
      });
    };
  }, []);
  var handleChange = function handleChange(e) {
    if (props.value === undefined) {
      setValue(e.target.value);
    }
    if (inputRef.current) {
      resolveOnChange(inputRef.current, e, onChange);
    }
  };
  var handleKeyDown = function handleKeyDown(e) {
    if (onPressEnter && e.key === "Enter") {
      onPressEnter(e);
    }
    onKeyDown == null || onKeyDown(e);
  };
  var handleFocus = function handleFocus(e) {
    setFocused(true);
    removePasswordTimeout();
    onFocus == null || onFocus(e);
  };
  var handleBlur = function handleBlur(e) {
    setFocused(false);
    removePasswordTimeout();
    onBlur == null || onBlur(e);
  };
  var handleReset = function handleReset(e) {
    setValue("");
    focus();
    if (inputRef.current) {
      resolveOnChange(inputRef.current, e, onChange);
    }
  };
  var getInputElement = function getInputElement() {
    var _classNames;
    var otherProps = omit(props, ["onPressEnter", "prefix", "suffix", "clearable", "status", "helperText", "errorText", "size",
    // Input elements must be either controlled or uncontrolled,
    // specify either the value prop, or the defaultValue prop, but not both.
    "defaultValue", "affixWrapperClassName", "groupClassName", "inputClassName", "wrapperClassName", "onInputTriggerClick"]);
    return /*#__PURE__*/React.createElement("input", _extends({}, otherProps, {
      onChange: handleChange,
      onFocus: handleFocus,
      onBlur: handleBlur,
      onKeyDown: handleKeyDown,
      className: classNames(prefixCls, (_classNames = {}, _classNames[prefixCls + "-small"] = mergedSize === "small", _classNames[prefixCls + "-large"] = mergedSize === "large", _classNames[prefixCls + "-disabled"] = mergedDisabled, _classNames), (!!value || mergedStatus === "error") && getStatusClassNames(prefixCls, mergedStatus), inputClassName, className),
      ref: inputRef,
      type: type
    }));
  };
  return /*#__PURE__*/React.createElement(ClearableLabeledBaseInput, _extends({}, rest, {
    prefixCls: prefixCls,
    className: className,
    inputElement: getInputElement(),
    handleReset: handleReset,
    value: value,
    focused: focused,
    triggerFocus: focus,
    disabled: mergedDisabled || undefined,
    status: mergedStatus
  }));
});
Input.defaultProps = {
  onInputTriggerClick: undefined
};
export default Input;