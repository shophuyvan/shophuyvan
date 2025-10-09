import _extends from "@babel/runtime/helpers/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["children", "style", "className"];
import React from "react";
import clsx from "clsx";
import { animated } from "@react-spring/web";
import { getPrefixCls } from "../../utils/class";
var SwiperSlide = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var children = props.children,
    _props$style = props.style,
    style = _props$style === void 0 ? {} : _props$style,
    className = props.className,
    restProps = _objectWithoutPropertiesLoose(props, _excluded);
  var prefixCls = getPrefixCls("swiper-item");
  var cls = clsx(prefixCls, className);
  return /*#__PURE__*/React.createElement(animated.div, _extends({}, restProps, {
    ref: ref,
    className: cls,
    style: style
  }), children);
});
SwiperSlide.defaultProps = {
  style: {}
};
export default SwiperSlide;