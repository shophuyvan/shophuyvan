
	import React, { ReactNode } from "react";

/**
 * @category Container
 * @subCategory Page
 * @displayName Page
 */
export interface PageProps
    extends React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLDivElement>,
        HTMLDivElement
    > {
    /**
     * Nội dung của trang
     */
    children?: ReactNode;
    /**
     * Inline style của trang
     */
    style?: React.CSSProperties;
    /**
     * Khi dùng với React Router, mặc định vị trí scroll của sẽ giữ nguyên khi navigate giữa các trang. Thuộc tính này sẽ reset scroll về đầu trang khi navigate giữa các trang, tương tự như cơ chế chuyển trang thông thường.
     *
     * @default true
     */
    resetScroll?: boolean;
    /**
     * Ẩn thanh cuộn của trang (scrollbar)
     *
     * @default false
     */
    hideScrollbar?: boolean;
    /**
     * Khôi phục lại vị trí scroll của trang nếu đã được scroll trước đây. Khác với `resetScrollOnBack`, thuộc tính này sẽ luôn khôi phục lại vị trí scroll bất kể được navigate đến từ đâu.
     *
     * @default false
     */
    restoreScroll?: boolean;
    /**
     * Khôi phục lại vị trí scroll của trang khi quay về từ một trang khác (khi người dùng nhấn nút back, thực hiện cử chỉ vuốt từ cạnh màn hình, hoặc `navigate(-1)` từ code).
     *
     * @default false
     */
    restoreScrollOnBack?: boolean;
    /**
     * Tên của trang, dùng để phân biệt các trang với nhau.
     *
     * Thuộc tính này còn có thể sử dụng để định danh vị trí scroll của trang, nếu `restoreScroll` hoặc `restoreScrollOnBack` được thiết lập.
     */
    name?: string;
}

	declare const Page: React.FunctionComponent<PageProps>;

	export default Page;
  