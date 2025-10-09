import React, {
    CSSProperties,
    ForwardRefExoticComponent,
    RefAttributes,
} from "react";

export interface TabProps {
    /**
     * Nội dung cần được hiển thị bên bên trong tab
     */
    children?: React.ReactNode;
    /**
     * CSS class của tab
     */
    className?: string;
    /**
     * Inline style của tab
     */
    style?: CSSProperties;
    /**
     * Trạng thái vô hiệu hóa của tab, người dùng sẽ không thể chuyển đổi sang tab này
     *
     * @default false
     */
    disabled?: boolean;
    /**
     * Nhãn của tab, dùng để chuyển đổi giữa các tab
     */
    label?: React.ReactNode;
}

export interface InternalTabProps extends TabProps {
    id?: string;
    /**
     * Tự động dọn dẹp các tab không được chọn
     *
     * @default false
     */
    destroyInactiveTabPane?: boolean;
    /**
     * Key định danh của tab
     */
    tabKey?: string;
    /**
     * Trạng thái được chọn của tab
     *
     * @default false
     */
    active?: boolean;
}

export interface Tab extends InternalTabProps {
    /**
     * Key định danh của tab
     */
    key: string;
    /**
     * Phần tử cần được hiển thị bên trong tab
     */
    node: React.ReactElement;
}

type RenderTabBarProps = {
    id?: string;
    /**
     * Key của tab đang được chọn
     */
    activeKey?: string;
    /**
     * Callback được gọi khi nhãn của tab được click
     */
    onTabClick?: (
        key: string,
        e: React.MouseEvent | React.KeyboardEvent
    ) => void;
    /**
     * Nội dung các phần tử bên trong TabBar. Khuyến khích truyền vào các `TabBarItem`
     */
    panes?: React.ReactNode;
};

export interface TabBarItemProps {
    id: string;
    /**
     * Các thiết lập cho nội dung của tab
     */
    tab: Tab;
    /**
     * Trạng thái được chọn của tab
     *
     * @default false
     */
    active: boolean;
    /**
     * Callback được gọi khi nhãn của tab được click
     */
    onClick?: (e: React.MouseEvent | React.KeyboardEvent) => void;
    /**
     * Hàm dùng để render nội dung của tab từ các thiết lập trong `tab`
     */
    renderWrapper?: (node: React.ReactElement) => React.ReactElement;
    removeAriaLabel?: string;
    /**
     * Icon thay thế cho nút xóa tab mặc định
     */
    removeIcon?: React.ReactNode;
    /**
     * Callback được gọi khi người dùng focus vào
     */
    onFocus: React.FocusEventHandler;
    /**
     * Inline style của tab
     */
    style?: React.CSSProperties;
}

export interface TabBarProps {
    id: string;
    /**
     * Key của tab hiện tại đang được chọn
     */
    activeKey: string;
    /**
     * Nội dung các phần tử bên trong thanh điều khiển tab. Khuyến khích truyền vào các `TabBarItem`
     */
    panes: React.ReactNode;
    /**
     * CSS class của thanh điều khiển tab
     */
    className?: string;
    /**
     * Inline style của thanh điều khiển tab
     */
    style?: React.CSSProperties;
    /**
     * Cho phép cuộn ngang khi số lượng tab quá nhiều và không hiển thị hết trên một dòng
     *
     * @default false
     */
    scrollable?: boolean;
    /**
     * Callback được gọi khi nhãn của tab được click
     */
    onTabClick: (
        activeKey: string,
        e: React.MouseEvent | React.KeyboardEvent
    ) => void;
    /**
     * Hàm dùng để render nội dung của tab từ các thiết lập trong `tab`
     */
    children?: (node: React.ReactElement) => React.ReactElement;
}

/**
 * Bao gồm các props của Input trừ `ref`, `size`, `type`
 * @category Data Display
 * @subcategory Tabs
 * @displayName Tabs
 *
 */
export interface TabsProps {
    /**
     * Các phần tử bên trong `Tabs`, khuyến khích sử dụng các `Tab` component
     */
    children?: React.ReactNode;
    /**
     * CSS class của `Tabs`
     */
    className?: string;
    /**
     * Inline style của `Tabs`
     */
    style?: CSSProperties;
    id?: string;
    /**
     * Mảng thiết lập các tab cần được hiển thị. Sử dụng thay cho `children`.
     */
    items?: Tab[];
    /**
     * Key của tab đang được chọn. Cần được sử dụng kết hợp với `onChange` để cập nhật lại giá trị này khi người dùng yêu cầu chuyển đổi tab
     */
    activeKey?: string;
    /**
     * Key của tab mặc định được chọn khi các tab được khởi tạo. Thay đổi giá trị này sau khi đã render sẽ không có tác dụng
     */
    defaultActiveKey?: string;
    /**
     * Callback được gọi khi người dùng yêu cầu chuyển đổi tab. Cần cập nhật lại giá trị của `activeKey` để thay đổi tab đang được chọn nếu được truyền vào
     */
    onChange?: (activeKey: string) => void;
    /**
     * Cho phép cuộn ngang khi số lượng tab quá nhiều và không hiển thị hết trên một dòng
     *
     * @default false
     */
    scrollable?: boolean;
    /**
     * Callback được gọi khi nhãn của tab được click
     * @param {string} activeKey key của tab đang active
     * @param {React.KeyboardEvent | React.MouseEvent} e các thông số khác của event click
     */
    onTabClick?: (
        activeKey: string,
        e: React.KeyboardEvent | React.MouseEvent
    ) => void;
    /**
     * Sử dụng để custom lại giao diện của thanh điều khiển tab, thay vì sử dụng component `TabBar` mặc định.
     *
     * Hàm nhận vào các thiết lập cần thiết để render thanh điều khiển tab cũng như event handler để xử lý khi người dùng yêu cầu chuyển đổi tab, và trả về một ReactElement để hiển thị đến người dùng.
     */
    renderTabBar?: (props: RenderTabBarProps) => React.ReactElement;
    /**
     * Hiển thị thanh điều khiển tab ở phía dưới, thay vì ở trên đầu như mặc định
     *
     * @default false
     */
    bottomBar?: boolean;
    /**
     * Tự động dọn dẹp các tab không được chọn
     *
     * @default false
     */
    destroyInactiveTabPane?: boolean;
}

export interface TabListProps {
    /**
     * Key của tab đang được chọn
     */
    activeKey?: string;
    id?: string;
    /**
     * Tự động dọn dẹp các tab không được chọn
     *
     * @default false
     */
    destroyInactiveTabPane?: boolean;
}

export interface CompoundedComponent
    extends ForwardRefExoticComponent<
        TabsProps & RefAttributes<HTMLDivElement>
    > {
    Tab: ForwardRefExoticComponent<TabProps & RefAttributes<HTMLDivElement>>;
}

declare const Tabs: CompoundedComponent;

export default Tabs;


