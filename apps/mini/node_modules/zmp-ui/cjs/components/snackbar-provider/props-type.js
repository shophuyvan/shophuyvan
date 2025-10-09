"use strict";

exports.__esModule = true;
exports.SnackbarType = exports.SnackbarPosition = void 0;
/* eslint-disable no-use-before-define */
/**
 * @category Feedback
 * @subcategory Snackbar
 * @enum {string}
 */
var SnackbarPosition = exports.SnackbarPosition = /*#__PURE__*/function (SnackbarPosition) {
  SnackbarPosition["top"] = "top";
  SnackbarPosition["bottom"] = "bottom";
  return SnackbarPosition;
}({});
/**
 * @category Feedback
 * @subcategory Snackbar
 * @enum {string}
 */
var SnackbarType = exports.SnackbarType = /*#__PURE__*/function (SnackbarType) {
  SnackbarType["default"] = "default";
  SnackbarType["success"] = "success";
  SnackbarType["info"] = "info";
  SnackbarType["error"] = "error";
  SnackbarType["warning"] = "warning";
  SnackbarType["loading"] = "loading";
  SnackbarType["download"] = "download";
  SnackbarType["countdown"] = "countdown";
  SnackbarType["wifi-connected"] = "wifi-connected";
  SnackbarType["wifi-disconnected"] = "wifi-disconnected";
  return SnackbarType;
}({});
/**
 * @category Feedback
 * @subcategory Snackbar
 * @displayName SnackbarProvider
 */
/**
 * @category Feedback
 * @subcategory Snackbar
 * @displayName SnackbarContext
 *
 * SnackbarProvider cung cấp các hooks
 */
/**
 * @category Feedback
 * @subcategory Snackbar
 * @typedef {object} SnackbarAction
 */
/**
 * @category Feedback
 * @subcategory Snackbar
 * @typedef {object} SnackbarOptions
 */
// NOT INJECT TYPE DECLARE