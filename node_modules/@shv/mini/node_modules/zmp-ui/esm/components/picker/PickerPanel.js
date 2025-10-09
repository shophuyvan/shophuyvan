/* eslint-disable security/detect-object-injection */
import React from "react";
import classNames from "clsx";
import PickerColumn from "./PickerColumn";
import Button from "../button";
import Icon from "../icon";
var PickerPanel = function PickerPanel(props) {
  var className = props.className,
    prefixCls = props.prefixCls,
    data = props.data,
    value = props.value,
    defaultValue = props.defaultValue,
    onChange = props.onChange,
    action = props.action,
    datePicker = props.datePicker,
    closePanel = props.closePanel,
    title = props.title,
    initData = props.initData;

  // Merge classes
  var panelPrefixCls = prefixCls + "-panel";
  var cls = classNames(panelPrefixCls, {}, className);
  var closeModal = function closeModal(event) {
    closePanel == null || closePanel(event);
  };
  var handleClickAction = function handleClickAction(event) {
    if (action && action.close) {
      closeModal(event);
    }
    action == null || action.onClick == null || action.onClick(event);
  };

  // Render the picker content
  var renderInner = function renderInner() {
    var innerPrefixCls = prefixCls + "-inner";

    // Map the data array to the picker columns
    var columnNodes = data.map(function (column, index) {
      var otpVal = value ? value[column.name] : undefined;
      var otpDefaultValue = defaultValue ? defaultValue[column.name] : undefined;
      if (initData && initData[column.name] && !otpVal && !otpDefaultValue) {
        otpDefaultValue = column.options.find(function (opt) {
          return opt.value === initData[column.name];
        });
      }
      return /*#__PURE__*/React.createElement(PickerColumn, {
        key: "zaui-picker-column-" + (column.name || index),
        name: column.name,
        prefixCls: prefixCls,
        datePickerColumn: datePicker,
        options: column.options,
        value: otpVal,
        defaultValue: otpDefaultValue,
        onChange: onChange
      });
    });
    return /*#__PURE__*/React.createElement("div", {
      className: innerPrefixCls
    }, columnNodes);
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
  })), renderInner(), action && /*#__PURE__*/React.createElement("div", {
    className: prefixCls + "-action"
  }, /*#__PURE__*/React.createElement(Button, {
    fullWidth: true,
    onClick: handleClickAction
  }, action.text)));
};
PickerPanel.defaultProps = {
  initData: undefined,
  datePicker: false
};
export default /*#__PURE__*/React.memo(PickerPanel);