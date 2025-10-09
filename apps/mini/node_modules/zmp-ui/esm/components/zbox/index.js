import _extends from "@babel/runtime/helpers/extends";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["id", "children", "className", "style", "padding", "borderWidth", "invert"];
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React, { useEffect, useImperativeHandle, useRef } from "react";
import classNames from "clsx";
import { getPrefixCls } from "../../utils/class";

/**
 * A custom element for generic boxes/containers
 * @category Layout
 * @subcategory ZBox
 * @component
 *
 * @example
import React from "react";
import { Page, ZBox, Text } from "zmp-ui";

function HomePage(props){
    return (
        <Page>
            <ZBox padding="1rem" borderWidth="1rem">
                <Text>Header</Text>
            </ZBox>
        </Page>
    );
}
 */
var ZBox = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var id = props.id,
    children = props.children,
    className = props.className,
    style = props.style,
    _props$padding = props.padding,
    padding = _props$padding === void 0 ? "var(--s1)" : _props$padding,
    _props$borderWidth = props.borderWidth,
    borderWidth = _props$borderWidth === void 0 ? "var(--border-thin)" : _props$borderWidth,
    _props$invert = props.invert,
    invert = _props$invert === void 0 ? false : _props$invert,
    rest = _objectWithoutPropertiesLoose(props, _excluded);
  var prefixCls = getPrefixCls("zbox");
  var classes = classNames(prefixCls, className);
  var zBoxStyle = _objectSpread({}, style || {});
  var elementRef = useRef(null);
  useImperativeHandle(ref, function () {
    return {
      layout: elementRef.current
    };
  });
  useEffect(function () {
    var render = function render() {
      if (elementRef.current) {
        var i = "ZBox-" + [padding, borderWidth, invert].join("");
        elementRef.current.dataset.i = i;
        if (!document.getElementById(i)) {
          var styleEl = document.createElement("style");
          styleEl.id = i;
          styleEl.innerHTML = ("\n                    [data-i=\"" + i + "\"] {\n                        padding: " + padding + ";\n                        border: " + borderWidth + " solid;\n                        " + (invert ? "background-color: var(--color-light);\n                          filter: invert(100%);" : "") + "\n                      }\n                  \n                      [data-i=\"" + i + "\"] {\n                        background-color: inherit;\n                      }").replace(/\s\s+/g, " ").trim();
          document.head.appendChild(styleEl);
        }
      }
    };
    render();
  }, [padding, borderWidth, invert]);
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    ref: elementRef,
    id: id,
    style: zBoxStyle,
    className: classes
  }), children);
});
export default ZBox;