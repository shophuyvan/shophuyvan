import _extends from "@babel/runtime/helpers/extends";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React, { useEffect, useMemo, useRef, useState } from "react";
import classNames from "clsx";
import { getPrefixCls } from "../../utils/class";
import TabContext from "./TabContext";
import useMergedState from "../../hooks/useMergedState";
import TabList from "./TabList";
import TabBar from "./TabBar";
import { parseTabList } from "./utils";
var Tabs = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var _classNames;
  var children = props.children,
    className = props.className,
    activeKey = props.activeKey,
    defaultActiveKey = props.defaultActiveKey,
    id = props.id,
    onChange = props.onChange,
    onTabClick = props.onTabClick,
    renderTabBar = props.renderTabBar,
    scrollable = props.scrollable,
    bottomBar = props.bottomBar,
    destroyInactiveTabPane = props.destroyInactiveTabPane;
  var tabbarRef = useRef();
  var tabs = parseTabList(children);
  var tabKeys = tabs.map(function (tab) {
    return tab.key;
  }).join("_");
  var _useMergedState = useMergedState(function () {
      var _tabs$;
      return (_tabs$ = tabs[0]) == null ? void 0 : _tabs$.key;
    }, {
      value: activeKey,
      defaultValue: defaultActiveKey
    }),
    mergedActiveKey = _useMergedState[0],
    setMergedActiveKey = _useMergedState[1];
  var _useMergedState2 = useMergedState(null, {
      value: id
    }),
    mergedId = _useMergedState2[0];
  var _useState = useState(function () {
      return tabs.findIndex(function (tab) {
        return tab.key === mergedActiveKey;
      });
    }),
    activeIndex = _useState[0],
    setActiveIndex = _useState[1];
  useEffect(function () {
    var newActiveIndex = tabs.findIndex(function (tab) {
      return tab.key === mergedActiveKey;
    });
    if (newActiveIndex === -1) {
      var _tabs$newActiveIndex;
      newActiveIndex = Math.max(0, Math.min(activeIndex, tabs.length - 1));
      setMergedActiveKey((_tabs$newActiveIndex = tabs[newActiveIndex]) == null ? void 0 : _tabs$newActiveIndex.key);
    }
    setActiveIndex(newActiveIndex);
  }, [mergedActiveKey, activeIndex, tabs, tabKeys, setMergedActiveKey]);
  var onInternalTabClick = function onInternalTabClick(key, e) {
    onTabClick == null || onTabClick(key, e);
    var isActiveChanged = key !== mergedActiveKey;
    setMergedActiveKey(key);
    if (isActiveChanged) {
      onChange == null || onChange(key);
    }
  };
  var sharedProps = {
    id: mergedId || undefined,
    activeKey: mergedActiveKey
  };
  var prefixCls = getPrefixCls("tabs");
  var cls = classNames(prefixCls, (_classNames = {}, _classNames[prefixCls + "-bottom"] = bottomBar, _classNames), className);
  var tabbarProps = _objectSpread(_objectSpread({}, sharedProps), {}, {
    onTabClick: onInternalTabClick,
    panes: children,
    scrollable: scrollable
  });
  var tabBar = renderTabBar ? renderTabBar(tabbarProps) : /*#__PURE__*/React.createElement(TabBar, _extends({
    ref: tabbarRef
  }, tabbarProps, {
    id: tabbarProps.id || ""
  }));
  var tabContext = useMemo(function () {
    return {
      tabs: tabs
    };
  }, [tabs]);
  return /*#__PURE__*/React.createElement(TabContext.Provider, {
    value: tabContext
  }, /*#__PURE__*/React.createElement("div", {
    ref: ref,
    className: cls
  }, !bottomBar && tabBar, /*#__PURE__*/React.createElement(TabList, _extends({
    destroyInactiveTabPane: destroyInactiveTabPane
  }, sharedProps)), bottomBar && tabBar));
});
export default Tabs;