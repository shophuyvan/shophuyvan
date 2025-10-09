import React, { ReactNode } from "react";

export interface BottomNavigationItemProps {
    /**
     * Icon được hiển thị phía trên label.
     */
    icon?: ReactNode;
    /**
     * Icon được hiển thị khi tab item được active. Thuộc tính này sẽ ghi đè thuộc tính `icon`, hoặc nếu không được truyền thì `icon` sẽ được sử dụng.
     */
    activeIcon?: ReactNode;
    /**
     * ID của tab item.
     */
    id?: string;
    /**
     * Nội dung chữ của tab item.
     */
    label: ReactNode;
    className?: string;
    /**
     * Key định danh của tab item, mỗi tab trong cùng một `BottomNavigation` phải có một key khác nhau.
     */
    itemKey?: string;
    /**
     * Đường dẫn đến trang được kích hoạt khi tab item được click. Chỉ sử dụng khi sử dụng với `ZMPRouter` và `AnimationRoutes`.
     */
    linkTo?: string;
    style?: React.CSSProperties;
    /**
     * Callback được gọi khi tab item được click / press.
     */
    onClick?: (e: React.MouseEvent | React.KeyboardEvent) => void;
}

export interface BottomNavigationItemInternalProps
    extends BottomNavigationItemProps {
    onChange: (activeKey: string) => void;
    active?: boolean;
}

export interface BottomNavigationItem
    extends BottomNavigationItemInternalProps {
    key: string;
    node: React.ReactElement;
}

export interface BottomNavigationProps {
    id?: string;
    /**
     * Được sử dụng để chỉ định tab nào đang được chọn để hiển thị nội dung tương ứng _(active tab)_.
     *
     * Cần được sử dụng cùng với `onChange` để cập nhật lại giá trị.
     */
    activeKey?: string;
    /**
     * Được sử dụng để xử lý sự kiện khi tab được chọn thay đổi. Cần phải cập nhật lại giá trị của `activeKey` nếu được truyền vào.
     *
     * @param {string} activeKey Giá trị của tab được chọn (activeKey) được truyền vào hàm callback.
     */
    onChange?: (activeKey: string) => void;
    /**
     * Được sử dụng để chỉ định tab nào sẽ được chọn mặc định khi component được hiển thị.
     *
     * _Lưu ý: Thay đổi `defaultActiveKey` khi component đã được render sẽ không có tác dụng._
     */
    defaultActiveKey?: string;
    className?: string;
    style?: React.CSSProperties;
    children?: ReactNode;
    /**
     * Giữ `BottomNavigation` cố định ở phía dưới của ứng dụng và không scroll theo nội dung.
     *
     * @default false
     */
    fixed?: boolean;
    /**
     * Được sử dụng để xác định thứ tự hiển thị (`z-index`) của component BottomNavigation so với các thành phần khác có thể overlay trên ứng dụng.
     */
    zIndex?: number;
}

export interface BottomNavigationContextType {
    activeKey: string;
    items: BottomNavigationItem[];
}

export interface CompoundedComponent
    extends React.ForwardRefExoticComponent<
        BottomNavigationProps & React.RefAttributes<HTMLDivElement>
    > {
    Item: React.FunctionComponent<BottomNavigationItemProps>;
}

declare const BottomNavigation: CompoundedComponent;

export default BottomNavigation;


