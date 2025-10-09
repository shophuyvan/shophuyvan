import clsx from "clsx";
import React from "react";
import { getPrefixCls } from "../../utils/class";
import Mark from "./Mark";
var Track = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var children = props.children,
    offset = props.offset,
    width = props.width,
    marks = props.marks,
    onMouseLeave = props.onMouseLeave,
    onMouseEnter = props.onMouseEnter;
  var prefixCls = getPrefixCls("slider-track");
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    className: clsx(prefixCls),
    onMouseLeave: onMouseLeave,
    onMouseEnter: onMouseEnter
  }, /*#__PURE__*/React.createElement("div", {
    className: clsx(prefixCls + "-bar"),
    style: {
      left: offset + "%",
      width: width + "%"
    }
  }), marks && Array.isArray(marks) && marks.map(function (mark) {
    return /*#__PURE__*/React.createElement(Mark, {
      key: mark,
      position: mark,
      filled: mark >= offset && mark <= width + offset
    });
  }), children);
});
export default Track;