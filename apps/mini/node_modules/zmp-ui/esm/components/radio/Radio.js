import _extends from "@babel/runtime/helpers/extends";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["className", "children", "style", "disabled", "size", "label", "defaultChecked"];
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React, { useContext, useState } from "react";
import classNames from "clsx";
import GroupContext from "./context";
import { getPrefixCls } from "../../utils/class";
var Radio = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var _classNames, _classNames2;
  var groupContext = useContext(GroupContext);
  var prefixCls = getPrefixCls("radio");
  var className = props.className,
    children = props.children,
    style = props.style,
    disabled = props.disabled,
    size = props.size,
    label = props.label,
    defaultChecked = props.defaultChecked,
    restProps = _objectWithoutPropertiesLoose(props, _excluded);
  var _useState = useState("checked" in restProps ? restProps.checked : defaultChecked),
    checked = _useState[0],
    setChecked = _useState[1];
  var radioProps = _objectSpread({}, restProps);
  radioProps.disabled = disabled;
  var onChange = function onChange(e) {
    if (!("checked" in radioProps)) {
      setChecked(e.target.checked);
    }
    props.onChange == null || props.onChange(e);
    groupContext == null || groupContext.onChange == null || groupContext.onChange(e);
  };
  if (groupContext) {
    var _props$value, _groupContext$value;
    radioProps.name = groupContext.name;
    radioProps.checked = ((_props$value = props.value) == null ? void 0 : _props$value.toString()) === ((_groupContext$value = groupContext.value) == null ? void 0 : _groupContext$value.toString());
    radioProps.disabled = radioProps.disabled || groupContext.disabled;
  }
  var radioSize = (groupContext == null ? void 0 : groupContext.size) || size;
  var inputChecked = radioProps.checked !== undefined ? radioProps.checked : checked;
  var wrapperCls = classNames(prefixCls + "-wrapper", (_classNames = {}, _classNames[prefixCls + "-" + radioSize] = radioSize, _classNames), className);
  var radioCls = classNames(prefixCls, (_classNames2 = {}, _classNames2[prefixCls + "-checked"] = inputChecked, _classNames2[prefixCls + "-disabled"] = radioProps.disabled, _classNames2));
  return (
    /*#__PURE__*/
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    React.createElement("label", {
      className: wrapperCls,
      style: style
    }, /*#__PURE__*/React.createElement("span", {
      className: radioCls
    }, /*#__PURE__*/React.createElement("input", _extends({}, radioProps, {
      checked: !!inputChecked,
      onChange: onChange,
      type: "radio",
      className: prefixCls + "-input",
      ref: ref
    })), /*#__PURE__*/React.createElement("span", {
      className: prefixCls + "-checkmark"
    })), children !== undefined ? /*#__PURE__*/React.createElement("span", null, children) : /*#__PURE__*/React.createElement("span", null, label))
  );
});
export default Radio;