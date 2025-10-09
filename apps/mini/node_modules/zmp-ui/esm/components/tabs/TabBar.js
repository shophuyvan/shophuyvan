import React, { useCallback, useContext, useLayoutEffect, useRef, useState } from "react";
import classNames from "clsx";
import ResizeObserver from "resize-observer-polyfill";
import { getPrefixCls } from "../../utils/class";
import TabContext from "./TabContext";
import TabBarItem from "./TabBarItem";
var TabBar = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var _classNames;
  var className = props.className,
    id = props.id,
    style = props.style,
    onTabClick = props.onTabClick,
    scrollable = props.scrollable,
    activeKey = props.activeKey;
  var _useContext = useContext(TabContext),
    tabs = _useContext.tabs;
  var _useState = useState({
      width: 0,
      left: 0
    }),
    activeLineStyles = _useState[0],
    setActiveLineStyles = _useState[1];
  var tabsWrapperRef = useRef();
  var tabItemRefs = useRef(new Map());
  var getRef = function getRef(key) {
    if (!tabItemRefs.current.has(key)) {
      tabItemRefs.current.set(key, /*#__PURE__*/React.createRef());
    }
    return tabItemRefs.current.get(key);
  };
  var scrollToTab = useCallback(function (key) {
    if (key === void 0) {
      key = activeKey;
    }
    var activeTab = getRef(key);
    if (activeTab && activeTab.current) {
      var _activeTab$current;
      var tabOffset = ((_activeTab$current = activeTab.current) == null ? void 0 : _activeTab$current.getBoundingClientRect()) || {};
      var left = tabOffset.left,
        right = tabOffset.right,
        width = tabOffset.width;
      var tabbar = ref;
      var scrollLeft = tabbar.current.scrollLeft;
      var tabbarWidth = tabbar == null ? void 0 : tabbar.current.clientWidth;
      if (!tabbarWidth) {
        return;
      }
      if (right >= tabbarWidth - 40) {
        tabbar.current.scrollTo({
          left: scrollLeft + (right - tabbarWidth) + 40,
          behavior: "smooth"
        });
        return;
      }
      if (left <= 40 && scrollLeft > 0) {
        tabbar.current.scrollTo({
          left: scrollLeft - (width - right + 40),
          behavior: "smooth"
        });
      }
    }
  }, [activeKey, ref]);
  var setLineStyles = useCallback(function (key) {
    if (key === void 0) {
      key = activeKey;
    }
    var activeTab = getRef(key);
    if (activeTab && activeTab.current) {
      if (!activeTab.current.clientWidth) {
        return;
      }
      setActiveLineStyles({
        width: activeTab.current.clientWidth - 24,
        left: activeTab.current.offsetLeft + 12
      });
    }
  }, [activeKey]);
  useLayoutEffect(function () {
    var refEl = ref;
    if (!refEl || !refEl.current) {
      return undefined;
    }
    var resizeObserver = new ResizeObserver(function () {
      if (refEl.current.clientWidth) {
        if (refEl.current.scrollWidth > refEl.current.clientWidth) {
          refEl.current.style.setProperty("--zaui-tabbar-width", refEl.current.scrollWidth + "px");
        }
        scrollToTab(activeKey);
        setLineStyles();
      }
    });
    resizeObserver.observe(refEl.current);
    return function () {
      resizeObserver.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey]);
  var prefixCls = getPrefixCls("tabs-tabbar");
  var cls = classNames(prefixCls, (_classNames = {}, _classNames[prefixCls + "-scrollable"] = scrollable, _classNames), className);
  useLayoutEffect(function () {
    scrollToTab(activeKey);
    setLineStyles();
  }, [activeKey, scrollToTab, setLineStyles]);
  var tabNodes = tabs.map(function (tab) {
    var key = tab.key;
    return /*#__PURE__*/React.createElement(TabBarItem, {
      key: key,
      ref: getRef(key),
      onClick: function onClick(e) {
        onTabClick == null || onTabClick(key, e);
      },
      active: key === activeKey,
      tab: tab,
      id: id,
      onFocus: function onFocus() {
        if (!tabsWrapperRef.current) {
          return;
        }
        tabsWrapperRef.current.scrollTop = 0;
      }
    });
  });
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    className: cls,
    style: style
  }, tabNodes, /*#__PURE__*/React.createElement("span", {
    className: prefixCls + "-active-line",
    style: {
      width: activeLineStyles.width + "px",
      left: activeLineStyles.left + "px"
    }
  }));
});
export default TabBar;