import React, { useCallback } from "react";
import { useNavigate as useDefaultNavigate } from "react-router-dom";
import { AnimationRouterContext } from "../../components/router/ZMPRouter";
var useNavigate = function useNavigate() {
  var navigate = useDefaultNavigate();
  var context = React.useContext(AnimationRouterContext);
  if (!context) {
    throw new Error("To use `useNavigate`, component must be contained with ZMPRouter component");
  }
  return useCallback(function (to, options) {
    var _ref = options || {},
      animate = _ref.animate,
      direction = _ref.direction;
    context.setAnimate({
      animate: animate != null ? animate : true,
      direction: direction || "forward"
    });
    if (typeof to === "number") {
      navigate(to);
    } else {
      navigate(to, options);
    }
  }, [context, navigate]);
};
export default useNavigate;