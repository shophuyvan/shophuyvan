import clsx from "clsx";
import React from "react";
import { getPrefixCls } from "../../utils/class";
var Thumb = function Thumb(props) {
  var position = props.position;
  var prefixCls = getPrefixCls("slider-thumb");
  return /*#__PURE__*/React.createElement("div", {
    className: clsx(prefixCls),
    style: {
      left: position + "%"
    }
  });
};
export default Thumb;