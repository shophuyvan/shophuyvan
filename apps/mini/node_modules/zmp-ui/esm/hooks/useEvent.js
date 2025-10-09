import React from "react";

// eslint-disable-next-line @typescript-eslint/ban-types
export default function useEvent(callback) {
  var fnRef = React.useRef();
  fnRef.current = callback;
  return React.useCallback(function () {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }
    return fnRef.current == null ? void 0 : fnRef.current.apply(fnRef, args);
  }, []);
}