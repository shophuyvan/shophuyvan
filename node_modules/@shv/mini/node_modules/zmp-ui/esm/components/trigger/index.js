import _extends from "@babel/runtime/helpers/extends";
import _assertThisInitialized from "@babel/runtime/helpers/assertThisInitialized";
import _inheritsLoose from "@babel/runtime/helpers/inheritsLoose";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React from "react";
import classNames from "clsx";
import TriggerContext from "./context";
import addEventListener from "../../utils/addEventListener";
import raf from "../../utils/raf";
import contains from "../../utils/contains";
import { supportRef, composeRef } from "../../utils/ref";
import Portal from "../portal";
import Sheet from "../sheet";
var noop = function noop() {
  return {};
};
function returnEmptyString() {
  return "";
}
function returnDocument(element) {
  if (element) {
    return element.ownerDocument;
  }
  return window.document;
}
var ALL_HANDLERS = ["onClick", "onMouseDown", "onTouchStart", "onMouseEnter", "onMouseLeave", "onFocus", "onBlur", "onContextMenu"];
export function generateTrigger(PortalComponent) {
  var Trigger = /*#__PURE__*/function (_React$Component) {
    _inheritsLoose(Trigger, _React$Component);
    function Trigger(props) {
      var _this;
      _this = _React$Component.call(this, props) || this;
      _defineProperty(_assertThisInitialized(_this), "sheetRef", /*#__PURE__*/React.createRef());
      _defineProperty(_assertThisInitialized(_this), "triggerRef", /*#__PURE__*/React.createRef());
      _defineProperty(_assertThisInitialized(_this), "portalContainer", void 0);
      _defineProperty(_assertThisInitialized(_this), "attachId", void 0);
      _defineProperty(_assertThisInitialized(_this), "clickOutsideHandler", void 0);
      _defineProperty(_assertThisInitialized(_this), "touchOutsideHandler", void 0);
      _defineProperty(_assertThisInitialized(_this), "mouseDownTimeout", void 0);
      _defineProperty(_assertThisInitialized(_this), "focusTime", void 0);
      _defineProperty(_assertThisInitialized(_this), "preClickTime", void 0);
      _defineProperty(_assertThisInitialized(_this), "preTouchTime", void 0);
      _defineProperty(_assertThisInitialized(_this), "delayTimer", void 0);
      _defineProperty(_assertThisInitialized(_this), "hasPopupMouseDown", void 0);
      _defineProperty(_assertThisInitialized(_this), "eventHandlers", {});
      _defineProperty(_assertThisInitialized(_this), "onFocus", function (e) {
        var focusDelay = _this.props.focusDelay;
        _this.fireEvents("onFocus", e);
        // incase focusin and focusout
        _this.clearDelayTimer();
        if (_this.isFocusToShow()) {
          _this.focusTime = Date.now();
          if (focusDelay) _this.delaySetPopupVisible(true, focusDelay);
        }
      });
      _defineProperty(_assertThisInitialized(_this), "onMouseDown", function (e) {
        _this.fireEvents("onMouseDown", e);
        _this.preClickTime = Date.now();
      });
      _defineProperty(_assertThisInitialized(_this), "onTouchStart", function (e) {
        _this.fireEvents("onTouchStart", e);
        _this.preTouchTime = Date.now();
      });
      _defineProperty(_assertThisInitialized(_this), "onBlur", function (e) {
        var blurDelay = _this.props.blurDelay;
        _this.fireEvents("onBlur", e);
        _this.clearDelayTimer();
        if (_this.isBlurToHide() && blurDelay) {
          _this.delaySetPopupVisible(false, blurDelay);
        }
      });
      _defineProperty(_assertThisInitialized(_this), "onClick", function (event) {
        event.stopPropagation();
        var popupVisible = _this.state.popupVisible;
        _this.fireEvents("onClick", event);
        // focus will trigger click
        if (_this.focusTime) {
          var preTime;
          if (_this.preClickTime && _this.preTouchTime) {
            preTime = Math.min(_this.preClickTime, _this.preTouchTime);
          } else if (_this.preClickTime) {
            preTime = _this.preClickTime;
          } else if (_this.preTouchTime) {
            preTime = _this.preTouchTime;
          }
          if (preTime && Math.abs(preTime - _this.focusTime) < 20) {
            return;
          }
          _this.focusTime = 0;
        }
        _this.preClickTime = 0;
        _this.preTouchTime = 0;
        if (_this.isClickToShow() && (_this.isClickToHide() || _this.isBlurToHide()) && event && event.preventDefault) {
          event.preventDefault();
        }
        var nextVisible = !popupVisible;
        if (_this.isClickToHide() && !nextVisible || nextVisible && _this.isClickToShow()) {
          _this.setPopupVisible(!popupVisible);
        }
      });
      _defineProperty(_assertThisInitialized(_this), "onPopupMouseDown", function () {
        _this.hasPopupMouseDown = true;
        clearTimeout(_this.mouseDownTimeout);
        _this.mouseDownTimeout = window.setTimeout(function () {
          _this.hasPopupMouseDown = false;
        }, 0);
        if (_this.context) {
          var _ref = _this.context,
            onPopupMouseDown = _ref.onPopupMouseDown;
          onPopupMouseDown.apply(void 0, arguments);
        }
      });
      _defineProperty(_assertThisInitialized(_this), "onDocumentClick", function (event) {
        var _this$props = _this.props,
          mask = _this$props.mask,
          maskClosable = _this$props.maskClosable,
          popupType = _this$props.popupType;
        if (mask && !maskClosable || popupType === "sheet") {
          return;
        }
        var target = event.target;
        var root = _this.getRootDomNode();
        var popupNode = _this.getPopupDomNode();
        if (!contains(root, target) && !contains(popupNode, target) && !_this.hasPopupMouseDown) {
          _this.close();
        }
      });
      _defineProperty(_assertThisInitialized(_this), "getRootDomNode", function () {
        var _this$triggerRef$curr;
        return ((_this$triggerRef$curr = _this.triggerRef.current) == null ? void 0 : _this$triggerRef$curr.input) || _this.triggerRef.current;
      });
      _defineProperty(_assertThisInitialized(_this), "getComponent", function () {
        var _this$props2 = _this.props,
          popupClassName = _this$props2.popupClassName,
          popupStyle = _this$props2.popupStyle,
          mask = _this$props2.mask,
          maskClosable = _this$props2.maskClosable,
          zIndex = _this$props2.zIndex,
          popup = _this$props2.popup,
          onPopupVisibleChange = _this$props2.onPopupVisibleChange;
        var sheetAnimationVisible = _this.state.sheetAnimationVisible;
        var mouseProps = {};
        mouseProps.onMouseDown = _this.onPopupMouseDown;
        mouseProps.onTouchStart = _this.onPopupMouseDown;
        return /*#__PURE__*/React.createElement(Sheet, _extends({
          visible: sheetAnimationVisible,
          className: popupClassName
        }, mouseProps, {
          style: popupStyle,
          mask: mask,
          maskClosable: maskClosable,
          onClose: function onClose() {
            _this.close();
          },
          afterClose: function afterClose() {
            _this.setState({
              popupVisible: false,
              sheetAnimationVisible: false,
              prevPopupVisible: false
            });
            onPopupVisibleChange == null || onPopupVisibleChange(false);
          },
          zIndex: zIndex,
          handler: false,
          contentRef: _this.sheetRef
        }), typeof popup === "function" ? popup() : popup);
      });
      _defineProperty(_assertThisInitialized(_this), "attachParent", function (popupContainer) {
        if (_this.attachId) raf.cancel(_this.attachId);
        var _this$props3 = _this.props,
          getPopupContainer = _this$props3.getPopupContainer,
          getDocument = _this$props3.getDocument;
        var domNode = _this.getRootDomNode();
        var mountNode;
        if (!getPopupContainer) {
          mountNode = getDocument == null ? void 0 : getDocument(_this.getRootDomNode()).body;
        } else if (domNode || getPopupContainer.length === 0) {
          mountNode = getPopupContainer(domNode);
        }
        if (mountNode) {
          mountNode.appendChild(popupContainer);
        } else {
          // Retry after frame render in case parent not ready
          _this.attachId = raf(function () {
            _this.attachParent(popupContainer);
          });
        }
      });
      _defineProperty(_assertThisInitialized(_this), "getContainer", function () {
        if (!_this.portalContainer) {
          var getDocument = _this.props.getDocument;
          var popupContainer = getDocument == null ? void 0 : getDocument(_this.getRootDomNode()).createElement("div");
          // Make sure default popup container will never cause scrollbar appearing
          if (popupContainer) {
            popupContainer.style.position = "absolute";
            popupContainer.style.top = "0";
            popupContainer.style.left = "0";
            popupContainer.style.width = "100%";
          }
          _this.portalContainer = popupContainer;
        }
        if (_this.portalContainer) _this.attachParent(_this.portalContainer);
        return _this.portalContainer;
      });
      _defineProperty(_assertThisInitialized(_this), "handlePortalUpdate", function () {
        var _this$state = _this.state,
          prevPopupVisible = _this$state.prevPopupVisible,
          popupVisible = _this$state.popupVisible;
        var afterPopupVisibleChange = _this.props.afterPopupVisibleChange;
        if (prevPopupVisible !== popupVisible) {
          afterPopupVisibleChange == null || afterPopupVisibleChange(popupVisible);
        }
      });
      // eslint-disable-next-line react/sort-comp
      _defineProperty(_assertThisInitialized(_this), "triggerContextValue", {
        onPopupMouseDown: _this.onPopupMouseDown
      });
      var _popupVisible;
      if ("popupVisible" in props) {
        _popupVisible = !!props.popupVisible;
      } else {
        _popupVisible = !!props.defaultPopupVisible;
      }
      _this.state = {
        prevPopupVisible: _popupVisible,
        popupVisible: _popupVisible,
        sheetAnimationVisible: false
      };
      ALL_HANDLERS.forEach(function (h) {
        _this.eventHandlers["fire" + h] = function (e) {
          _this.fireEvents(h, e);
        };
      });
      return _this;
    }
    var _proto = Trigger.prototype;
    _proto.componentDidMount = function componentDidMount() {
      this.componentDidUpdate();
    };
    _proto.componentDidUpdate = function componentDidUpdate() {
      var props = this.props;
      var state = this.state;
      if (state.popupVisible) {
        var currentDocument;
        if (!this.clickOutsideHandler && this.isClickToHide()) {
          currentDocument = props.getDocument == null ? void 0 : props.getDocument(this.getRootDomNode());
          this.clickOutsideHandler = addEventListener(currentDocument, "mousedown", this.onDocumentClick);
        }
        if (!this.touchOutsideHandler) {
          currentDocument = currentDocument || (props.getDocument == null ? void 0 : props.getDocument(this.getRootDomNode()));
          this.touchOutsideHandler = addEventListener(currentDocument, "touchstart", this.onDocumentClick);
        }
        return;
      }
      this.clearOutsideHandler();
    };
    _proto.componentWillUnmount = function componentWillUnmount() {
      this.clearDelayTimer();
      this.clearOutsideHandler();
      clearTimeout(this.mouseDownTimeout);
      if (this.attachId) raf.cancel(this.attachId);
    }

    /**
     * @param popupVisible    Show or not the popup element
     * @param event           SyntheticEvent, used for `pointAlign`
     */;
    _proto.setPopupVisible = function setPopupVisible(popupVisible) {
      var onPopupVisibleChange = this.props.onPopupVisibleChange;
      var prevPopupVisible = this.state.popupVisible;
      this.clearDelayTimer();
      if (prevPopupVisible !== popupVisible) {
        if (popupVisible) {
          if (!("popupVisible" in this.props)) {
            this.setState({
              popupVisible: popupVisible,
              prevPopupVisible: prevPopupVisible,
              sheetAnimationVisible: popupVisible
            });
          } else {
            this.setState({
              sheetAnimationVisible: popupVisible,
              prevPopupVisible: prevPopupVisible
            });
          }
          onPopupVisibleChange == null || onPopupVisibleChange(popupVisible);
        } else {
          this.setState({
            sheetAnimationVisible: popupVisible,
            prevPopupVisible: prevPopupVisible
          });
        }
      }
    };
    Trigger.getDerivedStateFromProps = function getDerivedStateFromProps(_ref2, prevState) {
      var popupVisible = _ref2.popupVisible;
      var newState = {};
      if (popupVisible !== undefined && prevState.popupVisible !== popupVisible) {
        if (popupVisible) {
          newState.popupVisible = popupVisible;
          newState.prevPopupVisible = prevState.popupVisible;
          newState.sheetAnimationVisible = true;
        } else {
          newState.sheetAnimationVisible = popupVisible;
          newState.prevPopupVisible = prevState.prevPopupVisible;
        }
      }
      return newState;
    };
    _proto.getPopupDomNode = function getPopupDomNode() {
      return this.sheetRef.current || null;
    };
    _proto.delaySetPopupVisible = function delaySetPopupVisible(visible, delayS) {
      var _this2 = this;
      var delay = delayS * 1000;
      this.clearDelayTimer();
      if (delay) {
        this.delayTimer = window.setTimeout(function () {
          _this2.setPopupVisible(visible);
          _this2.clearDelayTimer();
        }, delay);
      } else {
        this.setPopupVisible(visible);
      }
    };
    _proto.clearDelayTimer = function clearDelayTimer() {
      if (this.delayTimer) {
        clearTimeout(this.delayTimer);
        this.delayTimer = null;
      }
    };
    _proto.clearOutsideHandler = function clearOutsideHandler() {
      if (this.clickOutsideHandler) {
        this.clickOutsideHandler.remove();
        this.clickOutsideHandler = null;
      }
      if (this.touchOutsideHandler) {
        this.touchOutsideHandler.remove();
        this.touchOutsideHandler = null;
      }
    };
    _proto.createTwoChains = function createTwoChains(event) {
      var children = this.props.children;
      var childPros = children.props;
      var props = this.props;
      if (childPros[event] && props[event]) {
        return this.eventHandlers["fire" + event];
      }
      return childPros[event] || props[event];
    };
    _proto.isClickToShow = function isClickToShow() {
      var _this$props4 = this.props,
        action = _this$props4.action,
        showAction = _this$props4.showAction;
      return (action == null ? void 0 : action.indexOf("click")) !== -1 || (showAction == null ? void 0 : showAction.indexOf("click")) !== -1;
    };
    _proto.isClickToHide = function isClickToHide() {
      var _this$props5 = this.props,
        action = _this$props5.action,
        hideAction = _this$props5.hideAction;
      return (action == null ? void 0 : action.indexOf("click")) !== -1 || (hideAction == null ? void 0 : hideAction.indexOf("click")) !== -1;
    };
    _proto.isFocusToShow = function isFocusToShow() {
      var _this$props6 = this.props,
        action = _this$props6.action,
        showAction = _this$props6.showAction;
      return (action == null ? void 0 : action.indexOf("focus")) !== -1 || (showAction == null ? void 0 : showAction.indexOf("focus")) !== -1;
    };
    _proto.isBlurToHide = function isBlurToHide() {
      var _this$props7 = this.props,
        action = _this$props7.action,
        hideAction = _this$props7.hideAction;
      return (action == null ? void 0 : action.indexOf("focus")) !== -1 || (hideAction == null ? void 0 : hideAction.indexOf("blur")) !== -1;
    };
    _proto.fireEvents = function fireEvents(type, e) {
      var children = this.props.children;
      var childCallback = children.props[type];
      if (childCallback) {
        childCallback(e);
      }
      // eslint-disable-next-line react/destructuring-assignment
      var callback = this.props[type];
      if (callback) {
        callback(e);
      }
    };
    _proto.close = function close() {
      this.setPopupVisible(false);
    };
    _proto.render = function render() {
      var popupVisible = this.state.popupVisible;
      var _this$props8 = this.props,
        children = _this$props8.children,
        forceRender = _this$props8.forceRender,
        className = _this$props8.className,
        autoDestroy = _this$props8.autoDestroy;
      var child = React.Children.only(children);
      var newChildProps = {
        key: "trigger"
      };

      // ============================== Visible Handlers ==============================

      // >>> Click
      if (this.isClickToHide() || this.isClickToShow()) {
        newChildProps.onClick = this.onClick;
        newChildProps.onInputTriggerClick = this.onClick;
        newChildProps.onMouseDown = this.onMouseDown;
        newChildProps.onTouchStart = this.onTouchStart;
      } else {
        newChildProps.onClick = this.createTwoChains("onClick");
        newChildProps.onInputTriggerClick = this.createTwoChains("onClick");
        newChildProps.onMouseDown = this.createTwoChains("onMouseDown");
        newChildProps.onTouchStart = this.createTwoChains("onTouchStart");
      }

      // >>> Focus
      if (this.isFocusToShow() || this.isBlurToHide()) {
        newChildProps.onFocus = this.onFocus;
        newChildProps.onBlur = this.onBlur;
      } else {
        newChildProps.onFocus = this.createTwoChains("onFocus");
        newChildProps.onBlur = this.createTwoChains("onBlur");
      }

      // =================================== Render ===================================
      var childrenClassName = classNames(child && child.props && child.props.className, className);
      if (childrenClassName) {
        newChildProps.className = childrenClassName;
      }
      var cloneProps = _objectSpread({}, newChildProps);
      if (supportRef(child)) {
        cloneProps.ref = composeRef(this.triggerRef, child.ref);
      }
      var trigger = /*#__PURE__*/React.cloneElement(child, cloneProps);
      var portal = null;
      // prevent unmounting after it's rendered
      if (popupVisible || forceRender) {
        portal = /*#__PURE__*/React.createElement(PortalComponent, {
          key: "portal",
          getContainer: this.getContainer,
          didUpdate: this.handlePortalUpdate
        }, this.getComponent());
      }
      if (!popupVisible && autoDestroy) {
        portal = null;
      }
      return /*#__PURE__*/React.createElement(TriggerContext.Provider, {
        value: this.triggerContextValue
      }, trigger, portal);
    };
    return Trigger;
  }(React.Component);
  // eslint-disable-next-line react/static-property-placement
  _defineProperty(Trigger, "defaultProps", void 0);
  Trigger.contextType = TriggerContext;
  Trigger.defaultProps = {
    getPopupClassNameFromAlign: returnEmptyString,
    getDocument: returnDocument,
    onPopupVisibleChange: noop,
    afterPopupVisibleChange: noop,
    onPopupAlign: noop,
    popupClassName: "",
    mouseEnterDelay: 0,
    mouseLeaveDelay: 0.1,
    focusDelay: 0,
    blurDelay: 0.15,
    popupStyle: {},
    destroyPopupOnHide: false,
    popupAlign: {},
    defaultPopupVisible: false,
    mask: false,
    maskClosable: true,
    action: [],
    showAction: [],
    hideAction: [],
    autoDestroy: false,
    zIndex: 1001,
    popupType: "sheet"
  };
  return Trigger;
}
export default generateTrigger(Portal);