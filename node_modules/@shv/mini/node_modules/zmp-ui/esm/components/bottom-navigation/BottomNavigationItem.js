import React from "react";
import classNames from "clsx";
import { getPrefixCls } from "../../utils/class";
var BottomNavigationItem = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var _classNames;
  var icon = props.icon,
    activeIcon = props.activeIcon,
    label = props.label,
    onClick = props.onClick,
    active = props.active,
    onChange = props.onChange,
    itemKey = props.itemKey,
    id = props.id,
    className = props.className,
    style = props.style;
  var prefixCls = getPrefixCls("bottom-navigation-item");
  var cls = classNames(prefixCls, className, (_classNames = {}, _classNames[prefixCls + "-active"] = !!active, _classNames));
  var handleClickItem = function handleClickItem(e) {
    if (itemKey) {
      onChange(itemKey);
    }
    onClick == null || onClick(e);
  };
  var iconEl = active && activeIcon ? activeIcon : icon;
  return /*#__PURE__*/React.createElement("button", {
    id: id,
    style: style,
    ref: ref,
    onClick: handleClickItem,
    className: cls
  }, iconEl && /*#__PURE__*/React.createElement("span", {
    className: prefixCls + "-icon"
  }, " ", iconEl), /*#__PURE__*/React.createElement("span", {
    className: prefixCls + "-label"
  }, label));
});
export default BottomNavigationItem;