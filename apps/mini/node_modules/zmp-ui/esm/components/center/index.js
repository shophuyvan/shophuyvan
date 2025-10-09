import _extends from "@babel/runtime/helpers/extends";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["id", "children", "className", "style", "max", "andText", "gutters", "intrinsic"];
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React, { useEffect, useImperativeHandle, useRef } from "react";
import classNames from "clsx";
import { getPrefixCls } from "../../utils/class";

/**
 * A custom element for centering a block-level element horizontally,
 * with a max-width value representing the typographic measure
 * @category Layout
 * @subcategory Center
 * @component
 *
 * @example
import React from "react";
import { Page, Center, Text } from "zmp-ui";

function HomePage(props){
    return (
        <Page>
            <Center>
                <Text>Header</Text>
            </Center>
        </Page>
    );
}
 */
var Center = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var id = props.id,
    children = props.children,
    className = props.className,
    style = props.style,
    _props$max = props.max,
    max = _props$max === void 0 ? "var(--measure)" : _props$max,
    _props$andText = props.andText,
    andText = _props$andText === void 0 ? false : _props$andText,
    gutters = props.gutters,
    _props$intrinsic = props.intrinsic,
    intrinsic = _props$intrinsic === void 0 ? false : _props$intrinsic,
    rest = _objectWithoutPropertiesLoose(props, _excluded);
  var prefixCls = getPrefixCls("center");
  var classes = classNames(prefixCls, className);
  var centerStyle = _objectSpread({}, style || {});
  var elementRef = useRef(null);
  useImperativeHandle(ref, function () {
    return {
      layout: elementRef.current
    };
  });
  useEffect(function () {
    var render = function render() {
      if (elementRef.current) {
        var i = "Center-" + [max, andText, gutters, intrinsic].join("");
        elementRef.current.dataset.i = i;
        if (!document.getElementById(i)) {
          var styleEl = document.createElement("style");
          styleEl.id = i;
          styleEl.innerHTML = ("\n                    [data-i=\"" + i + "\"] {\n                        max-width: " + max + ";\n                        " + (gutters ? "\n                        padding-inline-start: " + gutters + ";\n                        padding-inline-end: " + gutters + ";" : "") + "\n                        " + (andText ? "text-align: center;" : "") + "\n                        " + (intrinsic ? "\n                        display: flex;\n                        flex-direction: column;\n                        align-items: center;" : "") + "\n                      }").replace(/\s\s+/g, " ").trim();
          document.head.appendChild(styleEl);
        }
      }
    };
    render();
  }, [max, andText, gutters, intrinsic]);
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    ref: elementRef,
    id: id,
    style: centerStyle,
    className: classes
  }), children);
});
export default Center;