import { createContext } from "react";
export var CalendarContext = /*#__PURE__*/createContext({
  date: new Date(),
  selectedDate: new Date(),
  mode: "date",
  locale: "vi-VN"
});