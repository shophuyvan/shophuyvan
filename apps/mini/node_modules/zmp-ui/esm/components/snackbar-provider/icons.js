import React from "react";
import Icon from "../icon";
import { SnackbarType } from "./props-type";
import LoadingIcon from "./LoadingIcon";
export var Wifi = function Wifi() {
  return /*#__PURE__*/React.createElement(Icon, {
    icon: "zi-wifi"
  });
};
export var WifiOff = function WifiOff() {
  return /*#__PURE__*/React.createElement(Icon, {
    icon: "zi-wifi-off"
  });
};
export var Download = function Download() {
  return /*#__PURE__*/React.createElement(Icon, {
    icon: "zi-download-solid"
  });
};
export var Error = function Error() {
  return /*#__PURE__*/React.createElement(Icon, {
    icon: "zi-close-circle-solid"
  });
};
export var Warning = function Warning() {
  return /*#__PURE__*/React.createElement(Icon, {
    icon: "zi-warning-solid"
  });
};
export var Info = function Info() {
  return /*#__PURE__*/React.createElement(Icon, {
    icon: "zi-info-circle-solid"
  });
};
export var Success = function Success() {
  return /*#__PURE__*/React.createElement(Icon, {
    icon: "zi-check-circle-solid"
  });
};
var getIcon = function getIcon(type) {
  switch (type) {
    case SnackbarType.download:
      return /*#__PURE__*/React.createElement(Download, null);
    case SnackbarType.error:
      return /*#__PURE__*/React.createElement(Error, null);
    case SnackbarType.warning:
      return /*#__PURE__*/React.createElement(Warning, null);
    case SnackbarType.success:
      return /*#__PURE__*/React.createElement(Success, null);
    case SnackbarType["wifi-connected"]:
      return /*#__PURE__*/React.createElement(Wifi, null);
    case SnackbarType["wifi-disconnected"]:
      return /*#__PURE__*/React.createElement(WifiOff, null);
    case SnackbarType.loading:
      return /*#__PURE__*/React.createElement(LoadingIcon, null);
    default:
      return /*#__PURE__*/React.createElement(Info, null);
  }
};
export default getIcon;