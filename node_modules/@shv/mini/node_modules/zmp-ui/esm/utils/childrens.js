import React from "react";
import { isFragment } from "react-is";
export var toArray = function toArray(children, option) {
  if (option === void 0) {
    option = {};
  }
  var ret = [];
  React.Children.forEach(children, function (child) {
    if ((child === undefined || child === null) && !option.keepEmpty) {
      return;
    }
    if (Array.isArray(child)) {
      ret = ret.concat(toArray(child));
    } else if (isFragment(child) && child.props) {
      ret = ret.concat(toArray(child.props.children, option));
    } else {
      ret.push(child);
    }
  });
  return ret;
};