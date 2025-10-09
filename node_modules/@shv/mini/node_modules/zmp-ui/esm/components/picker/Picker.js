import _defineProperty from "@babel/runtime/helpers/defineProperty";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React, { useEffect, useState } from "react";
import classNames from "clsx";
import Input from "../input";
import PickerTrigger from "./PickerTrigger";
import PickerPanel from "./PickerPanel";
import { getPrefixCls } from "../../utils/class";
var Picker = function Picker(props) {
  var label = props.label,
    helperText = props.helperText,
    status = props.status,
    errorText = props.errorText,
    data = props.data,
    value = props.value,
    defaultValue = props.defaultValue,
    onChange = props.onChange,
    action = props.action,
    placeholder = props.placeholder,
    title = props.title,
    defaultOpen = props.defaultOpen,
    disabled = props.disabled,
    formatPickedValueDisplay = props.formatPickedValueDisplay,
    _props$mask = props.mask,
    mask = _props$mask === void 0 ? true : _props$mask,
    _props$maskClosable = props.maskClosable,
    maskClosable = _props$maskClosable === void 0 ? true : _props$maskClosable,
    inputClass = props.inputClass,
    datePicker = props.datePicker,
    initData = props.initData,
    suffix = props.suffix,
    prefix = props.prefix,
    _onVisibilityChange = props.onVisibilityChange,
    updateDatePickerData = props.updateDatePickerData,
    id = props.id,
    inputName = props.name;
  var getInitValue = function getInitValue(val, defaultVal, options) {
    var getOption = function getOption(opts) {
      var result = {};
      Object.keys(opts).forEach(function (optName) {
        var group = options.find(function (dataGroup) {
          return dataGroup.name === optName;
        });
        if (group) {
          var opt = group.options.find(function (o) {
            return o.value === opts[optName];
          });
          if (opt) {
            result[optName] = opt;
          } else if (datePicker) {
            updateDatePickerData == null || updateDatePickerData();
          }
        }
      });
      return result;
    };
    if (val) return getOption(val);
    if (defaultVal) return getOption(defaultVal);
    return {};
  };
  var _useState = useState(!!defaultOpen && !disabled),
    visible = _useState[0],
    setVisible = _useState[1];

  // Local picker state
  var _useState2 = useState(getInitValue(value, defaultValue, data || [])),
    pickerValue = _useState2[0],
    setPickerValue = _useState2[1];
  useEffect(function () {
    if (value) {
      setPickerValue(getInitValue(value, undefined, data || []));
    } else {
      setPickerValue({});
    }
  }, [value]);
  var closePicker = function closePicker() {
    setVisible(false);
  };

  // Handle change picker value
  var handleChangePickerValue = function handleChangePickerValue(otp, name) {
    var _pickerValue$name;
    var newState = _objectSpread({}, pickerValue);
    if (((_pickerValue$name = pickerValue[name]) == null ? void 0 : _pickerValue$name.value) !== otp.value) {
      newState[name] = otp;
    }
    setPickerValue(newState);
    if (!value) {
      onChange == null || onChange(newState);
    } else {
      var different = false;
      Object.entries(value).forEach(function (_ref) {
        var _newState$k;
        var k = _ref[0],
          v = _ref[1];
        if (((_newState$k = newState[k]) == null ? void 0 : _newState$k.value) !== v) {
          different = true;
        }
      });
      if (different) {
        onChange == null || onChange(newState);
      }
    }
  };

  // Merge classes
  var prefixCls = getPrefixCls("picker");
  var inputCls = classNames(prefixCls + "-input", inputClass);

  // Render the picker modal
  var getPopupElement = function getPopupElement() {
    return /*#__PURE__*/React.createElement(PickerPanel, {
      prefixCls: prefixCls,
      className: prefixCls,
      data: data,
      value: pickerValue,
      onChange: handleChangePickerValue,
      title: title,
      closePanel: closePicker,
      action: action,
      datePicker: datePicker,
      initData: initData
    });
  };

  // Map the value of the picker to the string to be displayed on the input
  var getInputDisplay = function getInputDisplay(picked) {
    if (formatPickedValueDisplay) {
      return formatPickedValueDisplay(picked);
    }
    return Object.keys(picked).map(function (k) {
      return pickerValue[k].displayName;
    }).filter(function (item) {
      return item !== null;
    }).join(", ");
  };
  var inputDisplay = getInputDisplay(pickerValue);
  return /*#__PURE__*/React.createElement(PickerTrigger, {
    popupElement: getPopupElement(),
    visible: visible,
    defaultOpen: defaultOpen,
    onVisibilityChange: function onVisibilityChange(v) {
      if (!disabled) {
        setVisible(v);
        _onVisibilityChange == null || _onVisibilityChange(v);
      }
    },
    mask: mask,
    maskClosable: maskClosable
  }, /*#__PURE__*/React.createElement(Input, {
    label: label,
    className: inputCls,
    helperText: helperText,
    status: status,
    errorText: errorText,
    placeholder: placeholder,
    value: inputDisplay,
    readOnly: true,
    disabled: disabled,
    prefix: prefix,
    suffix: suffix,
    id: id,
    name: inputName
  }));
};
Picker.defaultProps = {
  datePicker: false,
  initData: undefined
};
export default Picker;