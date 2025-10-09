import BottomNavigationCompoment from "./BottomNavigation";
import BottomNavigationItem from "./BottomNavigationItem";
/**
 * @category General
 * @subcategory BottomNavigation
 * @component
 * @prop {string} [activeKey] - key của tabItem đang active (controlled)
 * @prop {string} [defaultActiveKey] - set tab mặc định khi init component (uncontrolled)
 * @prop {boolean} [fixed] - position fixed
 * @prop {Function} [onChange] - Callback function khi active key thay đổi
 * @example
import React, { useState } from "react";
import { BottomNavigation, Icon, Page} from "zmp-ui";

const BottomNavigationPage = props => {
    const [activeTab, setActiveTab] = useState("chat");
    const { title } = props;
    return (
        <Page className="page" >
            <BottomNavigation
                activeKey={activeTab}
                onChange={a => setActiveTab(a)}
            >
                <BottomNavigation.Item
                    key="chat"
                    label="Tin Nhắn"
                    icon={<Icon icon="zi-chat" />}
                    activeIcon={<Icon icon="zi-chat-solid" />}
                />
                <BottomNavigation.Item
                    label="Danh bạ"
                    key="contact"
                    icon={<Icon icon="zi-call" />}
                    activeIcon={<Icon icon="zi-call-solid" />}
                />
                <BottomNavigation.Item
                    label="Khám phá"
                    key="discovery"
                    icon={<Icon icon="zi-more-grid" />}
                    activeIcon={<Icon icon="zi-more-grid-solid" />}
                />
                <BottomNavigation.Item
                    key="timeline"
                    label="Nhật ký"
                    icon={<Icon icon="zi-clock-1" />}
                    activeIcon={<Icon icon="zi-clock-1-solid" />}
                />
                <BottomNavigation.Item
                    key="me"
                    label="Cá nhân"
                    icon={<Icon icon="zi-user" />}
                    activeIcon={<Icon icon="zi-user-solid" />}
                />
            </BottomNavigation>
        </Page>
    );
};

export default BottomNavigationPage;

 */
var BottomNavigation = BottomNavigationCompoment;

/**
 * @category General
 * @subcategory BottomNavigation
 * @component
 * @typedef {object} BottomNavigation.Item
 * @prop {ReactNode} [label] - Label hiển thị.
 * @prop {ReactNode} [icon] - Thêm Icon.
 * @prop {ReactNode} [activeIcon] - Thêm icon thay thế khi active
 * @prop {string} [itemKey] - Unique key cho từng tab item
 * @prop {Function} [onClick] - Callback function khi click/press vào item
 */
BottomNavigation.Item = BottomNavigationItem;
export default BottomNavigation;