
	import React, { ReactNode } from "react";
import { OptionValueType, PickerColumnOption } from "../picker/props-type";

export interface DatePickerActionType {
    /**
     * Chữ trên nút.
     */
    text?: string;

    /**
     * Nhấn vào nút sẽ đóng hộp thoại date picker.
     *
     * @default false
     */
    close?: boolean;

    /**
     * Callback được gọi khi nhấn vào nút.
     */
    onClick?: (event: React.MouseEvent<HTMLElement, MouseEvent>) => void;
}

export type DateColumns = PickerColumnOption;

export interface DatePickerProps {
    /**
     * Nhãn của input date picker. Sẽ được hiển thị phía trên input.
     */
    label?: string;

    /**
     * Helper text là phần văn bản ngắn nằm dưới các ô nhập liệu. Nội dung của các văn bản này thường chứa thông tin hướng dẫn giúp người dùng hiểu rõ hơn về tác dụng hoặc mô tả định dạng của dữ liệu được khuyến khích nhập vào.
     */
    helperText?: string;

    /**
     * Error text là phần văn bản ngắn nằm dưới các ô nhập liệu. Nội dung của các văn bản này thường chứa thông tin cảnh báo về lỗi của dữ liệu được nhập vào, cũng như hướng dẫn cách khắc phục.
     *
     * `errorText` sẽ được hiển thị thay cho `helperText` khi `status` có giá trị là `error`.
     */
    errorText?: string;

    /**
     * Trạng thái hiện tại của input date picker. Nếu là `error`, input sẽ có màu cảnh báo kèm theo `errorText`, ngược lại input sẽ có màu trung hoà kèm theo `helperText`.
     * @default ''
     */
    status?: "" | "error" | "success";

    /**
     * Placeholder của input date picker. Được hiển thị khi chưa có giá trị.
     */
    placeholder?: string;

    /**
     * Tiêu đề của hộp thoại date picker.
     */
    title?: string;

    /**
     * Vô hiệu hóa input date picker.
     *
     * @default false
     */
    disabled?: boolean;

    /**
     * Ngày bắt đầu của date picker. Người dùng sẽ không thể chọn ngày trước ngày này.
     */
    startDate?: Date;

    /**
     * Ngày kết thúc của date picker. Người dùng sẽ không thể chọn ngày sau ngày này.
     */
    endDate?: Date;

    /**
     * Năm bắt đầu của date picker. Người dùng sẽ không thể chọn năm trước năm này.
     */
    startYear?: number;

    /**
     * Năm kết thúc của date picker. Người dùng sẽ không thể chọn năm sau năm này.
     */
    endYear?: number;

    /**
     * Hàm dùng để định dạng nội dung hiển thị của input date picker dựa trên giá trị ngày đang chọn.
     *
     * Khác với `dateFormat` là một chuỗi định dạng ngày tháng năm, `formatPickedValueDisplay` là một hàm nhận vào giá trị ngày đang chọn và trả về chuỗi hiển thị, và chuối hiển thị này có thể không phải là ngày tháng năm.
     * @param date Giá trị ngày đang chọn.
     * @returns Chuỗi hiển thị của input date picker.
     */
    formatPickedValueDisplay?: (date: Date) => string;

    /**
     * Định dạng ngày tháng năm của date picker input.
     * - Ngày: `dd`
     * - Tháng: `mm`, `m`, `MM` (kiểu chữ), `M` (kiểu chữ tắt)
     * - Năm: `yyyy`, `yy`
     */
    dateFormat?: string;

    /**
     * Sắp xếp vị trí xuất hiện tương ứng của các cột ngày, tháng, năm trong date picker.
     *
     * `DD` tương ứng với cột ngày, `MM` tương ứng với cột tháng, `YYYY` tương ứng với cột năm.
     */
    columnsFormat?: "MM-DD-YYYY" | "DD-MM-YYYY" | "YYYY-MM-DD";

    /**
     * Mặc định mở hộp thoại date picker khi khởi tạo.
     *
     * @default false
     */
    defaultOpen?: boolean;

    /**
     * Ngày mặc định được chọn sẵn khi khởi tạo date picker.
     *
     * _Lưu ý: thay đổi giá trị của `defaultValue` sau khi khởi tạo date picker sẽ không có tác dụng._
     */
    defaultValue?: Date;

    /**
     * Ngày được chọn. Cần được sử dụng cùng với `onChange` để cập nhật lại giá trị cho date picker sau khi người dùng thay đổi.
     */
    value?: Date;

    /**
     * Callback được gọi khi người dùng thay đổi giá trị của date picker. Tham số truyền vào là giá trị mới của date picker.
     * @param value Ngày được chọn.
     * @param pickedValue Ngày được chọn theo định dạng của `columnsFormat`.
     * @returns {void}
     */
    onChange?: (
        value: Date,
        pickedValue: {
            [name: string]: OptionValueType;
        }
    ) => void;

    /**
     * Callback được gọi khi người dùng mở / đóng hộp thoại date picker.
     * @param visibilityState Trạng thái mở /đóng hiện tại của hộp thoại date picker.
     * @returns {void}
     */
    onVisibilityChange?: (visibilityState: boolean) => void;

    /**
     * Mask là một lớp overlay màu xám được phủ lên các thành phần bên dưới hộp thoại date picker, ngăn không cho người dùng tương tác với các nội dung đó và tập trung vào hộp thoại được mở.
     *
     * @default true
     */
    mask?: boolean;

    /**
     * Tự động đóng hộp thoại date picker khi người dùng nhấn vào mask. Cần phải bật thuộc tính `mask` để sử dụng tính năng này.
     *
     * @default true
     */
    maskClosable?: boolean;

    /**
     * Thêm action button cho hộp thoại date picker.
     */
    action?: DatePickerActionType;

    /**
     * Thêm CSS class cho input của date picker.
     */
    inputClass?: string;

    /**
     * Thêm nội dung vào đầu input của date picker. Thường được sử dụng để hiển thị icon.
     */
    prefix?: ReactNode;

    /**
     * Thêm nội dung vào cuối input của date picker. Thường được sử dụng để hiển thị icon.
     */
    suffix?: ReactNode;

    /**
     * Ngôn ngữ hiển thị của date picker, được truyền vào dưới dạng mã ngôn ngữ BCP 47, ví dụ: `vi-VN`, `en-US`.
     */
    locale?: string;
}

export type InputStatus = DatePickerProps["status"];

	declare const DatePicker: React.FunctionComponent<DatePickerProps>;

	export default DatePicker;
  