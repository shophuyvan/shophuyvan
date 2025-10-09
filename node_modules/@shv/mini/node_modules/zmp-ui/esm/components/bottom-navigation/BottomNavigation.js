import _extends from "@babel/runtime/helpers/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
var _excluded = ["key", "style", "className", "itemKey", "linkTo"];
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React, { useEffect, useMemo, useState } from "react";
import classNames from "clsx";
import useMergedState from "../../hooks/useMergedState";
import { getPrefixCls } from "../../utils/class";
import { BottomNavigationContext } from "./context";
import { parseItemList } from "./utils";
import BottomNavigationItem from "./BottomNavigationItem";
import AnimatedBottomNavigationItem from "./AnimatedBottomNavigationItem";
var BottomNavigation = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var _classNames;
  var className = props.className,
    style = props.style,
    children = props.children,
    fixed = props.fixed,
    id = props.id,
    onChange = props.onChange,
    activeKey = props.activeKey,
    defaultActiveKey = props.defaultActiveKey,
    zIndex = props.zIndex;
  var prefixCls = getPrefixCls("bottom-navigation");
  var cls = classNames(prefixCls, className, (_classNames = {}, _classNames[prefixCls + "-fixed"] = fixed, _classNames));
  var items = parseItemList(children);
  if (!items || items.length < 2) {
    // This is neccessary to tell the developers to either add in more items or not to use Bottom Navigation at all
    // eslint-disable-next-line no-console
    console.warn("Bottom Navigation must to have at least 2 items");
  }
  var itemKeys = items.map(function (item) {
    return item.key;
  }).join("_");
  var _useMergedState = useMergedState(function () {
      var _items$;
      return (_items$ = items[0]) == null ? void 0 : _items$.key;
    }, {
      value: activeKey,
      defaultValue: defaultActiveKey
    }),
    mergedActiveKey = _useMergedState[0],
    setMergedActiveKey = _useMergedState[1];
  var _useState = useState(function () {
      return items.findIndex(function (item) {
        return item.key === mergedActiveKey;
      });
    }),
    activeIndex = _useState[0],
    setActiveIndex = _useState[1];
  useEffect(function () {
    var newActiveIndex = items.findIndex(function (item) {
      return item.key === mergedActiveKey;
    });
    if (newActiveIndex === -1) {
      var _items$newActiveIndex;
      newActiveIndex = Math.max(0, Math.min(activeIndex, items.length - 1));
      // not passing user input here
      // eslint-disable-next-line security/detect-object-injection
      setMergedActiveKey((_items$newActiveIndex = items[newActiveIndex]) == null ? void 0 : _items$newActiveIndex.key);
    }
    setActiveIndex(newActiveIndex);
  }, [mergedActiveKey, activeIndex, items, itemKeys, setMergedActiveKey]);
  var handleonChange = function handleonChange(key) {
    var isActiveChanged = key !== mergedActiveKey;
    setMergedActiveKey(key);
    if (isActiveChanged) {
      onChange == null || onChange(key);
    }
  };
  var contextValue = useMemo(function () {
    return {
      activeKey: mergedActiveKey,
      items: items
    };
  }, [items, mergedActiveKey]);
  var elStyle = _objectSpread(_objectSpread({}, style || {}), zIndex !== undefined ? {
    zIndex: zIndex
  } : {});
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    id: id,
    style: elStyle,
    className: cls
  }, /*#__PURE__*/React.createElement("div", {
    className: prefixCls + "-content"
  }, /*#__PURE__*/React.createElement(BottomNavigationContext.Provider, {
    value: contextValue
  }, items.map(function (item) {
    var key = item.key,
      tabStyle = item.style,
      tabClassName = item.className,
      itemKey = item.itemKey,
      linkTo = item.linkTo,
      restTabProps = _objectWithoutPropertiesLoose(item, _excluded);
    var activeItem = key === mergedActiveKey;
    if (linkTo) {
      return /*#__PURE__*/React.createElement(AnimatedBottomNavigationItem, _extends({
        key: key
      }, restTabProps, {
        linkTo: linkTo,
        style: tabStyle,
        active: activeItem,
        itemKey: itemKey || key,
        className: tabClassName,
        onChange: handleonChange
      }));
    }
    return /*#__PURE__*/React.createElement(BottomNavigationItem, _extends({
      key: key
    }, restTabProps, {
      style: tabStyle,
      active: activeItem,
      itemKey: itemKey || key,
      className: tabClassName,
      onChange: handleonChange
    }));
  }))));
});
export default BottomNavigation;