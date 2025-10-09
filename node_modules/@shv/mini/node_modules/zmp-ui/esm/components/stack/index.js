import _extends from "@babel/runtime/helpers/extends";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["id", "children", "className", "style", "space", "recursive", "splitAfter"];
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React, { useEffect, useImperativeHandle, useRef } from "react";
import classNames from "clsx";
import { getPrefixCls } from "../../utils/class";

/**
 * A custom element for injecting white space (margin) between flow
 * (block) elements along a vertical axis.
 * @category Layout
 * @subcategory Stack
 * @component
 *
 * @example
import React from "react";
import { Page, Stack } from "zmp-ui";

function HomePage(props){
    return (
        <Page>
            <Stack space="1rem">
                <Button size="large">Button</Button>
            </Stack>
        </Page>
    );
}
 */
var Stack = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var id = props.id,
    children = props.children,
    className = props.className,
    style = props.style,
    _props$space = props.space,
    space = _props$space === void 0 ? "var(--s1)" : _props$space,
    _props$recursive = props.recursive,
    recursive = _props$recursive === void 0 ? false : _props$recursive,
    splitAfter = props.splitAfter,
    rest = _objectWithoutPropertiesLoose(props, _excluded);
  var prefixCls = getPrefixCls("stack");
  var classes = classNames(prefixCls, className);
  var stackStyle = _objectSpread({}, style || {});
  var elementRef = useRef(null);
  useImperativeHandle(ref, function () {
    return {
      layout: elementRef.current
    };
  });
  useEffect(function () {
    var render = function render() {
      if (elementRef.current) {
        var i = "Stack-" + [space, recursive, splitAfter].join("");
        elementRef.current.dataset.i = i;
        if (!document.getElementById(i)) {
          var styleEl = document.createElement("style");
          styleEl.id = i;
          styleEl.innerHTML = ("\n              [data-i=\"" + i + "\"]" + (recursive ? "" : " >") + " * + * {\n                margin-block-start: " + space + ";\n              }\n    \n              " + (splitAfter ? "\n                [data-i=\"" + i + "\"]:only-child {\n                  block-size: 100%;\n                }\n    \n                [data-i=\"" + i + "\"] > :nth-child(" + splitAfter + ") {\n                  margin-block-end: auto;\n                }" : "") + "\n            ").replace(/\s\s+/g, " ").trim();
          document.head.appendChild(styleEl);
        }
      }
    };
    render();
  }, [space, recursive, splitAfter]);
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    ref: elementRef,
    id: id,
    style: stackStyle,
    className: classes
  }), children);
});
export default Stack;