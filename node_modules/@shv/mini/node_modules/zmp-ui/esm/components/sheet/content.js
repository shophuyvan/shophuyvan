import _extends from "@babel/runtime/helpers/extends";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { useDrag } from "@use-gesture/react";
import classNames from "clsx";
import { animated, config, to, useSpring } from "@react-spring/web";
import { getPrefixCls } from "../../utils/class";
import { ANIMATION_DURATION, DRAG_THRESHOLD } from "./utils/constants";
import useElementSize from "./hooks/useElementSize";
var Content = /*#__PURE__*/forwardRef(function (props, ref) {
  var _classNames;
  var title = props.title,
    visible = props.visible,
    onVisibleChanged = props.onVisibleChanged,
    _props$handler = props.handler,
    handler = _props$handler === void 0 ? true : _props$handler,
    children = props.children,
    _props$autoHeight = props.autoHeight,
    autoHeight = _props$autoHeight === void 0 ? false : _props$autoHeight,
    contentRef = props.contentRef,
    onClose = props.onClose,
    swipeToClose = props.swipeToClose,
    style = props.style,
    height = props.height,
    snapPoints = props.snapPoints,
    _props$defaultSnapPoi = props.defaultSnapPoint,
    defaultSnapPoint = _props$defaultSnapPoi === void 0 ? 0 : _props$defaultSnapPoi,
    onSnap = props.onSnap;
  var handlerRef = useRef();
  var _useState = useState(defaultSnapPoint),
    currentSnapPoint = _useState[0],
    setCurrentSnapPoint = _useState[1];
  var sheetRef = useRef();
  var sheetHeight = useElementSize({
    ref: sheetRef
  });
  var _useState2 = useState({
      movement: [0, 0],
      down: false,
      first: false,
      vy: 0
    }),
    state = _useState2[0],
    set = _useState2[1];
  var getSnapPoints = function getSnapPoints() {
    if (!snapPoints) return undefined;
    if (!sheetHeight) return undefined;
    if (typeof snapPoints === "function") {
      return snapPoints({
        sheetModalHeight: sheetHeight
      });
    }
    return snapPoints.map(function (item) {
      return item * sheetHeight;
    });
  };
  var sheetSnapPoints = getSnapPoints();
  var prevVisible = useRef(false);
  var prefixCls = getPrefixCls("sheet-content");
  useImperativeHandle(contentRef, function () {
    return sheetRef.current;
  });
  var down = state.down,
    movement = state.movement,
    vy = state.vy;
  var getDuration = function getDuration(_ref) {
    var isVisible = _ref.visible,
      points = _ref.points,
      currentPoint = _ref.currentPoint,
      isDragging = _ref.down;
    if (isDragging) return 0;
    return !isVisible || !points || currentPoint === points.length - 1 ? ANIMATION_DURATION : undefined;
  };
  var animationConfig = _objectSpread(_objectSpread({}, config.stiff), {}, {
    duration: getDuration({
      visible: visible,
      points: sheetSnapPoints,
      currentPoint: currentSnapPoint,
      down: down
    }),
    velocity: vy
  });
  var _useSpring = useSpring(function () {
      return {
        transformAmount: sheetHeight || window.innerHeight,
        movingAmount: 0,
        config: _objectSpread({}, animationConfig)
      };
    }),
    _useSpring$ = _useSpring[0],
    transformAmount = _useSpring$.transformAmount,
    movingAmount = _useSpring$.movingAmount,
    api = _useSpring[1];
  var snapTo = function snapTo(point) {
    setCurrentSnapPoint(point);
  };
  var cls = classNames(prefixCls, (_classNames = {}, _classNames[prefixCls + "-hug-content"] = autoHeight, _classNames));
  useImperativeHandle(ref, function () {
    return {
      sheet: sheetRef.current,
      snapTo: snapTo
    };
  });
  useEffect(function () {
    if (down) {
      return;
    }
    if (visible && sheetSnapPoints) {
      api.start({
        transformAmount: sheetSnapPoints[currentSnapPoint || 0],
        movingAmount: 0
      });
    } else if (visible && sheetHeight) {
      api.start({
        transformAmount: 0,
        movingAmount: 0
      });
    } else if (!visible) {
      api.start({
        transformAmount: sheetHeight || window.innerHeight,
        movingAmount: 0
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, currentSnapPoint, sheetHeight]);
  useLayoutEffect(function () {
    if (prevVisible.current) {
      setTimeout(function () {
        onVisibleChanged == null || onVisibleChanged(!!visible);
      }, ANIMATION_DURATION);
    }
    if (!visible && sheetSnapPoints && sheetSnapPoints.length && currentSnapPoint !== defaultSnapPoint) {
      setCurrentSnapPoint(defaultSnapPoint);
    }
    prevVisible.current = !!visible;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, onVisibleChanged]);
  useEffect(function () {
    if (down) {
      api.set({
        movingAmount: movement[1]
      });
    }
  }, [down, movement, api]);
  var handlerDrag = function handlerDrag(_ref2) {
    var isDragging = _ref2.down,
      first = _ref2.first,
      _ref2$velocity = _ref2.velocity,
      _vy = _ref2$velocity[1],
      movementValues = _ref2.movement,
      event = _ref2.event,
      memo = _ref2.memo;
    set({
      down: isDragging,
      movement: movementValues,
      first: first,
      vy: _vy
    });
    if (isDragging) return movementValues[1];
    var my = movementValues[1];
    if (memo && memo < 0 && !my) {
      my = memo;
    }
    if (my < 0 && my < -DRAG_THRESHOLD && sheetSnapPoints) {
      if (currentSnapPoint < sheetSnapPoints.length - 1) {
        onSnap == null || onSnap(currentSnapPoint + 1);
        setCurrentSnapPoint(currentSnapPoint + 1);
      } else if (!sheetSnapPoints) {
        api.start({
          transformAmount: 0,
          movingAmount: 0
        });
      }
      return my;
    }
    if (my > 0 && my > DRAG_THRESHOLD) {
      if (sheetSnapPoints && currentSnapPoint > 0) {
        onSnap == null || onSnap(currentSnapPoint - 1);
        setCurrentSnapPoint(currentSnapPoint - 1);
      } else {
        onClose == null || onClose(event);
      }
      return my;
    }
    if (sheetSnapPoints) {
      api.start({
        transformAmount: sheetSnapPoints[currentSnapPoint],
        movingAmount: 0
      });
    } else {
      api.start({
        transformAmount: 0,
        movingAmount: 0
      });
    }
    return my;
  };
  var bind = useDrag(handlerDrag, {
    filterTaps: true
  });
  var transform = to([transformAmount, movingAmount], function (amount, moving) {
    if (amount + moving < 0) return "";
    return "translateY(" + (amount + moving) + "px)";
  });
  var header = /*#__PURE__*/React.createElement("div", {
    className: prefixCls + "-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: prefixCls + "-title"
  }, title));
  var handlerEl = /*#__PURE__*/React.createElement("div", _extends({
    ref: handlerRef,
    className: prefixCls + "-handler-wrapper"
  }, bind()), /*#__PURE__*/React.createElement("span", {
    className: prefixCls + "-handler"
  }));
  var modalStyle = _objectSpread({}, style || {});
  if (height) {
    modalStyle.height = height;
  }
  return /*#__PURE__*/React.createElement(animated.div, _extends({
    style: _objectSpread(_objectSpread({}, modalStyle), {}, {
      transform: transform
    })
  }, !handler && (swipeToClose || sheetSnapPoints) ? bind() : {}, {
    className: cls,
    ref: sheetRef
  }), handler && handlerEl, title && header, children);
});
export default Content;