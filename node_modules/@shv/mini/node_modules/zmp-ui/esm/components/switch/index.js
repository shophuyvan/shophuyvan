import _extends from "@babel/runtime/helpers/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["className", "wrapperClassName", "size", "label"];
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable @typescript-eslint/no-unused-vars */
import clsx from "clsx";
import React from "react";
import { getPrefixCls } from "../../utils/class";
/**
 * @category Data Entry
 * @subcategory Switch
 * @component
 *
 * @example
import React from "react";
import { Page, Switch } from "zmp-ui";

function HomePage(props){
    return (
        <Page>
            <Switch label="Label" />
        </Page>
    );
}
 */
var Switch = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var _clsx, _clsx2;
  var className = props.className,
    wrapperClassName = props.wrapperClassName,
    size = props.size,
    label = props.label,
    rest = _objectWithoutPropertiesLoose(props, _excluded);
  var prefixCls = getPrefixCls("switch");
  var Wrapper = label ? "label" : "div";
  return /*#__PURE__*/React.createElement(Wrapper, {
    className: clsx(prefixCls + "-wrapper")
  }, /*#__PURE__*/React.createElement("input", _extends({}, rest, {
    ref: ref,
    type: "checkbox",
    className: clsx(prefixCls, (_clsx = {}, _clsx[prefixCls + "-small"] = size === "small", _clsx), className)
  })), label && /*#__PURE__*/React.createElement("div", {
    className: clsx(prefixCls + "-label", (_clsx2 = {}, _clsx2[prefixCls + "-label-small"] = size === "small", _clsx2))
  }, label));
});
export default Switch;