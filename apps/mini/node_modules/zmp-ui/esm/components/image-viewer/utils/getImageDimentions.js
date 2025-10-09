export var getImageDimentions = function getImageDimentions(src) {
  var imgClone = document.createElement("img");
  imgClone.src = src;
  return {
    width: imgClone.width,
    height: imgClone.height
  };
};