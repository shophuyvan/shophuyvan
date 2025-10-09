import TabsComponent from "./Tabs";
import Tab from "./Tab";
/**
 * @category Data Display
 * @subcategory Tabs
 * @component
 *
 * @example
import React from "react";
import { Page, Tabs, List } from "zmp-ui";

const alphabet = "abcdefghijklmnopqrstuvwxyz";
const users = Array.from(Array(10).keys()).map(i => ({
    name: `Người dùng ${i}`,
    avatar: alphabet[Math.floor(Math.random() * alphabet.length)].toUpperCase(),
    online: Math.floor(Math.random() * 10) % 2 === 0,
    key: i,
}));

function HomePage(props){
    return (
        <Page>
            <Tabs id="contact-list">
                <Tabs.Tab key="tab1" label="Tab 1">
                    <List>
                        {users.map(user => (
                            <List.Item
                                key={user.key}
                                prefix={
                                    <Avatar online={user.online}>
                                        {user.avatar}
                                    </Avatar>
                                }
                                title={user.name}
                                subTitle="subtitle"
                                suffix={<Icon icon="zi-call" />}
                            />
                        ))}
                    </List>
                </Tabs.Tab>
                <Tabs.Tab key="tab2" label="Tab 2">
                    Tab 2 content
                </Tabs.Tab>
                <Tabs.Tab key="tab3" label="Tab 3">
                    Tab 3 content
                </Tabs.Tab>
            </Tabs>
        </Page>
    );
}
 */
var Tabs = TabsComponent;

/**
 * @category Data Display
 * @subcategory Tabs
 * @component
 * @typedef {object} Tabs.Tab
 * @prop {ReactNode} [label] - Label hiển thị của tab.
 * @prop {boolean} [destroyInactiveTabPane] - Destroy khi tab có trạng thái inactive
 * @prop {string} [tabKey] - Key của tab
 * @prop {boolean} [active] - Trạng thái active của tab
 *
 */
Tabs.Tab = Tab;
export default Tabs;