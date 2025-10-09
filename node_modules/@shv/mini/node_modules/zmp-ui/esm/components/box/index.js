import _extends from "@babel/runtime/helpers/extends";
import _defineProperty from "@babel/runtime/helpers/defineProperty";
import _objectWithoutPropertiesLoose from "@babel/runtime/helpers/objectWithoutPropertiesLoose";
var _excluded = ["id", "children", "className", "style", "m", "p", "mt", "ml", "mb", "mr", "mx", "my", "pt", "pl", "pb", "pr", "px", "py", "noSpace", "inline", "width", "height", "verticalAlign", "textAlign", "flex", "flexDirection", "flexWrap", "justifyContent", "alignItems", "alignContent"];
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
import React from "react";
import classNames from "clsx";
import { isValidBoxProps, validateSpacingNumber } from "./utils";
import { BoxPropsKeys } from "./utils/constants";
import { getPrefixCls } from "../../utils/class";

/**
 * Box là component giúp bao bọc các element giúp thêm khoảng cách giữa các element một cách dễ dàng theo spacing system của Zalo Mini App. 
 * Ngoài ra box còn hỗ trợ tạo nhanh Flex Layout.
 * @category Layout
 * @subcategory Box
 * @component
 *
 * @example
import React from "react";
import { Page, Box } from "zmp-ui";

function HomePage(props){
    return (
        <Page>
            <Box m={1}>
                <Button size="large">Button</Button>
            </Box>
        </Page>
    );
}
 */
var Box = /*#__PURE__*/React.forwardRef(function (props, ref) {
  var _classNames;
  var id = props.id,
    children = props.children,
    className = props.className,
    style = props.style,
    _props$m = props.m,
    m = _props$m === void 0 ? -1 : _props$m,
    _props$p = props.p,
    p = _props$p === void 0 ? -1 : _props$p,
    _props$mt = props.mt,
    mt = _props$mt === void 0 ? -1 : _props$mt,
    _props$ml = props.ml,
    ml = _props$ml === void 0 ? -1 : _props$ml,
    _props$mb = props.mb,
    mb = _props$mb === void 0 ? -1 : _props$mb,
    _props$mr = props.mr,
    mr = _props$mr === void 0 ? -1 : _props$mr,
    _props$mx = props.mx,
    mx = _props$mx === void 0 ? -1 : _props$mx,
    _props$my = props.my,
    my = _props$my === void 0 ? -1 : _props$my,
    _props$pt = props.pt,
    pt = _props$pt === void 0 ? -1 : _props$pt,
    _props$pl = props.pl,
    pl = _props$pl === void 0 ? -1 : _props$pl,
    _props$pb = props.pb,
    pb = _props$pb === void 0 ? -1 : _props$pb,
    _props$pr = props.pr,
    pr = _props$pr === void 0 ? -1 : _props$pr,
    _props$px = props.px,
    px = _props$px === void 0 ? -1 : _props$px,
    _props$py = props.py,
    py = _props$py === void 0 ? -1 : _props$py,
    noSpace = props.noSpace,
    inline = props.inline,
    width = props.width,
    height = props.height,
    _props$verticalAlign = props.verticalAlign,
    verticalAlign = _props$verticalAlign === void 0 ? "" : _props$verticalAlign,
    _props$textAlign = props.textAlign,
    textAlign = _props$textAlign === void 0 ? "" : _props$textAlign,
    flex = props.flex,
    _props$flexDirection = props.flexDirection,
    flexDirection = _props$flexDirection === void 0 ? "" : _props$flexDirection,
    flexWrap = props.flexWrap,
    _props$justifyContent = props.justifyContent,
    justifyContent = _props$justifyContent === void 0 ? "" : _props$justifyContent,
    _props$alignItems = props.alignItems,
    alignItems = _props$alignItems === void 0 ? "" : _props$alignItems,
    _props$alignContent = props.alignContent,
    alignContent = _props$alignContent === void 0 ? "" : _props$alignContent,
    rest = _objectWithoutPropertiesLoose(props, _excluded);
  var prefixCls = getPrefixCls("box");
  var classes = classNames(prefixCls, (_classNames = {}, _classNames[prefixCls + "-no-space"] = noSpace, _classNames[prefixCls + "-inline"] = inline, _classNames[prefixCls + "-m-" + m] = validateSpacingNumber(m), _classNames[prefixCls + "-mt-" + mt] = validateSpacingNumber(mt), _classNames[prefixCls + "-ml-" + ml] = validateSpacingNumber(ml), _classNames[prefixCls + "-mb-" + mb] = validateSpacingNumber(mb), _classNames[prefixCls + "-mr-" + mr] = validateSpacingNumber(mr), _classNames[prefixCls + "-mx-" + mx] = validateSpacingNumber(mx), _classNames[prefixCls + "-my-" + my] = validateSpacingNumber(my), _classNames[prefixCls + "-p-" + p] = validateSpacingNumber(p), _classNames[prefixCls + "-pt-" + pt] = validateSpacingNumber(pt), _classNames[prefixCls + "-pl-" + pl] = validateSpacingNumber(pl), _classNames[prefixCls + "-pb-" + pb] = validateSpacingNumber(pb), _classNames[prefixCls + "-pr-" + pr] = validateSpacingNumber(pr), _classNames[prefixCls + "-px-" + px] = validateSpacingNumber(px), _classNames[prefixCls + "-py-" + py] = validateSpacingNumber(py), _classNames[prefixCls + "-flex"] = flex, _classNames[prefixCls + "-flex-" + flexDirection] = isValidBoxProps(flexDirection, BoxPropsKeys.flexDirection), _classNames[prefixCls + "-vertical-align-" + verticalAlign] = isValidBoxProps(verticalAlign, BoxPropsKeys.verticalAlign), _classNames[prefixCls + "-text-align-" + textAlign] = isValidBoxProps(textAlign, BoxPropsKeys.textAlign), _classNames[prefixCls + "-flex-wrap"] = flexWrap === true, _classNames[prefixCls + "-flex-nowrap"] = flexWrap === false, _classNames[prefixCls + "-justify-" + justifyContent] = isValidBoxProps(justifyContent, BoxPropsKeys.justifyContent), _classNames[prefixCls + "-align-items-" + alignItems] = isValidBoxProps(alignItems, BoxPropsKeys.alignItems), _classNames[prefixCls + "-align-content-" + alignContent] = isValidBoxProps(alignContent, BoxPropsKeys.alignContent), _classNames), className);
  var boxStyle = _objectSpread({}, style || {});
  if (width) {
    boxStyle.width = width;
  }
  if (height) {
    boxStyle.height = height;
  }
  return /*#__PURE__*/React.createElement("div", _extends({}, rest, {
    ref: ref,
    id: id,
    style: boxStyle,
    className: classes
  }), children);
});
export default Box;