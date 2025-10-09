import { useContext } from "react";
import SnackbarContext from "../context";
export var useSnackbar = function useSnackbar() {
  var snackbarContext = useContext(SnackbarContext);
  var _ref = snackbarContext || {},
    openSnackbar = _ref.openSnackbar,
    closeSnackbar = _ref.closeSnackbar,
    setDownloadProgress = _ref.setDownloadProgress;
  var open = function open(option) {
    openSnackbar == null || openSnackbar(option);
  };
  var close = function close() {
    closeSnackbar == null || closeSnackbar();
  };
  var setDownload = function setDownload(completed) {
    setDownloadProgress == null || setDownloadProgress(completed);
  };
  return {
    openSnackbar: open,
    closeSnackbar: close,
    setDownloadProgress: setDownload
  };
};