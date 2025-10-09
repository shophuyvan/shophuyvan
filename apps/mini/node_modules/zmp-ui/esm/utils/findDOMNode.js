import ReactDOM from "react-dom";
export default function findDOMNode(node) {
  if (node instanceof HTMLElement) {
    return node;
  }
  // eslint-disable-next-line react/no-find-dom-node
  return ReactDOM.findDOMNode(node);
}