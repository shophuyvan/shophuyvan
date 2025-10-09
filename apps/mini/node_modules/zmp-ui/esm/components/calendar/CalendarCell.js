import React from "react";
import classNames from "clsx";
import { getPrefixCls } from "../../utils/class";
var CalendarCell = function CalendarCell(props) {
  var label = props.label,
    content = props.content;
  var prefixCls = getPrefixCls("calendar-cell-inner");
  var classes = classNames(prefixCls);
  return /*#__PURE__*/React.createElement("div", {
    className: classes
  }, /*#__PURE__*/React.createElement("div", {
    className: prefixCls + "-label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: prefixCls + "-content"
  }, content));
};
export default CalendarCell;