import React from "react";
import Trigger from "../trigger";
var PickerTrigger = function PickerTrigger(props) {
  var children = props.children,
    popupElement = props.popupElement,
    onVisibilityChange = props.onVisibilityChange,
    defaultOpen = props.defaultOpen,
    visible = props.visible,
    mask = props.mask,
    maskClosable = props.maskClosable;
  return /*#__PURE__*/React.createElement(Trigger, {
    action: "click",
    popup: popupElement,
    defaultPopupVisible: defaultOpen,
    popupVisible: visible,
    mask: mask,
    maskClosable: maskClosable,
    onPopupVisibleChange: onVisibilityChange
  }, children);
};
export default PickerTrigger;