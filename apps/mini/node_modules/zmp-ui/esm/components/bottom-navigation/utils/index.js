import _defineProperty from "@babel/runtime/helpers/defineProperty";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React from "react";
import { toArray } from "../../../utils/childrens";
export var parseItemList = function parseItemList(children) {
  var tabs = toArray(children).map(function (node) {
    if ( /*#__PURE__*/React.isValidElement(node)) {
      var key = node.key !== undefined ? String(node.key) : undefined;
      return _objectSpread(_objectSpread({
        key: key
      }, node.props), {}, {
        node: node
      });
    }
    return null;
  }).filter(function (tab) {
    return tab;
  });
  return tabs;
};