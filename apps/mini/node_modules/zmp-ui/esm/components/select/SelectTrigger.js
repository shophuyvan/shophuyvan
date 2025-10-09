import React from "react";
import Trigger from "../trigger";
var PickerTrigger = function PickerTrigger(props) {
  var children = props.children,
    popupElement = props.popupElement,
    _props$defaultOpen = props.defaultOpen,
    defaultOpen = _props$defaultOpen === void 0 ? false : _props$defaultOpen,
    visible = props.visible,
    onVisibilityChange = props.onVisibilityChange,
    mask = props.mask,
    maskCloseable = props.maskCloseable;
  return /*#__PURE__*/React.createElement(Trigger, {
    action: "click",
    defaultPopupVisible: defaultOpen,
    popupVisible: visible,
    onPopupVisibleChange: onVisibilityChange,
    popup: popupElement,
    mask: mask,
    maskClosable: maskCloseable
  }, children);
};
export default PickerTrigger;