import _extends from "@babel/runtime/helpers/extends";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["className", "visibilityToggle"];
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React, { useState } from "react";
import classNames from "clsx";
import EyeIcon from "./icons/eye";
import EyeInvisibleIcon from "./icons/eye-invisible";
import Input from "./Input";
import { getPrefixCls } from "../../utils/class";
import omit from "../../utils/omit";
var Password = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var _useState = useState(false),
    visible = _useState[0],
    setVisible = _useState[1];
  var onVisibleChange = function onVisibleChange() {
    var disabled = props.disabled;
    if (disabled) {
      return;
    }
    setVisible(!visible);
  };
  var getIcon = function getIcon(prefixCls) {
    var _props$iconRender = props.iconRender,
      iconRender = _props$iconRender === void 0 ? function () {
        return null;
      } : _props$iconRender;
    var icon = iconRender(visible);
    var iconProps = {
      onClick: onVisibleChange,
      className: prefixCls + "-icon",
      key: "passwordIcon",
      onMouseDown: function onMouseDown(e) {
        e.preventDefault();
      },
      onMouseUp: function onMouseUp(e) {
        e.preventDefault();
      }
    };
    return /*#__PURE__*/React.cloneElement( /*#__PURE__*/React.isValidElement(icon) ? icon : /*#__PURE__*/React.createElement("span", null, icon), iconProps);
  };
  var renderPassword = function renderPassword() {
    var className = props.className,
      visibilityToggle = props.visibilityToggle,
      restProps = _objectWithoutPropertiesLoose(props, _excluded);
    var prefixCls = getPrefixCls("input-password");
    var suffixIcon = visibilityToggle && getIcon(prefixCls);
    var inputClassName = classNames(prefixCls, className);
    var omittedProps = _objectSpread(_objectSpread({}, omit(restProps, ["suffix", "iconRender"])), {}, {
      type: visible ? "text" : "password",
      className: inputClassName,
      suffix: suffixIcon
    });
    return /*#__PURE__*/React.createElement(Input, _extends({
      ref: ref
    }, omittedProps));
  };
  return renderPassword();
});
Password.defaultProps = {
  visibilityToggle: true,
  iconRender: function iconRender(visible) {
    return visible ? /*#__PURE__*/React.createElement(EyeIcon, null) : /*#__PURE__*/React.createElement(EyeInvisibleIcon, null);
  }
};
export default Password;