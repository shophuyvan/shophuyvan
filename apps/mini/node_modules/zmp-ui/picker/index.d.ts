
	import { ReactNode } from "react";

export type InputStatus = "" | "error" | "success";
export type OptionValueType = string | number;

export interface PickerColumnOption {
    /**
     * Key phân biệt giữa các option
     */
    key?: string;
    /**
     * Giá trị của option, dùng để xác định option được chọn
     */
    value: OptionValueType;
    /**
     * Tên hiển thị của option đối với người dùng
     */
    displayName: string;
    /**
     * Trạng thái được chọn ban đầu
     *
     * @default false
     */
    selected?: boolean;
}

export interface PickerActionType {
    /**
     * Chữ trên nút
     */
    text?: string;
    /**
     * Callback được gọi khi action được click
     */
    onClick?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
    /**
     * Action này chỉ định việc đóng picker khi được click
     *
     * @default false
     */
    close?: boolean;
}

export type OnSelect = (value: PickerColumnOption) => void;

export type PickerTriggerProps = {
    /**
     * Phần tử dùng để kích hoạt hiển thị hộp thoại picker
     */
    children: React.ReactElement;
    /**
     * Phần tử hiển thị trong hộp thoại picker. Khuyến khích sử dụng `<PickerPanel />`.
     */
    popupElement: React.ReactElement;
    /**
     * Callback được gọi khi trạng thái hiển thị của picker thay đổi
     */
    onVisibilityChange?: (visibilityState: boolean) => void;
    /**
     * Trạng thái hiển thị mặc định của picker
     *
     * @default false
     */
    defaultOpen?: boolean;
    /**
     * Trạng thái hiển thị của picker, dùng để điều khiển picker từ bên ngoài. Cần được sử dụng cùng với `onVisibilityChange` để cập nhật lại trạng thái hiển thị của picker.
     *
     * @default false
     */
    visible?: boolean;
    /**
     * Mask là một lớp overlay màu xám được phủ lên các thành phần bên dưới hộp thoại của picker, ngăn không cho người dùng tương tác với các nội dung đó và tập trung vào hộp thoại được mở.
     *
     * @default false
     */
    mask?: boolean;
    /**
     * Cho phép đóng hộp thoại của picker khi click vào mask.
     *
     * @default false
     */
    maskClosable?: boolean;
};

export interface PickerColumnProps {
    /**
     * Tiền tố của các CSS class của cột
     */
    prefixCls?: string;
    /**
     * CSS class của cột
     */
    className?: string;
    /**
     * Mảng các lựa chọn bên trong cột.
     */
    options: PickerColumnOption[];
    /**
     * Tên định danh của cột, dùng để phân biệt các cột với nhau.
     */
    name: string;
    /**
     * Lựa chọn hiện tại. Giá trị được truyền vào phải trực tiếp nằm trong mảng `options`. Cần được sử dụng cùng với `onChange` để cập nhật lại giá trị lựa chọn.
     */
    value?: PickerColumnOption;
    /**
     * Giá trị mặc định của option được chọn. Tương tự với `value`, giá trị được truyền vào phải trực tiếp nằm trong mảng `options`.
     */
    defaultValue?: PickerColumnOption;
    /**
     * Callback được gọi khi lựa chọn được thay đổi. Cần phải cập nhật lại giá trị `value` nếu được truyền vào để đảm bảo lựa chọn được hiển thị đúng.
     */
    onChange?: (value: PickerColumnOption, name: string) => void;
}

export type PickerDataType = Omit<
    PickerColumnProps,
    "prefixCls" | "className" | "value" | "defaultValue"
