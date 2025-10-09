import React, { useState, useLayoutEffect } from "react";
import useEvent from "./useEvent";
import { useLayoutUpdateEffect } from "./useLayoutUpdateEffect";
var Source = /*#__PURE__*/function (Source) {
  Source[Source["INNER"] = 0] = "INNER";
  Source[Source["PROP"] = 1] = "PROP";
  return Source;
}(Source || {});
/** We only think `undefined` is empty */
function hasValue(value) {
  return value !== undefined;
}

/**
 * Similar to `useState` but will use props value if provided.
 */
export default function useMergedState(defaultStateValue, option) {
  var _ref = option || {},
    defaultValue = _ref.defaultValue,
    value = _ref.value,
    onChange = _ref.onChange,
    postState = _ref.postState;

  // ======================= Init =======================
  var _useState = useState(function () {
      var finalValue;
      var source;
      if (hasValue(value)) {
        finalValue = value;
        source = Source.PROP;
      } else if (hasValue(defaultValue)) {
        finalValue = typeof defaultValue === "function" ? defaultValue() : defaultValue;
        source = Source.PROP;
      } else {
        finalValue = typeof defaultStateValue === "function" ? defaultStateValue() : defaultStateValue;
        source = Source.INNER;
      }
      return [finalValue, source, finalValue];
    }),
    mergedValue = _useState[0],
    setMergedValue = _useState[1];
  var chosenValue = hasValue(value) ? value : mergedValue[0];
  var postMergedValue = postState ? postState(chosenValue) : chosenValue;

  // ======================= Sync =======================
  useLayoutUpdateEffect(function () {
    if (hasValue(value)) {
      setMergedValue(function (_ref2) {
        var prevValue = _ref2[0];
        return [value, Source.PROP, prevValue];
      });
    }
  }, [value]);

  // ====================== Update ======================
  var changeEventPrevRef = React.useRef();
  var triggerChange = useEvent(function (updater) {
    setMergedValue(function (prev) {
      var prevValue = prev[0],
        prevSource = prev[1],
        prevPrevValue = prev[2];
      var nextValue = typeof updater === "function" ? updater(prevValue) : updater;

      // Do nothing if value not change
      if (nextValue === prevValue) {
        return prev;
      }

      // Use prev prev value if is in a batch update to avoid missing data
      var overridePrevValue = prevSource === Source.INNER && changeEventPrevRef.current !== prevPrevValue ? prevPrevValue : prevValue;
      return [nextValue, Source.INNER, overridePrevValue];
    });
  });

  // ====================== Change ======================
  var onChangeFn = useEvent(onChange);
  useLayoutEffect(function () {
    var current = mergedValue[0],
      source = mergedValue[1],
      prev = mergedValue[2];
    if (current !== prev && source === Source.INNER) {
      onChangeFn(current, prev);
      changeEventPrevRef.current = prev;
    }
  }, [mergedValue]);
  return [postMergedValue, triggerChange];
}