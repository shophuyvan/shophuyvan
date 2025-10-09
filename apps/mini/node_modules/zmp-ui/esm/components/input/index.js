import InternalInput from "./Input";
import Password from "./Password";
import Search from "./Search";
import TextArea from "./TextArea";
import OTP from "./OTP";
/**
 * @category Form
 * @subcategory Input
 * @component
 * @typedef {object} Input
 * @prop {string} [label] - Label hiển thị phía trên của field input.
 * @prop {string} [status] - Trạng thái của field input. Nhận các giá trị: `success` | `error`
 * @prop {string} [helperText] - Helper text hiển thị phía dưới của field input.
 * @prop {string} [errorText] - Text hiển thị khi status của field input là `error`
 * @prop {boolean | { mode: "focus" | "always" }} [clearable] - Nếu cho phép sẽ hiển thị clear icon.
 * @prop {number} [maxLength] - Giới hạn độ dài tối đa được phép nhập
 *
 * @example
import React from "react";
import { Page, Input } from "zmp-ui";

function HomePage(props){
    return (
        <Page>
          <Input label="Label" helperText="Helper text" />
        </Page>
    );
}
 */
var Input = InternalInput;

/**
 * Hỗ trợ tất cả các props của component Input
 *
 * @category Form
 * @subcategory Input
 * @component
 * @typedef {object} Input.Password
 * @prop {boolean} [visibilityToggle] - Hiển thị icon hiện/ẩn password
 *
 * @example
import React from "react";
import { Page, Input } from "zmp-ui";

function HomePage(props){
    return (
        <Page>
          <Input.Password label="Label" helperText="Helper text" visibilityToggle />
        </Page>
    );
}
 */
Input.Password = Password;

/**
 * Hỗ trợ tất cả các props của component Input
 *
 * @category Form
 * @subcategory Input
 * @component
 * @typedef {object} Input.Search
 * @prop {boolean} [loading] - Hiển thị icon loading khi trạng thái đang search
 * @prop {function} [onSearch] - Sự kiện khi người dùng search. Nhận về giá trị được nhập
 *
 *
 * @example
import React from "react";
import { Page, Input } from "zmp-ui";

function HomePage(props){
    return (
      <Page>
        <Input.Search
          label="Label"
          helperText="Helper text"
          loading
          onSearch={(text) => console.log(text)}
        />
      </Page>
    );
}
 */
Input.Search = Search;

/**
 * Hỗ trợ tất cả các props của component Input
 *
 * @category Form
 * @subcategory Input
 * @component
 * @typedef {object} Input.TextArea
 * @prop {boolean} [autoSize] - Chiều dài của field sẽ theo chiều dài của text
 * @prop {boolean} [showCount] - Hiển thị số lượng ký tự
 *
 *
 * @example
import React from "react";
import { Page, Input } from "zmp-ui";

function HomePage(props){
    return (
        <Page>
          <Input.TextArea label="Label" helperText="Helper text" showCount />
        </Page>
    );
}
 */
Input.TextArea = TextArea;

/**
 * Hỗ trợ tất cả các props của component Input
 *
 * @category Form
 * @subcategory Input
 * @component
 * @typedef {object} Input.OTP
 * @prop {number} [otpLength=4] - Số lượng ô input cần hiển thị
 * @prop {boolean} [show] - Nếu là false thì hiển thị ký tự *
 *
 *
 * @example
import React from "react";
import { Page, Input } from "zmp-ui";

function HomePage(props){
    return (
        <Page>
          <Input.OTP show otpLength={6} />
        </Page>
    );
}
 */
Input.OTP = OTP;
export default Input;