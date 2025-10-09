import { useLayoutEffect, useState } from "react";
import ResizeObserver from "resize-observer-polyfill";
var useElementSize = function useElementSize(_ref) {
  var ref = _ref.ref;
  var _useState = useState(0),
    size = _useState[0],
    setSize = _useState[1];
  var handleResize = function handleResize(entries) {
    var _entries$0$borderBoxS;
    if (((_entries$0$borderBoxS = entries[0].borderBoxSize) == null ? void 0 : _entries$0$borderBoxS.length) > 0) {
      var _entries$0$borderBoxS2;
      setSize((_entries$0$borderBoxS2 = entries[0].borderBoxSize[0]) == null ? void 0 : _entries$0$borderBoxS2.blockSize);
    } else {
      setSize(entries[0].contentRect.height);
    }
  };
  useLayoutEffect(function () {
    if (!ref || !ref.current) {
      return;
    }
    var resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(ref.current);

    // eslint-disable-next-line consistent-return
    return function () {
      resizeObserver.disconnect();
    };
  }, [ref]);
  return size || 0;
};
export default useElementSize;