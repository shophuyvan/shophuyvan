import { isMemo } from "react-is";
export function fillRef(ref, node) {
  if (typeof ref === "function") {
    ref(node);
  } else if (typeof ref === "object" && ref && "current" in ref) {
    // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-explicit-any
    ref.current = node;
  }
}
/**
 * Merge refs into one ref function to support ref passing.
 */
export function composeRef() {
  for (var _len = arguments.length, refs = new Array(_len), _key = 0; _key < _len; _key++) {
    refs[_key] = arguments[_key];
  }
  var refList = refs.filter(function (ref) {
    return ref;
  });
  if (refList.length <= 1) {
    return refList[0];
  }
  return function (node) {
    refs.forEach(function (ref) {
      fillRef(ref, node);
    });
  };
}
export function supportRef(nodeOrComponent) {
  var _type$prototype, _nodeOrComponent$prot;
  var type = isMemo(nodeOrComponent) ? nodeOrComponent.type.type : nodeOrComponent.type;

  // Function component node
  if (typeof type === "function" && !((_type$prototype = type.prototype) != null && _type$prototype.render)) {
    return false;
  }
  return !(typeof nodeOrComponent === "function" && !((_nodeOrComponent$prot = nodeOrComponent.prototype) != null && _nodeOrComponent$prot.render));
}