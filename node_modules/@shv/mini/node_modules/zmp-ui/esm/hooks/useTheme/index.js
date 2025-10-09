import React from "react";
export var ThemeSwitcherContext = /*#__PURE__*/React.createContext(undefined);
export function useTheme() {
  var context = React.useContext(ThemeSwitcherContext);
  if (!context) {
    throw new Error("To use `useTheme`, component must be contained with App components");
  }
  return [context.themeMode, context.setThemeMode];
}