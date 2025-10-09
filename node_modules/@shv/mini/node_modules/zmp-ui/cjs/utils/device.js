"use strict";

exports.__esModule = true;
exports.iOS = void 0;
var iOS = exports.iOS = function iOS() {
  return ["iPad Simulator", "iPhone Simulator", "iPod Simulator", "iPad", "iPhone", "iPod"].includes(navigator.platform) || navigator.userAgent.includes("Mac") && "ontouchend" in document;
};