import React, { cloneElement, useRef } from "react";
import classNames from "clsx";
import { hasAddon } from "./utils/commonUtils";
var BaseInput = function BaseInput(props) {
  var _classNames2;
  var inputElement = props.inputElement,
    prefixCls = props.prefixCls,
    prefix = props.prefix,
    suffix = props.suffix,
    addonBefore = props.addonBefore,
    addonAfter = props.addonAfter,
    className = props.className,
    style = props.style,
    affixWrapperClassName = props.affixWrapperClassName,
    groupClassName = props.groupClassName,
    wrapperClassName = props.wrapperClassName,
    disabled = props.disabled,
    readOnly = props.readOnly,
    focused = props.focused,
    triggerFocus = props.triggerFocus,
    allowClear = props.allowClear,
    value = props.value,
    handleReset = props.handleReset,
    hidden = props.hidden,
    onInputTriggerClick = props.onInputTriggerClick;
  var containerRef = useRef(null);
  var onInputMouseDown = function onInputMouseDown(e) {
    var _containerRef$current;
    if ((_containerRef$current = containerRef.current) != null && _containerRef$current.contains(e.target)) {
      triggerFocus == null || triggerFocus();
    }
  };

  // ================== Clear Icon ================== //
  var getClearIcon = function getClearIcon() {
    var _classNames;
    if (!allowClear) {
      return null;
    }
    var needClear = !disabled && !readOnly && value;
    var clearIconCls = prefixCls + "-clear-btn";
    var iconNode = typeof allowClear === "object" && allowClear != null && allowClear.clearIcon ? allowClear.clearIcon : "✖";
    return /*#__PURE__*/React.createElement("span", {
      key: prefixCls + "-clear-btn",
      onClick: handleReset,
      onMouseDown: function onMouseDown(e) {
        return e.preventDefault();
      },
      className: classNames(prefixCls + "-suffix-item", clearIconCls, (_classNames = {}, _classNames[clearIconCls + "-hidden"] = !needClear, _classNames[clearIconCls + "-has-suffix"] = !!suffix, _classNames)),
      role: "button",
      tabIndex: -1
    }, iconNode);
  };
  var element = /*#__PURE__*/cloneElement(inputElement, {
    value: value,
    hidden: hidden
  });
  var affixWrapperPrefixCls = prefixCls + "-affix-wrapper";
  var affixWrapperCls = classNames(affixWrapperPrefixCls, (_classNames2 = {}, _classNames2[affixWrapperPrefixCls + "-disabled"] = disabled, _classNames2[affixWrapperPrefixCls + "-focused"] = focused, _classNames2[affixWrapperPrefixCls + "-readonly"] = readOnly, _classNames2[affixWrapperPrefixCls + "-input-with-clear-btn"] = suffix && allowClear && value, _classNames2), !hasAddon(props) && className, affixWrapperClassName);
  var suffixNode = (suffix || allowClear) && /*#__PURE__*/React.createElement("span", {
    className: prefixCls + "-suffix"
  }, !disabled && getClearIcon(), suffix);
  element = /*#__PURE__*/React.createElement("span", {
    className: affixWrapperCls,
    style: style,
    hidden: !hasAddon(props) && hidden,
    onMouseDown: onInputMouseDown,
    ref: containerRef,
    role: "presentation",
    onClick: onInputTriggerClick
  }, prefix && /*#__PURE__*/React.createElement("span", {
    className: prefixCls + "-prefix"
  }, prefix), /*#__PURE__*/cloneElement(inputElement, {
    style: null,
    value: value,
    hidden: null
  }), suffixNode);

  // ================== Addon ================== //
  if (hasAddon(props)) {
    var wrapperCls = prefixCls + "-group";
    var addonCls = wrapperCls + "-addon";
    var mergedWrapperClassName = classNames(prefixCls + "-wrapper", wrapperCls, wrapperClassName);
    var mergedGroupClassName = classNames(prefixCls + "-group-wrapper", className, groupClassName);

    // Need another wrapper for changing display:table to display:inline-block
    // and put style prop in wrapper
    return /*#__PURE__*/React.createElement("span", {
      className: mergedGroupClassName,
      style: style,
      hidden: hidden
    }, /*#__PURE__*/React.createElement("span", {
      className: mergedWrapperClassName
    }, addonBefore && /*#__PURE__*/React.createElement("span", {
      className: addonCls
    }, addonBefore), /*#__PURE__*/cloneElement(element, {
      style: null,
      hidden: null
    }), addonAfter && /*#__PURE__*/React.createElement("span", {
      className: addonCls
    }, addonAfter)));
  }
  return element;
};
export default BaseInput;