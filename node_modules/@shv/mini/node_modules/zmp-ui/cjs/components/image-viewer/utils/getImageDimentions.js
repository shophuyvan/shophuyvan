"use strict";

exports.__esModule = true;
exports.getImageDimentions = void 0;
var getImageDimentions = exports.getImageDimentions = function getImageDimentions(src) {
  var imgClone = document.createElement("img");
  imgClone.src = src;
  return {
    width: imgClone.width,
    height: imgClone.height
  };
};