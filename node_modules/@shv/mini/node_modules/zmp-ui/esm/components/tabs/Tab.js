import _defineProperty from "@babel/runtime/helpers/defineProperty";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React, { useEffect } from "react";
import classNames from "clsx";
import { getPrefixCls } from "../../utils/class";
var Tab = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var _classNames;
  var children = props.children,
    className = props.className,
    id = props.id,
    style = props.style,
    active = props.active,
    tabKey = props.tabKey,
    destroyInactiveTabPane = props.destroyInactiveTabPane;
  var _React$useState = React.useState(active),
    visited = _React$useState[0],
    setVisited = _React$useState[1];
  useEffect(function () {
    if (active) {
      setVisited(true);
    } else if (destroyInactiveTabPane) {
      setVisited(false);
    }
  }, [active, destroyInactiveTabPane]);
  var prefixCls = getPrefixCls("tab");
  var cls = classNames(prefixCls, (_classNames = {}, _classNames[prefixCls + "-active"] = active, _classNames), className);
  var mergedStyle = {};
  if (!active) {
    mergedStyle.display = "none";
  }
  return /*#__PURE__*/React.createElement("div", {
    id: id && id + "-tab-" + tabKey,
    role: "tabpanel",
    tabIndex: active ? 0 : -1,
    "aria-labelledby": id && id + "-tab-" + tabKey,
    "aria-hidden": !active,
    style: _objectSpread(_objectSpread({}, mergedStyle), style),
    ref: ref,
    className: cls
  }, (active || visited) && children);
});
export default Tab;