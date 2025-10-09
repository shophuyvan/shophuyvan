import React, { CSSProperties } from "react";

export interface ListItemProps {
    /**
     * Tiêu đề của list item.
     */
    title?: string;
    /**
     * Tiêu đề phụ của list item. Nằm bên dưới tiêu đề chính.
     */
    subTitle?: string;
    /**
     * Phần tử cần được hiển thị ở đầu list item. Thường là icon.
     */
    prefix?: React.ReactNode;
    /**
     * Phần tử cần được hiển thị ở cuối list item. Thường là icon.
     */
    suffix?: React.ReactNode;
    /**
     * Nội dung nằm bên trong ngoặc, phía sau tiêu đề chính của list item. Thường được dùng để bổ sung thêm thông tin.
     */
    brackets?: string;
    /**
     * Phần tử cần được hiển thị trực tiếp bên trong list item. Nằm bên dưới tiêu đề chính và tiêu đề phụ.
     */
    children?: React.ReactNode;
    /**
     * Inline style của list item.
     */
    style?: CSSProperties;
    /**
     * CSS class của list item.
     */
    className?: string;
    id?: string;
    /**
     * Callback được gọi khi list item được click / press.
     */
    onClick?: React.MouseEventHandler<HTMLElement>;
}

export interface ListProps<T> {
    /**
     * Dùng `dataSource` kết hợp với `renderItem` để hiển thị danh sách các phần tử, thay vì truyền trực tiếp các phần tử dưới dạng children.
     *
     * Data source bắt buộc phải là một mảng các giá trị, kiểu giá trị có thể là bất kỳ kiểu dữ liệu nào.
     */
    dataSource?: T[];
    /**
     * Hàm dùng để render từng item trong `dataSource`. Hàm này nhận vào 3 tham số:
     *
     * - `item`: Giá trị cần được render, được lấy từ `dataSource`.
     * - `index`: Vị trí hiện tại của item đang cần được render.
     * - `loading`: Trạng thái loading của danh sách.
     *
     * Kết quả trả về một `ReactNode`, khuyến khích là `<ListItem>`.
     */
    renderItem?: (item: T, index: number, loading?: boolean) => React.ReactNode;
    /**
     * Trạng thái loading của danh sách.
     *
     * @default false
     */
    loading?: boolean;
    /**
     * Hiển thị viền ngăn cách giữa các phần tử trong danh sách.
     *
     * @default true
     */
    divider?: boolean;
    /**
     * Không hiển thị khoảng cách giữa các phần tử trong danh sách.
     *
     * @default false
     */
    noSpacing?: boolean;
    /**
     * Các phần tử cần được hiển thị trong danh sách. _Không có tác dụng khi sử dụng cùng với `dataSource`._
     */
    children?: React.ReactNode;
    /**
     * Inline style của danh sách.
     */
    style?: CSSProperties;
    /**
     * CSS class của danh sách.
     */
    className?: string;
    id?: string;
}

export interface CompoundedComponent<T>
    extends React.ForwardRefExoticComponent<
        ListProps<T> & React.RefAttributes<HTMLUListElement>
    > {
    Item: React.FunctionComponent<ListItemProps>;
}

declare const List: CompoundedComponent<unknown>;

export default List;


