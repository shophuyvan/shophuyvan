
	import React from "react";
import { ButtonProps } from "../button/props-type";

export type MaskProps = {
    visible?: boolean;
    maskProps?: React.HTMLAttributes<HTMLDivElement>;
    children?: React.ReactNode;
    style?: React.CSSProperties;
    className?: string;
};

/**
 * @category Feedback
 * @subcategory Modal
 *
 * @typedef {object} ModalActions
 *
 */
export interface ModalActions extends ButtonProps {
    /**
     * Chữ trên nút
     */
    text: string;
    /**
     * Inline style của action
     */
    style?: React.CSSProperties;
    /**
     * CSS class của action
     */
    className?: string;
    /**
     * Hiển thị action dưới dạng nút highlight
     *
     * @default false
     */
    highLight?: boolean;
    /**
     * Hiển thị action dưới dạng nút danger
     *
     * @default false
     */
    danger?: boolean;
    /**
     * Callback được gọi khi action được click
     */
    onClick?: (e: React.MouseEvent) => void;
    /**
     * Nếu được set thành `true`, action sẽ đóng modal khi được click
     *
     * @default false
     */
    close?: boolean;
    /**
     * Trạng thái hoạt động của action
     *
     * @default false
     */
    disabled?: boolean;
    key?: string;
}

/**
 * @category Feedback
 * @subcategory Modal
 * @displayName Modal
 */
export interface ModalProps {
    /**
     * CSS class của hộp thoại
     */
    className?: string;
    /**
     * Inline style của hộp thoại
     */
    style?: React.CSSProperties;
    /**
     * Mask là một lớp overlay màu xám được phủ lên các thành phần bên dưới hộp thoại, ngăn không cho người dùng tương tác với các nội dung đó và tập trung vào hộp thoại được mở.
     *
     * @default true
     */
    mask?: boolean;
    /**
     * Callback được gọi sau khi hộp thoại đóng
     */
    afterClose?: () => void;
    /**
     * Callback được gọi khi người dùng yêu cầu đóng hộp thoại. Cần phải cập nhật lại giá trị của `visible` nếu truyền vào.
     */
    onClose?: (e: React.SyntheticEvent) => void;
    /**
     * Cho phép đóng hộp thoại khi click vào mask.
     *
     * @default true
     */
    maskClosable?: boolean;
    /**
     * Trạng thái hiển thị của hộp thoại. Cần được sử dụng chung với `onClose` để cập nhật lại giá trị của `visible` khi người dùng yêu cầu đóng hộp thoại.
     *
     * @default false
     */
    visible?: boolean;
    /**
     * Tiêu đề của hộp thoại, được hiển thị ở phía trên cùng của hộp thoại.
     */
    title?: string;
    /**
     * Đường dẫn đến hình ảnh cover của hộp thoại
     */
    coverSrc?: string;
    /**
     * Inline style cho hộp thoại
     */
    modalStyle?: React.CSSProperties;
    /**
     * Inline style cho mask
     */
    maskStyle?: React.CSSProperties;
    /**
     * CSS class cho modal
     */
    modalClassName?: string;
    /**
     * CSS class cho mask
     */
    maskClassName?: string;
    /**
     * Độ rộng của hộp thoại. Nếu không được thiết lập, modal sẽ có độ rộng mặc định theo độ rộng của nội dung và chiều rộng của màn hình.
     */
    width?: string | number;
    /**
     * Chiều cao của hộp thoại. Nếu không được thiết lập, modal sẽ có chiều cao mặc định theo chiều cao của nội dung và chiều cao của màn hình.
     */
    height?: string | number;
    /**
     * Nội dung của hộp thoại, được hiển thị phía dưới tiêu đề. Nếu nội dung cần hiển thị không phải là text, sử dụng `children` để truyền ReactNode vào thay vì `description`.
     */
    description?: string;
    /**
     * Mảng thiết lập các nút để người dùng thực hiện các hành động trên hộp thoại.
     *
     * @type ModalActions
     */
    actions?: ModalActions[];
    /**
     * Hiển thị các action theo chiều dọc, thay vì mặc định là theo chiều ngang.
     *
     * @default false
     */
    verticalActions?: boolean;
    /**
     * Nội dung của hộp thoại, được hiển thị ở dưới description và trên các action.
     */
    children?: React.ReactNode;
    /**
     * Hiển thị viền phân cách giữa các action.
     *
     * @default false
     */
    actionsDivider?: boolean;
    /**
     * Độ sâu của hộp thoại, dùng để xác định thứ tự hiển thị của hộp thoại trong trường hợp có nhiều modal được mở cùng lúc.
     */
    zIndex?: number;
    /**
     * Mặc định khi người dùng đóng hộp thoại, modal vẫn còn được render trong DOM và chỉ bị ẩn đi. Thiết lập này cho phép gỡ hộp thoại khỏi cây DOM hoàn toàn sau khi đóng.
     * Thiết lập này có thể giúp giảm bộ nhớ được sử dụng trong trường hợp hộp thoại có nội dung lớn. Tuy nhiên, khi hộp thoại được mở lại, nội dung của hộp thoại sẽ được render lại từ đầu. Phù hợp với những hộp thoại chỉ sử dụng một lần.
     *
     * @default false
     */
    unmountOnClose?: boolean;
    ref?: React.MutableRefObject<HTMLDivElement>;
}

export interface ModalContentProps extends ModalProps {
    ariaId?: string;
    /**
     * Callback được gọi khi trạng thái hiển thị của hộp thoại thay đổi.
     */
    onVisibleChanged?: (visible: boolean) => void;
    /**
     * Callback được gọi khi người dùng click/tap vào nội dung của hộp thoại.
     */
    onMouseDown?: React.MouseEventHandler;
    /**
     * Callback được gọi khi người dùng thả tay ra khỏi nội dung của hộp thoại.
     */
    onMouseUp?: React.MouseEventHandler;
    modalRef?: React.MutableRefObject<HTMLDivElement>;
}

	declare const Modal: React.FunctionComponent<ModalProps>;

	export default Modal;
  