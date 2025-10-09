import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["className", "defaultOpen", "label", "status", "helperText", "errorText", "placeholder", "children", "defaultValue", "disabled", "mask", "maskCloseable", "multiple", "onChange", "closeOnSelect", "onVisibilityChange"];
import React, { useCallback, useMemo, useState } from "react";
import classNames from "clsx";
import Icon from "../icon";
import { getPrefixCls } from "../../utils/class";
import Input from "../input/Input";
import SelectTrigger from "./SelectTrigger";
import SelectPanel from "./SelectPanel";
import { convertChildrenToData, flattenOptions } from "./utils/options";
import { Context } from "./context";
var Select = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var className = props.className,
    defaultOpen = props.defaultOpen,
    label = props.label,
    status = props.status,
    helperText = props.helperText,
    errorText = props.errorText,
    placeholder = props.placeholder,
    children = props.children,
    defaultValue = props.defaultValue,
    disabled = props.disabled,
    _props$mask = props.mask,
    mask = _props$mask === void 0 ? true : _props$mask,
    _props$maskCloseable = props.maskCloseable,
    maskCloseable = _props$maskCloseable === void 0 ? true : _props$maskCloseable,
    multiple = props.multiple,
    onChange = props.onChange,
    closeOnSelect = props.closeOnSelect,
    _onVisibilityChange = props.onVisibilityChange,
    restProps = _objectWithoutPropertiesLoose(props, _excluded);
  var _useState = useState(restProps.value || defaultValue || []),
    value = _useState[0],
    setValue = _useState[1];
  var _useState2 = useState(!!defaultOpen && !disabled),
    visible = _useState2[0],
    setVisible = _useState2[1];
  var prefixCls = getPrefixCls("select");
  var cls = classNames(prefixCls, className);
  var optionsList = convertChildrenToData(children);
  var options = flattenOptions(optionsList);
  var getSelectedInputDisplay = function getSelectedInputDisplay(val) {
    if (!Array.isArray(val)) {
      var _options$find;
      return (_options$find = options.find(function (otp) {
        return otp.value === val;
      })) == null || (_options$find = _options$find.label) == null ? void 0 : _options$find.toString();
    }
    return val.map(function (selected) {
      var item = options.find(function (otp) {
        return selected === otp.value;
      });
      return item == null ? void 0 : item.label;
    }).join(", ");
  };
  var inputDisplay = getSelectedInputDisplay(restProps.value || value);
  var updateValue = useCallback(function (val) {
    if (Array.isArray(value) && multiple) {
      var index = value.indexOf(val);
      if (index !== -1) {
        var newValue = [].concat(value);
        newValue.splice(index, 1);
        onChange == null || onChange([].concat(newValue));
        setValue([].concat(newValue));
      } else {
        onChange == null || onChange([].concat(value, [val]));
        setValue([].concat(value, [val]));
      }
    } else {
      onChange == null || onChange(val);
      setValue(val);
      if (closeOnSelect) {
        // eslint-disable-next-line no-use-before-define
        closeSelectSheet();
      }
    }
  }, [closeOnSelect, multiple, onChange, value]);
  var closeSelectSheet = function closeSelectSheet() {
    setVisible(false);
  };
  var contextValue = useMemo(function () {
    return {
      value: restProps.value || value,
      name: restProps.name,
      disabled: disabled,
      updateValue: updateValue,
      closeSelectSheet: closeSelectSheet
    };
  }, [disabled, restProps.name, restProps.value, updateValue, value]);
  var getPopupElement = useCallback(function () {
    return /*#__PURE__*/React.createElement(SelectPanel, {
      title: label,
      optionsList: options
    }, children);
  }, [children, label, options]);
  return /*#__PURE__*/React.createElement(Context.Provider, {
    value: contextValue
  }, /*#__PURE__*/React.createElement(SelectTrigger, {
    defaultOpen: defaultOpen,
    visible: visible,
    popupElement: getPopupElement(),
    mask: mask,
    maskCloseable: maskCloseable,
    onVisibilityChange: function onVisibilityChange(v) {
      if (v !== visible) {
        setVisible(v);
        _onVisibilityChange == null || _onVisibilityChange(v);
      }
    }
  }, /*#__PURE__*/React.createElement(Input, {
    ref: ref,
    className: cls,
    label: label,
    helperText: helperText,
    status: status,
    errorText: errorText,
    placeholder: placeholder,
    readOnly: true,
    disabled: disabled,
    value: inputDisplay,
    name: restProps.name,
    id: restProps.id,
    suffix: /*#__PURE__*/React.createElement(Icon, {
      className: prefixCls + "-icon",
      icon: "zi-chevron-down"
    })
  })));
});
export default Select;