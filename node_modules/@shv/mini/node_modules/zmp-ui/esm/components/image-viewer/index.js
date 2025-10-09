import _extends from "@babel/runtime/helpers/extends";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["images", "visible", "onClose", "activeIndex", "maskStyle", "maskClassName"];
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import classNames from "clsx";
import { animated, useSpring, useTransition } from "@react-spring/web";
import { useDrag } from "@use-gesture/react";
import Image from "./Image";
import { getPrefixCls } from "../../utils/class";
import Mask from "../../common/modal-mask";
import { ImageViewerContext } from "./context";
import Button from "../button";
import Icon from "../icon";
var ImageViewer = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var images = props.images,
    visible = props.visible,
    onClose = props.onClose,
    defaultActiveIndex = props.activeIndex,
    maskStyle = props.maskStyle,
    maskClassName = props.maskClassName,
    rest = _objectWithoutPropertiesLoose(props, _excluded);
  var _useState = useState(false),
    isZoomed = _useState[0],
    setIsZoomed = _useState[1];
  var _useState2 = useState(defaultActiveIndex || 0),
    activeIndex = _useState2[0],
    setActiveIndex = _useState2[1];
  var force = useRef(false);
  var prevActiveIndex = useRef(defaultActiveIndex || 0);
  var _useState3 = useState(!!visible),
    animationVisible = _useState3[0],
    setAnimationVisible = _useState3[1];
  var _useState4 = useState(true),
    showHeader = _useState4[0],
    setShowHeader = _useState4[1];
  var prefixCls = getPrefixCls("image-viewer");
  var cls = classNames(prefixCls);
  var contextValue = useMemo(function () {
    return {
      isZoomed: isZoomed,
      setIsZoomed: setIsZoomed,
      currentIndex: activeIndex,
      showHeader: showHeader,
      setShowHeader: setShowHeader
    };
  }, [isZoomed, activeIndex, showHeader]);
  var style = useSpring({
    scale: visible ? 1 : 0.5,
    opacity: visible ? 1 : 0.5,
    config: {
      duration: 200
    },
    onRest: function onRest() {
      if (!visible) {
        setAnimationVisible(false);
      }
    }
  });
  var transitions = useTransition(activeIndex, {
    key: activeIndex,
    from: {
      opacity: 0,
      transform: activeIndex < prevActiveIndex.current ? "translate3d(-50%,0,0)" : "translate3d(50%,0,0)"
    },
    enter: {
      opacity: 1,
      transform: "translate3d(0%,0,0)",
      onRest: function onRest() {
        prevActiveIndex.current = activeIndex;
        force.current = false;
      },
      config: {
        duration: force.current ? 0 : 300
      }
    },
    leave: {
      opacity: 0,
      transform: activeIndex < prevActiveIndex.current ? "translate3d(50%,0,0)" : "translate3d(-50%,0,0)",
      config: {
        duration: force.current ? 0 : 200
      }
    },
    exitBeforeEnter: true
  });
  var bind = useDrag(function (_ref) {
    var isDown = _ref.down,
      _ref$movement = _ref.movement,
      mx = _ref$movement[0];
    if (isZoomed) {
      return;
    }
    var totalImages = images.length;
    if (mx > 0 && activeIndex === 0) {
      return;
    }
    if (mx < 0 && activeIndex >= totalImages - 1) {
      return;
    }
    if (!isDown && Math.abs(mx) > 100) {
      if (mx > 0) {
        setActiveIndex(activeIndex - 1);
      } else {
        setActiveIndex(activeIndex + 1);
      }
    }
  }, {
    filterTaps: true
  });
  useLayoutEffect(function () {
    if (visible) {
      if (defaultActiveIndex !== prevActiveIndex.current) {
        force.current = true;
      }
      if (!Number.isNaN(defaultActiveIndex)) {
        setActiveIndex(defaultActiveIndex || 0);
      }
      setAnimationVisible(visible);
    }
  }, [visible]);
  var goToNextImage = function goToNextImage() {
    setActiveIndex(function (curIndex) {
      return Math.min(curIndex + 1, images.length);
    });
  };
  var goToPrevImage = function goToPrevImage() {
    setActiveIndex(function (curIndex) {
      return Math.max(curIndex - 1, 0);
    });
  };
  return /*#__PURE__*/React.createElement(ImageViewerContext.Provider, {
    value: contextValue
  }, /*#__PURE__*/React.createElement("div", _extends({
    className: cls,
    ref: ref
  }, rest), /*#__PURE__*/React.createElement(Mask, {
    visible: visible,
    style: maskStyle,
    className: maskClassName
  }), visible && showHeader && /*#__PURE__*/React.createElement("div", {
    className: prefixCls + "-header"
  }, /*#__PURE__*/React.createElement("span", {
    role: "presentation",
    className: prefixCls + "-close-button",
    onClick: onClose
  }, "\u0110\xF3ng")), /*#__PURE__*/React.createElement(animated.div, {
    style: _objectSpread({
      display: animationVisible ? "block" : "none"
    }, style),
    className: prefixCls + "-container"
  }, animationVisible && showHeader && images.length > 1 && !isZoomed && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
    disabled: activeIndex === 0,
    icon: /*#__PURE__*/React.createElement(Icon, {
      icon: "zi-chevron-left"
    }),
    className: prefixCls + "-nav-btn " + prefixCls + "-nav-btn-prev",
    size: "small",
    onClick: goToPrevImage
  }), /*#__PURE__*/React.createElement(Button, {
    disabled: activeIndex === images.length - 1,
    icon: /*#__PURE__*/React.createElement(Icon, {
      icon: "zi-chevron-right"
    }),
    className: prefixCls + "-nav-btn " + prefixCls + "-nav-btn-next",
    size: "small",
    onClick: goToNextImage
  })), animationVisible && transitions(function (transition, i) {
    return /*#__PURE__*/React.createElement(animated.div, _extends({
      className: prefixCls + "-images",
      style: _objectSpread({
        width: "100%",
        height: "100%"
      }, transition)
    }, bind()), images[i] && /*#__PURE__*/React.createElement(Image, {
      src: images[i].src,
      alt: images[i].alt
    }));
  }))));
});
export default ImageViewer;