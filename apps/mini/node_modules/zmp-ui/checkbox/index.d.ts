import React from "react";

/**
 * @category Data Entry
 * @subcategory Checkbox
 * @displayName Checkbox
 */
export interface CheckboxProps {
    id?: string;
    className?: string;
    style?: React.CSSProperties;
    /** Trạng thái đánh dấu của checkbox.
     *
     * Cần được sử dụng cùng với `onChange` để cập nhật lại giá trị.
     *
     * @default false
     */
    checked?: boolean;
    /**
     * Callback được gọi khi trạng thái của checkbox thay đổi. Cần phải cập nhật lại giá trị của `checked` nếu được truyền vào.
     */
    onChange?: Function;
    /**
     * Trạng thái mặc định của checkbox.
     *
     * _Lưu ý: Thay đổi `defaultChecked` khi checkbox đã được render sẽ không có tác dụng._
     *
     * @default false
     */
    defaultChecked?: boolean;
    /**
     * Vô hiệu hóa checkbox.
     *
     * @default false
     */
    disabled?: boolean;
    /**
     * Tên của checkbox. Được sử dụng để gom nhóm các checkbox lại với nhau. Các checkbox có cùng `name` sẽ được xem là một nhóm.
     */
    name?: string;
    /**
     * Nhãn của checkbox, được hiển thị phía sau checkbox. Nếu cần hiển thị ReactNode, sử dụng `children` thay vì `label`.
     */
    label?: string;
    /**
     * Giá trị của checkbox.
     *
     * Khác với `checked` là trạng thái đánh dấu của checkbox, `value` được dùng để xác định giá trị của `CheckboxGroup` khi các checkbox bên trong nó được chọn. Nếu checkbox được chọn, giá trị của nó sẽ được thêm vào mảng `value` của `CheckboxGroup`, ngược lại sẽ được xóa khỏi mảng.
     *
     * @type {string | number}
     */
    value: string | number;
    /**
     * Độ lớn của checkbox.
     */
    size?: "medium" | "small";
    /**
     * Nếu bật, checkbox sẽ có thêm trạng thái không xác định. Trạng thái không xác định là trạng thái trung gian giữa `checked` và `unchecked`.
     *
     * @default false
     */
    indeterminate?: boolean;
    /**
     * Nội dung được hiển thị thay cho `label`, ở phía sau checkbox.
     */
    children?: React.ReactNode;
}

/**
 * @category Data Entry
 * @subcategory Checkbox
 * @displayName Checkbox.Group
 */
export interface CheckboxGroupProps {
    /**
     * Giá trị mặc định của checkbox group. Các checkbox bên trong group có thuộc tính `value` nằm trong mảng này sẽ được chọn sẵn.
     *
     * _Lưu ý: Thay đổi `defaultValue` khi checkbox group đã được render sẽ không có tác dụng._
     */
    defaultValue?: (string | number)[];

    /**
     * Giá trị của checkbox group. Các checkbox bên trong group có thuộc tính `value` nằm trong mảng này sẽ được chọn.
     *
     * Cần được sử dụng cùng với `onChange` để cập nhật lại giá trị.
     */
    value?: (string | number)[];

    /**
     * Callback được gọi khi trạng thái của checkbox group thay đổi. Cần phải cập nhật lại giá trị của `value` nếu được truyền vào.
     * @param checkedValue Mảng các giá trị của các checkbox được chọn.
     */
    onChange?: (checkedValue: (string | number)[]) => void;

    /**
     * Vô hiệu hóa checkbox group.
     */
    disabled?: boolean;

    /**
     * Tên của checkbox group. Được sử dụng để gom nhóm các checkbox lại với nhau. Các checkbox có cùng `name` sẽ được xem là một nhóm.
     */
    name?: string;

    /**
     * Độ lớn của các checkbox trong group.
     */
    size?: "medium" | "small";
    className?: string;
    style?: React.CSSProperties;
    /**
     * Thay vì render các `<Checkbox>` bên trong `<Checkbox.Group>`, có thể sử dụng `options` để quản lý các lựa chọn của group này.
     *
     * Tất cả các thuộc tính của `CheckboxProps` đều có thể được sử dụng trong `options`.
     */
    options?: CheckboxProps[];
    children?: React.ReactNode;
}

export interface CheckboxGroupContext {
    name?: string;
    value: (string | number)[];
    disabled?: boolean;
    size?: "medium" | "small";
    registerValue?: (val: string | number) => void;
    toggleOption?: (option: CheckboxProps) => void;
}

export type CheckboxValueType = CheckboxProps["value"];

export interface CompoundedComponent
    extends React.ForwardRefExoticComponent<
        CheckboxProps & React.RefAttributes<HTMLInputElement>
    > {
    Group: React.FunctionComponent<CheckboxGroupProps>;
}

declare const Checkbox: CompoundedComponent;

export default Checkbox;


