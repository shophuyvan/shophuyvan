import _extends from "@babel/runtime/helpers/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["linkTo", "onClick"];
import React, { useContext, useImperativeHandle, useRef } from "react";
import BottomNavigationItem from "./BottomNavigationItem";
import useNavigate from "../../hooks/useNavigate";
import { BottomNavigationContext } from "./context";
var AnimatedBottomNavigationItem = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var navigate = useNavigate();
  var context = useContext(BottomNavigationContext);
  var linkTo = props.linkTo,
    onClick = props.onClick,
    rest = _objectWithoutPropertiesLoose(props, _excluded);
  var itemRef = useRef(null);
  var handleClick = function handleClick(e) {
    if (onClick) {
      onClick == null || onClick(e);
    } else if (linkTo) {
      var direction = "forward";
      if (context && context.items) {
        var itemKey = context.items.findIndex(function (item) {
          return item.key === rest.itemKey;
        });
        var activeItemkey = context.items.findIndex(function (item) {
          return item.key === context.activeKey;
        });
        direction = activeItemkey > itemKey ? "backward" : "forward";
        if (activeItemkey === itemKey) {
          return;
        }
      }
      navigate == null || navigate(linkTo, {
        animate: true,
        direction: direction
      });
    }
  };
  useImperativeHandle(ref, function () {
    return itemRef.current;
  });
  return /*#__PURE__*/React.createElement(BottomNavigationItem, _extends({
    ref: itemRef
  }, rest, {
    onClick: handleClick
  }));
});
export default AnimatedBottomNavigationItem;