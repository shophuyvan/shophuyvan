import * as React from "react";
export var useLayoutUpdateEffect = function useLayoutUpdateEffect(callback, deps) {
  var firstMountRef = React.useRef(true);
  React.useLayoutEffect(function () {
    if (!firstMountRef.current) {
      return callback();
    }
    return undefined;
  }, deps);
  React.useLayoutEffect(function () {
    firstMountRef.current = false;
    return function () {
      firstMountRef.current = true;
    };
  }, []);
};