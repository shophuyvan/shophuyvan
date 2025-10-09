import clsx from "clsx";
import React, { useContext } from "react";
import { getPrefixCls } from "../../utils/class";
import { SwiperContext } from "./context";
var SwiperDots = function SwiperDots() {
  var context = useContext(SwiperContext);
  var prefixCls = getPrefixCls("swiper-dots");
  var cls = clsx(prefixCls);
  var getDots = function getDots() {
    if (!context) return null;
    var slides = context.slides,
      activeIndex = context.activeIndex;
    return slides.map(function (slide, index) {
      var _clsx;
      var slideCls = clsx(prefixCls + "-item", (_clsx = {}, _clsx[prefixCls + "-item-active"] = activeIndex === index, _clsx));
      return /*#__PURE__*/React.createElement("div", {
        key: "dot-" + slide.key,
        className: slideCls
      });
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: cls
  }, getDots());
};
export default SwiperDots;