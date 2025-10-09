import _extends from "@babel/runtime/helpers/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["key", "style", "className", "tabKey"];
import React, { useContext } from "react";
import clsx from "clsx";
import TabContext from "./TabContext";
import Tab from "./Tab";
import { getPrefixCls } from "../../utils/class";
export var TabList = function TabList(props) {
  var _useContext = useContext(TabContext),
    tabs = _useContext.tabs;
  var activeKey = props.activeKey,
    id = props.id,
    destroyInactiveTabPane = props.destroyInactiveTabPane;
  var prefixCls = getPrefixCls("tab-content");
  var cls = clsx(prefixCls);
  return /*#__PURE__*/React.createElement("div", {
    className: cls
  }, tabs.map(function (tab) {
    var key = tab.key,
      tabStyle = tab.style,
      tabClassName = tab.className,
      tabKey = tab.tabKey,
      restTabProps = _objectWithoutPropertiesLoose(tab, _excluded);
    var active = key === activeKey;
    return /*#__PURE__*/React.createElement(Tab, _extends({
      key: key
    }, restTabProps, {
      style: tabStyle,
      active: active,
      id: id,
      tabKey: tabKey || key,
      className: tabClassName,
      destroyInactiveTabPane: destroyInactiveTabPane
    }));
  }));
};
export default TabList;