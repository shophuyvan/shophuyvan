"use strict";

exports.__esModule = true;
exports.CalendarContext = void 0;
var _react = require("react");
var CalendarContext = exports.CalendarContext = /*#__PURE__*/(0, _react.createContext)({
  date: new Date(),
  selectedDate: new Date(),
  mode: "date",
  locale: "vi-VN"
});