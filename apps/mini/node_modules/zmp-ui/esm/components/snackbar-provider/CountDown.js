import React, { useEffect, useState } from "react";
import { getPrefixCls } from "../../utils/class";
import { DEFAULT_COUNTDOWN_DURATION, COUNTDOWN_RADIUS, COUNTDOWN_STROKE_WIDTH } from "./common/constants";
var CountDown = function CountDown(_ref) {
  var _ref$duration = _ref.duration,
    duration = _ref$duration === void 0 ? DEFAULT_COUNTDOWN_DURATION : _ref$duration;
  var prefixCls = getPrefixCls("snackbar-countdown");
  var maxCount = duration / 1000;
  var _useState = useState(maxCount),
    current = _useState[0],
    setCurrent = _useState[1];
  var strokeWidth = COUNTDOWN_STROKE_WIDTH;
  var radius = COUNTDOWN_RADIUS - strokeWidth / 2;
  var width = COUNTDOWN_RADIUS * 2;
  var height = COUNTDOWN_RADIUS * 2;
  var viewBox = "0 0 " + width + " " + height;
  var dashArray = radius * Math.PI * 2;
  var percentage = current / maxCount * 100;
  var dashOffset = dashArray - dashArray * percentage / 100;
  useEffect(function () {
    var timmer = setInterval(function () {
      if (current > 0) {
        setCurrent(function (cur) {
          return cur - 1;
        });
      } else {
        clearInterval(timmer);
      }
    }, 1000);
    return function () {
      return clearInterval(timmer);
    };
  }, [current]);
  return /*#__PURE__*/React.createElement("div", {
    className: prefixCls
  }, /*#__PURE__*/React.createElement("svg", {
    className: prefixCls + "-circle",
    width: COUNTDOWN_RADIUS * 2,
    height: COUNTDOWN_RADIUS * 2,
    viewBox: viewBox
  }, /*#__PURE__*/React.createElement("circle", {
    className: prefixCls + "-background",
    cx: COUNTDOWN_RADIUS,
    cy: COUNTDOWN_RADIUS,
    r: radius,
    strokeWidth: strokeWidth + "px"
  }), /*#__PURE__*/React.createElement("circle", {
    className: prefixCls + "-progress",
    cx: COUNTDOWN_RADIUS,
    cy: COUNTDOWN_RADIUS,
    r: radius,
    strokeWidth: strokeWidth + "px",
    style: {
      strokeDasharray: dashArray,
      strokeDashoffset: dashOffset
    },
    transform: "rotate(-90)"
  }), /*#__PURE__*/React.createElement("text", {
    className: prefixCls + "-counter",
    x: COUNTDOWN_RADIUS,
    y: radius,
    dy: ".4em",
    textAnchor: "middle"
  }, current)));
};
export default CountDown;