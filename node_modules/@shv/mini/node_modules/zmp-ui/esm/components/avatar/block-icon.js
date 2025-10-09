import React from "react";
import { getPrefixCls } from "../../utils/class";
var BlockedIcon = function BlockedIcon() {
  var prefixCls = getPrefixCls("avatar-block-icon-bg");
  return /*#__PURE__*/React.createElement("svg", {
    xmlns: "http://www.w3.org/2000/svg",
    width: "12",
    height: "12",
    viewBox: "0 0 12 12",
    fill: "none"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "12",
    height: "12",
    rx: "6",
    fill: "#DC1F18"
  }), /*#__PURE__*/React.createElement("path", {
    className: prefixCls,
    fillRule: "evenodd",
    clipRule: "evenodd",
    d: "M6 10.5C8.48528 10.5 10.5 8.48528 10.5 6C10.5 5.07331 10.2199 4.21205 9.73972 3.49626C9.63951 3.34688 9.429 3.33467 9.30181 3.46186L3.46186 9.30181C3.33467 9.429 3.34688 9.63951 3.49626 9.73972C4.21205 10.2199 5.07331 10.5 6 10.5ZM2.26028 8.50374C2.36048 8.65312 2.57099 8.66532 2.69819 8.53813L8.53813 2.69819C8.66533 2.57099 8.65312 2.36048 8.50374 2.26028C7.78795 1.78011 6.92668 1.5 6 1.5C3.51472 1.5 1.5 3.51472 1.5 6C1.5 6.92668 1.78011 7.78795 2.26028 8.50374Z",
    fill: "white"
  }));
};
export default BlockedIcon;