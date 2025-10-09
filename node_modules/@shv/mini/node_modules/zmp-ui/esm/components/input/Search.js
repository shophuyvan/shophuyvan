import _extends from "@babel/runtime/helpers/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["className", "suffix", "loading", "disabled", "size", "onSearch", "onChange", "onCompositionStart", "onCompositionEnd"];
import React from "react";
import classNames from "clsx";
import Input from "./Input";
import { getPrefixCls } from "../../utils/class";
import SearchOutlined from "./icons/search-outlined";
import { composeRef } from "../../utils/ref";
import Button from "../button";
import SizeContext from "../../config-provider/SizeContext";
var Search = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var _classNames;
  var className = props.className,
    suffix = props.suffix,
    loading = props.loading,
    disabled = props.disabled,
    customizeSize = props.size,
    customOnSearch = props.onSearch,
    customOnChange = props.onChange,
    onCompositionStart = props.onCompositionStart,
    onCompositionEnd = props.onCompositionEnd,
    restProps = _objectWithoutPropertiesLoose(props, _excluded);
  var contextSize = React.useContext(SizeContext);
  var composedRef = React.useRef(false);
  var size = customizeSize || contextSize;
  var inputRef = React.useRef(null);
  var onChange = function onChange(e) {
    if (e && e.target && e.type === "click" && customOnSearch) {
      customOnSearch(e.target.value, e);
    }
    if (customOnChange) {
      customOnChange(e);
    }
  };
  var onMouseDown = function onMouseDown(e) {
    var _inputRef$current;
    if (document.activeElement === ((_inputRef$current = inputRef.current) == null ? void 0 : _inputRef$current.input)) {
      e.preventDefault();
    }
  };
  var onSearch = function onSearch(e) {
    if (customOnSearch) {
      var _inputRef$current2;
      customOnSearch(((_inputRef$current2 = inputRef.current) == null || (_inputRef$current2 = _inputRef$current2.input) == null ? void 0 : _inputRef$current2.value) || "", e);
    }
  };
  var onPressEnter = function onPressEnter(e) {
    if (composedRef.current) {
      return;
    }
    onSearch(e);
  };
  var prefixCls = getPrefixCls("input-search");
  var searchIcon = /*#__PURE__*/React.createElement(SearchOutlined, null);
  var btnClassName = prefixCls + "-button";
  var buttonSearch = /*#__PURE__*/React.createElement(Button, {
    className: btnClassName,
    variant: "tertiary",
    type: "neutral",
    disabled: disabled,
    key: "enterButton",
    onMouseDown: onMouseDown,
    onClick: onSearch,
    loading: loading,
    icon: searchIcon,
    size: size
  });
  var cls = classNames(prefixCls, (_classNames = {}, _classNames[prefixCls + "-" + size] = !!size, _classNames), className);
  var handleOnCompositionStart = function handleOnCompositionStart(e) {
    composedRef.current = true;
    onCompositionStart == null || onCompositionStart(e);
  };
  var handleOnCompositionEnd = function handleOnCompositionEnd(e) {
    composedRef.current = false;
    onCompositionEnd == null || onCompositionEnd(e);
  };
  return /*#__PURE__*/React.createElement(Input, _extends({
    ref: composeRef(inputRef, ref),
    onPressEnter: onPressEnter
  }, restProps, {
    size: size,
    label: "",
    helperText: "",
    onCompositionStart: handleOnCompositionStart,
    onCompositionEnd: handleOnCompositionEnd,
    prefix: buttonSearch,
    suffix: suffix,
    onChange: onChange,
    className: cls,
    disabled: disabled
  }));
});
export default Search;