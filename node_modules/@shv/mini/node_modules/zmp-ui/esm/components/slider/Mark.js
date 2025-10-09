import clsx from "clsx";
import React from "react";
import { getPrefixCls } from "../../utils/class";
var Mark = function Mark(props) {
  var _clsx;
  var position = props.position,
    filled = props.filled;
  var prefixCls = getPrefixCls("slider-mark");
  return /*#__PURE__*/React.createElement("div", {
    className: clsx(prefixCls, (_clsx = {}, _clsx[prefixCls + "-filled"] = filled, _clsx)),
    style: {
      left: position + "%"
    }
  });
};
export default Mark;