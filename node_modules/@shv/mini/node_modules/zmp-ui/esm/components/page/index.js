import _extends from "@babel/runtime/helpers/extends";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["className", "id", "style", "children", "resetScroll", "hideScrollbar", "restoreScroll", "restoreScrollOnBack", "name"];
import React, { useCallback, useContext, useImperativeHandle, useLayoutEffect, useRef } from "react";
import classNames from "clsx";
import { useLocation } from "react-router-dom";
import { getPrefixCls } from "../../utils/class";
import { AnimationRouterContext } from "../router/ZMPRouter";

/**
 * Page component: Component wrapper nội dung trang
 *
 * @category Container
 * @subCategory Page
 * @component
 *
 * @example
function HomePage(props){
    return (
        <Page>
            <Input label="Label" helperText="Helper text" />
        </Page>
    );
}
 */
var Page = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var _classNames;
  var routerContext = useContext(AnimationRouterContext);
  var className = props.className,
    id = props.id,
    style = props.style,
    children = props.children,
    _props$resetScroll = props.resetScroll,
    resetScroll = _props$resetScroll === void 0 ? true : _props$resetScroll,
    _props$hideScrollbar = props.hideScrollbar,
    hideScrollbar = _props$hideScrollbar === void 0 ? false : _props$hideScrollbar,
    restoreScroll = props.restoreScroll,
    restoreScrollOnBack = props.restoreScrollOnBack,
    name = props.name,
    rest = _objectWithoutPropertiesLoose(props, _excluded);
  var isScrolling = useRef();
  if (!routerContext && (restoreScroll || restoreScrollOnBack)) {
    throw new Error("To use Scroll Restoration feature, Page must be contained with ZMPRouter.");
  }
  var location = useLocation();
  var getPageKey = function getPageKey() {
    if (restoreScrollOnBack) {
      return location.key;
    }
    return name || location.pathname;
  };
  var prefixCls = getPrefixCls("page");
  var pageRef = useRef();
  useImperativeHandle(ref, function () {
    return pageRef.current;
  });
  var cls = classNames(prefixCls, (_classNames = {}, _classNames[prefixCls + "-hide-scrollbar"] = hideScrollbar, _classNames), className);
  var positionKey = getPageKey();
  var onPageScroll = function onPageScroll() {
    if (!routerContext) {
      return;
    }
    clearTimeout(isScrolling.current);
    isScrolling.current = setTimeout(function () {
      var _pageRef$current;
      var updatePosition = routerContext.updatePosition;
      updatePosition(positionKey, ((_pageRef$current = pageRef.current) == null ? void 0 : _pageRef$current.scrollTop) || 0);
    }, 150);
  };
  var restoreScrollPosition = useCallback(function () {
    if (!routerContext) {
      return;
    }
    var pageScrollPosition = routerContext.pageScrollPosition;
    if (pageScrollPosition[positionKey] !== undefined && restoreScrollOnBack || restoreScroll) {
      var _pageScrollPosition$p;
      // eslint-disable-next-line security/detect-object-injection
      pageRef.current.scrollTo(0, (_pageScrollPosition$p = pageScrollPosition == null ? void 0 : pageScrollPosition[positionKey]) != null ? _pageScrollPosition$p : 0);
    }
  }, [restoreScroll, restoreScrollOnBack, routerContext, positionKey]);
  useLayoutEffect(function () {
    var page = pageRef.current;
    if (page && routerContext && (restoreScroll || restoreScrollOnBack)) {
      restoreScrollPosition();
      page == null || page.addEventListener("scroll", onPageScroll);
    }
    if (resetScroll && !restoreScroll && !restoreScrollOnBack) {
      page.scrollTo(0, 0);
    }
    return function () {
      if (page && routerContext && (restoreScroll || restoreScrollOnBack)) {
        page == null || page.removeEventListener("scroll", onPageScroll);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageRef, resetScroll, restoreScroll, restoreScrollOnBack]);
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    className: cls,
    id: id,
    style: style,
    ref: pageRef
  }), children);
});
export default Page;