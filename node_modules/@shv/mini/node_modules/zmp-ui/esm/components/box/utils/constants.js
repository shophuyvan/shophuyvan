/* eslint-disable sonarjs/no-duplicate-string */
export var BoxPropsKeys = /*#__PURE__*/function (BoxPropsKeys) {
  BoxPropsKeys["textAlign"] = "textAlign";
  BoxPropsKeys["verticalAlign"] = "verticalAlign";
  BoxPropsKeys["justifyContent"] = "justifyContent";
  BoxPropsKeys["alignItems"] = "alignItems";
  BoxPropsKeys["alignContent"] = "alignContent";
  BoxPropsKeys["flexDirection"] = "flexDirection";
  return BoxPropsKeys;
}({});
export var BOX_PROPS = {
  textAlign: ["left", "right", "center", "justify", "initial", "inherit"],
  verticalAlign: ["baseline", "sub", "super", "top", "text-top", "middle", "bottom", "text-bottom", "initial", "inherit"],
  justifyContent: ["flex-start", "flex-end", "center", "space-between", "space-around", "space-evenly", "initial"],
  alignItems: ["flex-start", "flex-end", "stretch", "baseline", "center", "initial"],
  alignContent: ["stretch", "center", "flex-start", "flex-end", "space-between", "space-around", "space-evenly"],
  flexDirection: ["row", "column", "row-reverse", "column-reverse"]
};