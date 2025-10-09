import InternalAvatar from "./avatar";
import Group from "./group";
export { Group };
/**
 * @category Data Display
 * @subcategory Avatar
 * @component
 *
 * @example
import React from "react";
import { Page, Avatar } from "zmp-ui";

function HomePage(props){
    return (
        <Page>
            <Avatar size={98} online story="default">
                D
            </Avatar>
        </Page>
    );
}
 * @example
import React from "react";
import { Page, Avatar } from "zmp-ui";

function HomePage(props){
    return (
       <Page>
            <Avatar.Group maxCounter={1}>
                <Avatar story="default" online>A</Avatar>
                <Avatar story="seen" online>B</Avatar>
                <Avatar story="seen" online>c</Avatar>
                <Avatar story="seen" online>D</Avatar>
            </Avatar.Group>
       </Page>
    );
}
 *
 */
var Avatar = InternalAvatar;
Avatar.Group = Group;
export default Avatar;