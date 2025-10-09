import { BOX_PROPS } from "./constants";
export var isValidBoxProps = function isValidBoxProps(value, prop) {
  if (!value || !prop) return false;
  if (!BOX_PROPS[prop]) return false;
  return BOX_PROPS[prop].find(function (val) {
    return val === value;
  });
};
export var validateSpacingNumber = function validateSpacingNumber(num) {
  return !Number.isNaN(num) && num >= 0 && num <= 10;
};