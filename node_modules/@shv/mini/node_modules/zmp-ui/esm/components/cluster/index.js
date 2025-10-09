import _extends from "@babel/runtime/helpers/extends";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["id", "children", "className", "style", "justify", "align", "space"];
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React, { useEffect, useImperativeHandle, useRef } from "react";
import classNames from "clsx";
import { getPrefixCls } from "../../utils/class";

/**
 * A custom element for grouping items, with control over the margin between them
 * @category Layout
 * @subcategory Cluster
 * @component
 *
 * @example
import React from "react";
import { Page, Cluster, Text } from "zmp-ui";

function HomePage(props){
    return (
        <Page>
            <Cluster>
                <Text>Items 1</Text>
                <Text>Items 2</Text>
                <Text>Items 3</Text>
                <Text>Items 4</Text>
            </Cluster>
        </Page>
    );
}
 */
var Cluster = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var id = props.id,
    children = props.children,
    className = props.className,
    style = props.style,
    _props$justify = props.justify,
    justify = _props$justify === void 0 ? "flex-start" : _props$justify,
    _props$align = props.align,
    align = _props$align === void 0 ? "flex-start" : _props$align,
    _props$space = props.space,
    space = _props$space === void 0 ? "var(--s1)" : _props$space,
    rest = _objectWithoutPropertiesLoose(props, _excluded);
  var prefixCls = getPrefixCls("cluster");
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
        var i = "Cluster-" + [justify, align, space].join("");
        elementRef.current.dataset.i = i;
        if (!document.getElementById(i)) {
          var styleEl = document.createElement("style");
          styleEl.id = i;
          styleEl.innerHTML = ("\n                    [data-i=\"" + i + "\"] {\n                        justify-content: " + justify + ";\n                        align-items: " + align + ";\n                        gap: " + space + ";\n                      }").replace(/\s\s+/g, " ").trim();
          document.head.appendChild(styleEl);
        }
      }
    };
    render();
  }, [justify, align, space]);
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    ref: elementRef,
    id: id,
    style: centerStyle,
    className: classes
  }), children);
});
export default Cluster;