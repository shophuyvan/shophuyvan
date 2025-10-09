import React, { useContext } from "react";
import classNames from "clsx";
import Button from "../button";
import Icon from "../icon";
import { getPrefixCls } from "../../utils/class";
import { Context } from "./context";
var SelectPanel = function SelectPanel(props) {
  var className = props.className,
    optionsList = props.optionsList,
    title = props.title;
  var selectContext = useContext(Context);
  var _ref = selectContext,
    disabled = _ref.disabled,
    value = _ref.value,
    updateValue = _ref.updateValue,
    closeSelectSheet = _ref.closeSelectSheet;
  var prefixCls = getPrefixCls("select");
  var panelPrefixCls = prefixCls + "-panel";
  var cls = classNames(panelPrefixCls, {}, className);
  var renderOptions = function renderOptions(options) {
    var content = [];
    options.forEach(function (otp) {
      if (otp.group) {
        content.push( /*#__PURE__*/React.createElement("div", {
          className: prefixCls + "-group",
          key: otp.key
        }, otp.label));
      } else {
        var _otp$value, _classNames;
        var isSelected = Array.isArray(value) ? value.find(function (val) {
          return val === otp.value;
        }) : value.toString() === (otp == null || (_otp$value = otp.value) == null ? void 0 : _otp$value.toString());
        var itemCls = classNames(prefixCls + "-option", (_classNames = {}, _classNames[prefixCls + "-option-selected"] = isSelected, _classNames[prefixCls + "-option-disabled"] = disabled || otp.data.disabled, _classNames));
        content.push( /*#__PURE__*/React.createElement("div", {
          key: otp.value,
          className: itemCls,
          role: "presentation",
          onClick: function onClick() {
            if (!disabled && !otp.data.disabled && otp.value !== undefined) {
              updateValue == null || updateValue(otp.value);
            }
          }
        }, otp.data.children || /*#__PURE__*/React.createElement("span", null, otp.label), isSelected && /*#__PURE__*/React.createElement(Icon, {
          className: prefixCls + "-option-check-icon",
          icon: "zi-check"
        })));
      }
    });
    return content;
  };
  var closeModal = function closeModal() {
    closeSelectSheet == null || closeSelectSheet();
  };
  return /*#__PURE__*/React.createElement("div", {
    className: cls
  }, /*#__PURE__*/React.createElement("div", {
    className: prefixCls + "-header"
  }, /*#__PURE__*/React.createElement("div", {
    className: prefixCls + "-title"
  }, title), /*#__PURE__*/React.createElement(Button, {
    type: "neutral",
    variant: "tertiary",
    className: prefixCls + "-close-icon",
    icon: /*#__PURE__*/React.createElement(Icon, {
      icon: "zi-close"
    }),
    onClick: closeModal
  })), /*#__PURE__*/React.createElement("div", {
    className: prefixCls + "-options"
  }, renderOptions(optionsList)));
};
export default SelectPanel;