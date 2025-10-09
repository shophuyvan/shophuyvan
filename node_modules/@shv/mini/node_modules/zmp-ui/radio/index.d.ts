import React, { ChangeEvent } from "react";

export type RadioValueType = string | number;

/**
 * @category Data Entry
 * @subcategory Radio
 * @displayName Radio
 *
 */
export interface RadioProps {
    /**
     * Trạng thái được chọn của radio. Cần được sử dụng cùng với `onChange` để thay đổi giá trị khi người dùng thao tác.
     *
     * @default false
     */
    checked?: boolean;
    /**
     * Trạng thái đánh dấu mặc định của radio.
     *
     * @default false
     */
    defaultChecked?: boolean;
    /**
     * CSS class của radio.
     */
    className?: string;
    /**
     * Inline style của radio.
     */
    style?: React.CSSProperties;
    /**
     * Trạng thái vô hiệu hoá của radio.
     *
     * @default false
     */
    disabled?: boolean;
    id?: string;
    /**
     * Tên định danh của radio. Được sử dụng để nhóm các radio lại với nhau trong `Radio.Group`.
     */
    name?: string;
    /**
     * Nhãn của radio, được hiển thị bên cạnh radio. Nếu cần hiển thị ReactNode, sử dụng `children`.
     */
    label?: string;
    /**
     * Giá trị của radio, được sử dụng để nhận biết radio nào được chọn trong `Radio.Group`.
     *
     * @type {string | number}
     */
    value?: RadioValueType;
    /**
     * Độ lớn của radio.
     *
     * @default 'medium'
     */
    size?: "medium" | "small";
    /**
     * Được sử dụng thay cho `label` khi cần hiển thị nội dung phức tạp hơn. Được render bên phải radio.
     */
    children?: React.ReactNode;
    /**
     * Callback được gọi khi giá trị của radio thay đổi. Nếu `checked` được sử dụng, cần phải cập nhật lại giá trị của `checked` trong callback này.
     * @function onChange
     * @param {ChangeEvent<HTMLInputElement>} input event
     */
    onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * @category Data Entry
 * @subcategory Radio
 * @displayName Radio.Group
 */
export interface RadioGroupProps {
    /**
     * `Radio` với `value` khớp với giá trị này sẽ được chọn sẵn. Thay đổi giá trị này sau khi render sẽ không có tác dụng.
     */
    defaultValue?: RadioValueType;
    /**
     * Giá trị hiện tại của radio group. Cụ thể hơn là thuộc tính `value` của `Radio` đang được chọn trong nhóm các `Radio` có cùng `name`.
     *
     * Cần được sử dụng cùng với `onChange` để thay đổi giá trị khi người dùng thao tác.
     */
    value?: RadioValueType;
    /**
     * Trạng thái vô hiệu hoá của radio group, cũng như các radio con bên trong.
     *
     * @default false
     */
    disabled?: boolean;
    /**
     * Tên định danh của radio group. Được sử dụng để nhóm các radio lại với nhau.
     */
    name?: string;
    /**
     * Độ lớn của radio group.
     *
     * @default 'medium'
     */
    size?: "medium" | "small";
    /**
     * CSS class của radio group.
     */
    className?: string;
    /**
     * Inline style của radio group.
     */
    style?: React.CSSProperties;
    /**
     * Mảng các thiết lập để tạo ra các radio trong group. Nếu cần hiển thêm khác phần tử khác radio, sử dụng `children` thay vì `options`.
     *
     * @type Array
     * @defaultValue []
     */
    options?: RadioProps[];
    /**
     * Callback được gọi khi giá trị của radio group thay đổi. Cụ thể hơn là khi có một radio trong group được chọn hoặc thay thế radio đang được chọn trước đó. Nếu `value` được sử dụng, cần phải cập nhật lại giá trị của `value` trong callback này.
     *
     * @param {string|number} value Giá trị được chọn.
     */
    onChange?: (value: RadioValueType) => void;
    /**
     * Dùng để render các `<Radio>` trong group cũng như các phần tử khác. Không sử dụng cùng với `options`.
     */
    children?: React.ReactNode;
}

export interface RadioGroupContext {
    /**
     * Tên định danh của radio group.
     */
    name?: string;
    /**
     * Giá trị hiện tại của radio group.
     */
    value?: RadioValueType;
    /**
     * Trạng thái vô hiệu hoá của radio group.
     *
     * @default false
     */
    disabled?: boolean;
    /**
     * Độ lớn của radio group.
     */
    size?: "medium" | "small";
    /**
     * Callback được gọi khi giá trị của radio group thay đổi.
     */
    onChange?: (checkedValue: ChangeEvent<HTMLInputElement>) => void;
}

export interface CompoundedComponent
    extends React.ForwardRefExoticComponent<
        RadioProps & React.RefAttributes<HTMLInputElement>
    > {
    Group: React.FunctionComponent<RadioGroupProps>;
}

declare const Radio: CompoundedComponent;

export default Radio;


