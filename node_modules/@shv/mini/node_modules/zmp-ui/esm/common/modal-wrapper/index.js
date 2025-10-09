import _extends from "@babel/runtime/helpers/extends";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["visible", "afterClose", "maskClosable", "onClose", "children", "style", "className"];
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import classNames from "clsx";
import React, { useState, useRef, useEffect } from "react";
import { getPrefixCls } from "../../utils/class";
var ModalWrapper = function ModalWrapper(props) {
  var _props$visible = props.visible,
    visible = _props$visible === void 0 ? false : _props$visible,
    afterClose = props.afterClose,
    _props$maskClosable = props.maskClosable,
    maskClosable = _props$maskClosable === void 0 ? true : _props$maskClosable,
    onClose = props.onClose,
    children = props.children,
    style = props.style,
    className = props.className,
    rest = _objectWithoutPropertiesLoose(props, _excluded);
  var _useState = useState(visible),
    animatedVisible = _useState[0],
    setAnimatedVisible = _useState[1];
  var wrapperRef = useRef();
  var contentClickRef = useRef(false);
  var contentTimeoutRef = useRef();
  useEffect(function () {
    var pageElement = document.querySelector(".zaui-page");
    if (visible) {
      if (pageElement) {
        pageElement.classList.add("disable-scrolling");
      }
      setAnimatedVisible(true);
    } else if (pageElement) {
      pageElement.classList.remove("disable-scrolling");
    }
  }, [visible]);
  var onVisibleChange = function onVisibleChange(newVisible) {
    if (!newVisible) {
      setAnimatedVisible(false);
      afterClose == null || afterClose();
    }
  };
  var onContentMouseDown = function onContentMouseDown() {
    clearTimeout(contentTimeoutRef.current);
    contentClickRef.current = true;
  };
  var onContentMouseUp = function onContentMouseUp() {
    contentTimeoutRef.current = setTimeout(function () {
      contentClickRef.current = false;
    });
  };
  var onWrapperClick = function onWrapperClick(e) {
    if (!maskClosable) {
      return;
    }
    if (contentClickRef.current) {
      contentClickRef.current = false;
    } else if (wrapperRef.current === e.target) {
      onClose == null || onClose(e);
    }
  };
  var prefixCls = getPrefixCls("modal-wrapper");
  var cls = classNames(prefixCls, className);
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    ref: wrapperRef,
    onClick: onWrapperClick,
    style: _objectSpread({
      display: !animatedVisible ? "none" : undefined
    }, style || {}),
    className: cls,
    role: "presentation"
  }), /*#__PURE__*/React.cloneElement(children, {
    onMouseDown: onContentMouseDown,
    onMouseUp: onContentMouseUp,
    onVisibleChanged: onVisibleChange
  }));
};
export default ModalWrapper;