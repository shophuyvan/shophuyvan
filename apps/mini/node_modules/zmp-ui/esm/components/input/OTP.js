/* eslint-disable react/no-array-index-key */
import classNames from "clsx";
import React, { useCallback, useImperativeHandle, useState } from "react";
import useMergedState from "../../hooks/useMergedState";
import { getPrefixCls } from "../../utils/class";
var OTP = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var disabled = props.disabled,
    _props$otpLength = props.otpLength,
    otpLength = _props$otpLength === void 0 ? 4 : _props$otpLength,
    _props$show = props.show,
    show = _props$show === void 0 ? false : _props$show,
    defaultValue = props.defaultValue,
    onChange = props.onChange,
    rawValue = props.value,
    readOnly = props.readOnly,
    className = props.className,
    style = props.style,
    id = props.id;
  var inputRef = React.useRef(null);
  var inputPrefixCls = getPrefixCls("input");
  var prefixCls = getPrefixCls("input-otp");
  var _useMergedState = useMergedState(defaultValue || "", {
      value: rawValue
    }),
    value = _useMergedState[0],
    setValue = _useMergedState[1];
  var _useState = useState(false),
    isFocus = _useState[0],
    setIsFocus = _useState[1];
  var _useState2 = useState(null),
    focusIndex = _useState2[0],
    setFocusIndex = _useState2[1];
  var handleFocus = useCallback(function () {
    var _inputRef$current;
    if (disabled || readOnly) return;
    setIsFocus(true);
    (_inputRef$current = inputRef.current) == null || _inputRef$current.focus();
  }, [disabled, readOnly]);
  var handleSetFocusIndex = useCallback(function (selectedIndex) {
    var len = value.length;
    if (selectedIndex && len > selectedIndex && len - selectedIndex <= 1) {
      setFocusIndex(selectedIndex);
    } else if (len === otpLength) {
      setFocusIndex(len - 1);
    } else {
      setFocusIndex(len);
    }
  }, [value, otpLength]);
  var handleRawInputChange = useCallback(function (event) {
    var inputValue = event.target.value;
    if (inputValue.length <= otpLength) {
      setValue(inputValue);
      setFocusIndex(inputValue.length);
      onChange == null || onChange(event);
    }
  }, [otpLength, setValue, onChange]);
  var handleClickOtpItem = useCallback(function (selectedIndex) {
    handleSetFocusIndex(selectedIndex);
    handleFocus();
  }, [handleSetFocusIndex, handleFocus]);
  useImperativeHandle(ref, function () {
    return {
      el: inputRef.current,
      focus: function focus() {
        handleSetFocusIndex();
        handleFocus();
      },
      blur: function blur() {
        var _inputRef$current2;
        (_inputRef$current2 = inputRef.current) == null || _inputRef$current2.blur();
      }
    };
  });
  return /*#__PURE__*/React.createElement("div", {
    className: classNames(prefixCls + "-wrapper")
  }, /*#__PURE__*/React.createElement("input", {
    type: "number",
    inputMode: "numeric",
    pattern: "[0-9]*",
    autoComplete: "one-time-code",
    maxLength: otpLength,
    ref: inputRef,
    disabled: disabled,
    onFocus: function onFocus() {
      return handleFocus();
    },
    onBlur: function onBlur() {
      return setIsFocus(false);
    },
    value: value,
    onChange: handleRawInputChange,
    readOnly: readOnly,
    className: classNames(prefixCls + "-hidden-input"),
    id: id
  }), /*#__PURE__*/React.createElement("div", {
    className: classNames(prefixCls + "-list")
  }, Array(otpLength).fill("").map(function (_, index) {
    var _classNames;
    var num = value.slice(index, index + 1);
    var focus = focusIndex === index && isFocus;
    return /*#__PURE__*/React.createElement("div", {
      role: "presentation",
      onClick: function onClick() {
        return handleClickOtpItem(index);
      },
      key: index,
      className: classNames(inputPrefixCls, prefixCls, (_classNames = {}, _classNames[inputPrefixCls + "-disabled"] = disabled, _classNames[prefixCls + "-active"] = focus && !disabled, _classNames[prefixCls + "-cursor"] = focus && !num && !disabled, _classNames), className),
      style: style
    }, num ? show ? num : /*#__PURE__*/React.createElement("span", {
      className: prefixCls + "-dot"
    }) : "");
  })));
});
OTP.defaultProps = {
  otpLength: 4,
  show: false
};
export default OTP;