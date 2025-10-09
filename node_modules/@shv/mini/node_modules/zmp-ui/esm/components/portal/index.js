import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import ReactDOM from "react-dom";
function canUseDom() {
  return !!(typeof window !== "undefined" && window.document && window.document.createElement);
}
var Portal = /*#__PURE__*/forwardRef(function (props, ref) {
  var didUpdate = props.didUpdate,
    getContainer = props.getContainer,
    children = props.children;
  var parentRef = useRef();
  var containerRef = useRef();

  // Ref return nothing, only for wrapper check exist
  useImperativeHandle(ref, function () {
    return {};
  });

  // Create container in client side with sync to avoid useEffect not get ref
  var initRef = useRef(false);
  if (!initRef.current && canUseDom()) {
    containerRef.current = getContainer();
    parentRef.current = containerRef.current.parentNode;
    initRef.current = true;
  }
  useEffect(function () {
    didUpdate == null || didUpdate(props);
  });
  useEffect(function () {
    var _containerRef$current;
    if ((containerRef == null || (_containerRef$current = containerRef.current) == null ? void 0 : _containerRef$current.parentNode) === null && parentRef.current !== null) {
      var _parentRef$current;
      parentRef == null || (_parentRef$current = parentRef.current) == null || _parentRef$current.appendChild(containerRef.current);
    }
    return function () {
      var _containerRef$current2;
      (_containerRef$current2 = containerRef.current) == null || (_containerRef$current2 = _containerRef$current2.parentNode) == null || _containerRef$current2.removeChild(containerRef.current);
    };
  }, []);
  return containerRef.current ? /*#__PURE__*/ReactDOM.createPortal(children, containerRef.current) : null;
});
export default Portal;