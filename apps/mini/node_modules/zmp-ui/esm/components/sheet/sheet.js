import _extends from "@babel/runtime/helpers/extends";
import React, { useState, useEffect, useImperativeHandle, useRef } from "react";
import classNames from "clsx";
import ModalWrapper from "../../common/modal-wrapper";
import { getPrefixCls } from "../../utils/class";
import Content from "./content";
import Mask from "../../common/modal-mask";
var Sheet = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var className = props.className,
    maskClosable = props.maskClosable,
    _props$visible = props.visible,
    visible = _props$visible === void 0 ? false : _props$visible,
    maskStyle = props.maskStyle,
    _props$mask = props.mask,
    mask = _props$mask === void 0 ? true : _props$mask,
    maskClassName = props.maskClassName,
    onClose = props.onClose,
    afterClose = props.afterClose,
    zIndex = props.zIndex,
    contentRef = props.contentRef,
    unmountOnClose = props.unmountOnClose;
  var _useState = useState(false),
    animatedVisible = _useState[0],
    setAnimatedVisible = _useState[1];
  var _useState2 = useState(!unmountOnClose),
    contentVisible = _useState2[0],
    setContentVisible = _useState2[1];
  var sheetRef = useRef(null);
  useImperativeHandle(contentRef, function () {
    var _sheetRef$current;
    return (_sheetRef$current = sheetRef.current) == null ? void 0 : _sheetRef$current.sheet;
  });
  useImperativeHandle(ref, function () {
    var _sheetRef$current2, _sheetRef$current3;
    return {
      sheet: (_sheetRef$current2 = sheetRef.current) == null ? void 0 : _sheetRef$current2.sheet,
      snapTo: (_sheetRef$current3 = sheetRef.current) == null ? void 0 : _sheetRef$current3.snapTo
    };
  });
  useEffect(function () {
    if (visible && unmountOnClose) {
      setContentVisible(true);
    }
    setAnimatedVisible(visible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  var prefixCls = getPrefixCls("sheet");
  var cls = classNames(prefixCls, {}, className);
  var handleAfterClose = function handleAfterClose() {
    if (unmountOnClose) {
      setContentVisible(false);
    }
    afterClose == null || afterClose();
  };
  if (!contentVisible && unmountOnClose) {
    return null;
  }
  return /*#__PURE__*/React.createElement("div", {
    className: cls
  }, mask && /*#__PURE__*/React.createElement(Mask, {
    visible: animatedVisible,
    style: maskStyle,
    className: maskClassName
  }), /*#__PURE__*/React.createElement(ModalWrapper, {
    maskClosable: maskClosable,
    visible: animatedVisible,
    onClose: onClose,
    afterClose: handleAfterClose,
    className: prefixCls + "-wrapper",
    style: {
      zIndex: zIndex
    }
  }, /*#__PURE__*/React.createElement(Content, _extends({}, props, {
    visible: animatedVisible,
    ref: sheetRef
  }))));
});
export default Sheet;