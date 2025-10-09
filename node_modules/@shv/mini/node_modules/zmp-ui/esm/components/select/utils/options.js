import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["children", "value"],
  _excluded2 = ["children"];
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import * as React from "react";
import { toArray } from "../../../utils/childrens";
function convertNodeToOption(node) {
  var _ref = node,
    key = _ref.key,
    _ref$props = _ref.props,
    children = _ref$props.children,
    value = _ref$props.value,
    restProps = _objectWithoutPropertiesLoose(_ref$props, _excluded);
  return _objectSpread({
    key: key,
    value: value !== undefined ? value : key,
    children: children
  }, restProps);
}
export function convertChildrenToData(nodes, optionOnly) {
  if (optionOnly === void 0) {
    optionOnly = false;
  }
  return toArray(nodes).map(function (node, index) {
    if (! /*#__PURE__*/React.isValidElement(node) || !node.type) {
      return null;
    }
    var _ref2 = node,
      isSelectOptGroup = _ref2.type.isSelectOptGroup,
      key = _ref2.key,
      _ref2$props = _ref2.props,
      children = _ref2$props.children,
      restProps = _objectWithoutPropertiesLoose(_ref2$props, _excluded2);
    if (optionOnly || !isSelectOptGroup) {
      return convertNodeToOption(node);
    }
    return _objectSpread(_objectSpread({
      key: "__ZAUI_SELECT_GRP__" + (key === null ? index : key) + "__",
      label: key
    }, restProps), {}, {
      options: convertChildrenToData(children)
    });
  }).filter(function (data) {
    return data !== null;
  });
}
function getKey(data, index) {
  var key = data.key;
  var value = data.value;
  if (key !== null && key !== undefined) {
    return key;
  }
  if (value !== undefined) {
    return value;
  }
  return "zaui-index-key-" + index;
}
export function flattenOptions(options) {
  var flattenList = [];
  function dig(list, isGroupOption) {
    list.forEach(function (data) {
      var label = data.label;
      if (isGroupOption || !("options" in data)) {
        var value = data.value;
        flattenList.push({
          key: getKey(data, flattenList.length),
          groupOption: isGroupOption,
          data: data,
          label: data.title,
          value: value
        });
      } else {
        flattenList.push({
          key: getKey(data, flattenList.length),
          group: true,
          data: data,
          label: label
        });
        dig(data.options, true);
      }
    });
  }
  dig(options, false);
  return flattenList;
}