>;
export interface PickerPanelProps {
    /**
     * Tiền tố của các CSS class của picker panel
     */
    prefixCls?: string;
    /**
     * CSS class của picker panel
     */
    className?: string;
    /**
     * Mảng chứa các thiết lập cho các cột cần hiển thị trong picker panel. Mỗi phần tử trong mảng tương ứng với một cột trong picker panel, theo thứ tự từ trái sang phải.
     */
    data: PickerDataType[];
    /**
     * Giá trị mặc định của các cột. Mỗi phần tử trong object tương ứng với một cột trong picker panel, với key là tên của cột và value là giá trị được chọn tương ứng.
     *
     * Khác với `defaultValue` của `<Picker>`, giá trị này là các thiết lập nằm trực tiếp trong mảng `options`, thay vì chỉ là giá trị của các thiết lập được chọn.
     */
    defaultValue?: { [name: string]: PickerColumnOption };
    /**
     * Giá trị của các cột. Mỗi phần tử trong object tương ứng với một cột trong picker panel, với key là tên của cột và value là giá trị được chọn tương ứng.
     *
     * Khác với `value` của `<Picker>`, giá trị này là các thiết lập nằm trực tiếp trong mảng `options`, thay vì chỉ là giá trị của các thiết lập được chọn.
     */
    value?: { [name: string]: PickerColumnOption };
    /**
     * Callback được gọi khi giá trị của các cột thay đổi. Cần phải cập nhật lại giá trị `value` nếu được truyền vào để đảm bảo lựa chọn được hiển thị đúng.
     */
    onChange?: (option: PickerColumnOption, name: string) => void;
    /**
     * Callback được gọi khi trạng thái hiển thị của picker thay đổi
     */
    onVisibilityChange?: (visibilityState: boolean) => void;
    /**
     * Callback được gọi khi hộp thoại picker được đóng
     */
    closePanel?: (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => void;
    /**
     * Các thiết lập cho nút xác nhận, hiển thị ở bên dưới hộp thoại của picker.
     */
    action?: PickerActionType;
    /**
     * Tiêu đề của hộp thoại picker
     */
    title?: string;
}

export interface PickerProps {
    /**
     * Nhãn của input được dùng làm phần tử kích hoạt hộp thoại picker. Được hiển thị phía trên input.
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
     */
    status?: InputStatus;
    /**
     * Placeholder của input của picker. Được hiển thị khi chưa có giá trị.
     */
    placeholder?: string;
    /**
     * Tiêu đề được hiển thị ở đầu hộp thoại của picker.
     */
    title?: string;
    /**
     * Mảng chứa các thiết lập cho các cột cần hiển thị trong picker panel. Mỗi phần tử trong mảng tương ứng với một cột trong picker panel, theo thứ tự từ trái sang phải.
     */
    data: PickerDataType[];
    /**
     * Vô hiệu hóa picker cũng như input được dùng để kích hoạt picker.
     *
     * @default false
     */
    disabled?: boolean;
    /**
     * Giá trị mặc định của picker. Thay đổi giá trị của `defaultValue` sau khi picker đã được render sẽ không có tác dụng.
     *
     * Được truyền vào dưới dạng object chứa `value` của các lựa chọn cần được chọn sẵn, với key là tên của cột tương ứng.
     */
    defaultValue?: { [name: string]: OptionValueType };
    /**
     * Giá trị hiện tại của picker. Cần được sử dụng cùng với `onChange` để cập nhật lại giá trị lựa chọn.
     *
     * Được truyền vào dưới dạng object chứa `value` của các lựa chọn người dùng đã chọn, với key là tên của cột tương ứng.
     */
    value?: { [name: string]: OptionValueType };
    /**
     * Mặc định hiển thị hộp thoại picker khi render.
     *
     * @default false
     */
    defaultOpen?: boolean;
    /**
     * Callback được gọi khi giá trị của các cột thay đổi. Cần phải cập nhật lại giá trị `value` nếu được truyền vào để đảm bảo lựa chọn được hiển thị đúng.
     */
    onChange?: (value: { [name: string]: PickerColumnOption }) => void;
    /**
     * Callback được gọi khi trạng thái hiển thị của hộp thoại picker thay đổi
     */
    onVisibilityChange?: (visibilityState: boolean) => void;
    /**
     * CSS class của input dùng để kích hoạt picker
     */
    inputClass?: string;
    /**
     * Mask là một lớp overlay màu xám được phủ lên các thành phần bên dưới hộp thoại của picker, ngăn không cho người dùng tương tác với các nội dung đó và tập trung vào hộp thoại được mở.
     *
     * @default false
     */
    mask?: boolean;
    /**
     * Cho phép đóng hộp thoại của picker khi click vào mask.
     *
     * @default false
     */
    maskClosable?: boolean;
    /**
     * Hàm dùng để format giá trị hiển thị của picker. Nhận vào một object chứa các thiết lập được chọn của các cột, và cần trả về một chuỗi để hiển thị trên input của picker.
     */
    formatPickedValueDisplay?: (value: {
        [name: string]: PickerColumnOption;
    }) => string;
    /**
     * Các thiết lập cho nút xác nhận, hiển thị ở bên dưới hộp thoại của picker.
     */
    action?: PickerActionType;
    /**
     * Phần tử nằm bên trái input của picker.
     */
    prefix?: ReactNode;
    /**
     * Phần tử nằm bên phải input của picker.
     */
    suffix?: ReactNode;
    /**
     * Tên định danh của picker, dùng với form để phân biệt các input với nhau.
     */
    name?: string;
    id?: string;
}

export interface PickerColumnState {
    isMoving: boolean;
    startTouchY: number;
    startScrollerTranslate: number;
    scrollerTranslate: number;
    minTranslate: number;
    maxTranslate: number;
}

	declare const Picker: React.FunctionComponent<PickerProps>;

	export default Picker;
  