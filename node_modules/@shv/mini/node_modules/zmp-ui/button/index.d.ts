
	import React from "react";

export type NativeButtonProps = {
    onClick?: React.MouseEventHandler<HTMLElement>;
} & Omit<React.ButtonHTMLAttributes<unknown>, "type" | "onClick">;

/**
 * @category General
 * @subcategory Button
 * @displayName Button
 */
export interface ButtonProps extends NativeButtonProps {
    className?: string;
    style?: React.CSSProperties;
    /**
     * Kiểu biến thể của nút. Có thể nhận một trong các giá trị sau:
     * - `primary`: Nút chính, có màu đậm và làm nổi bật các thao tác quan trọng
     * - `secondary`: Nút phụ, màu nhạt hơn để tập trung sự chú ý của người dùng vào các thao tác khác quan trọng hơn
     * - `tertiary`: Nút thứ ba, có màu trắng và thường được sử dụng cho các thao tác ít quan trọng hơn cả nút phụ
     *
     * @defaultvalue 'primary'
     */
    variant?: "primary" | "secondary" | "tertiary";
    /**
     * Hiển thị icon loading
     *
     * @defaultvalue false
     */
    loading?: boolean;
    /**
     * Trạng thái disable
     *
     * @defaultvalue false
     */
    disabled?: boolean;
    children?: React.ReactNode;
    /**
     * Loại thao tác của nút. Có thể nhận một trong các giá trị sau:
     * - highlight: Mang màu chủ đạo, làm nổi bật nút so với các thành phần khác trên ứng dụng
     * - danger: Có màu đỏ, nhấn mạnh thao tác của nút có thể dẫn đến những hệ quả quan trọng hoặc nguy hiểm
     * - neutral: Có màu trắng, trung hoà với các thành phần khác trên ứng dụng
     *
     * @defaultvalue 'highlight'
     */
    type?: "highlight" | "danger" | "neutral";
    /**
     * Thuộc tính `type` mặc định của thẻ `<button>`
     *
     * @defaultvalue 'button'
     */
    htmlType?: "submit" | "button" | "reset";
    /**
     * Độ lớn của nút.
     *
     * @default 'medium'
     */
    size?: "large" | "medium" | "small";
    /**
     * Nếu bật, nút sẽ có chiều rộng 100% của phần tử chứa nó.
     *
     * @default false
     */
    fullWidth?: boolean;
    /** Thêm prefix icon */
    prefixIcon?: React.ReactNode;
    /** Thêm suffix icon */
    suffixIcon?: React.ReactNode;
    /** Thêm icon cho button */
    icon?: React.ReactNode;
    ref?: React.MutableRefObject<HTMLButtonElement | null>;
}

	declare const Button: React.FunctionComponent<ButtonProps>;

	export default Button;
  