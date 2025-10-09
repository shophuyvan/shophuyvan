
	import { CSSProperties, ReactNode, MutableRefObject } from "react";

export interface HeaderProps {
    /**
     * Tuỳ chỉnh nút back ở đầu header. Nếu như không được truyền vào, sẽ sử dụng nút back mặc định.
     */
    backIcon?: ReactNode;

    /**
     * Hiển thị nút back ở đầu header hoặc không.
     *
     * @default true
     */
    showBackIcon?: boolean;

    /**
     * Callback được gọi khi nút back được click.
     */
    onBackClick?: (e: React.MouseEvent) => void;

    /**
     * Màu nền của header.
     */
    backgroundColor?: string;

    /**
     * Màu chữ của header.
     */
    textColor?: string;

    /**
     * Tiêu đề của header.
     */
    title?: string;

    className?: string;
    style?: CSSProperties;
    id?: string;
    ref?: MutableRefObject<HTMLDivElement | null>;
}

	declare const Header: React.FunctionComponent<HeaderProps>;

	export default Header;
  