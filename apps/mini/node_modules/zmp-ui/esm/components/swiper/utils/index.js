import _defineProperty from "@babel/runtime/helpers/defineProperty";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React from "react";
import { toArray } from "../../../utils/childrens";
export var getSlides = function getSlides(children, loop) {
  var slides = toArray(children).map(function (node, index) {
    if ( /*#__PURE__*/React.isValidElement(node)) {
      var key = node.key ? String(node.key) : index;
      return _objectSpread(_objectSpread({
        key: key
      }, node.props), {}, {
        node: node
      });
    }
    return null;
  }).filter(function (slide) {
    return slide;
  });
  if (loop) {
    var firstSlide = slides[0];
    var lastSlide = slides[slides.length - 1];
    if (firstSlide) {
      slides.push(_objectSpread(_objectSpread({}, firstSlide), {}, {
        key: firstSlide.key + "-clone"
      }));
    }
    if (lastSlide) {
      slides.unshift(_objectSpread(_objectSpread({}, lastSlide), {}, {
        key: (lastSlide == null ? void 0 : lastSlide.key) + "-clone"
      }));
    }
  }
  return slides;
};