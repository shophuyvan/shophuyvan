import TextComponent from "./Text";
import TitleComponent from "./TitleText";
import HeaderText from "./HeaderText";

/**
 * @category Data Display
 * @subcategory Text
 * @component
 *
 * @example
import React from "react";
import { Page, Text } from "zmp-ui";

const data = {
    Header: ["normal", "small"],
    Title: ["xLarge", "large", "normal", "small"],
    Body: [
        "xLarge",
        "large",
        "normal",
        "small",
        "xSmall",
        "xxSmall",
        "xxxSmall",
        "xxxxSmall",
    ],
};

function HomePage(props){
    return (
        <Page>
            {Object.keys(data).map(key => {
                return (
                    <div key={key} className="section-container">
                        <Text.Header>{key} Text</Text.Header>
                        {data[key].map(size => {
                            if (key === "Header") {
                                return (
                                    <Text.Header
                                        size={size}
                                        key={`${key}-${size}`}
                                    >
                                        Bầu trời trong xanh thăm thẳm, không một
                                        gợn mây
                                    </Text.Header>
                                );
                            }
                            if (key === "Title") {
                                return (
                                    <Text.Title
                                        size={size}
                                        key={`${key}-${size}`}
                                    >
                                        Bầu trời trong xanh thăm thẳm, không một
                                        gợn mây
                                    </Text.Title>
                                );
                            }
                            return (
                                <div key={`${key}-${size}`}>
                                    <Text size={size}>
                                        Bầu trời trong xanh thăm thẳm, không một
                                        gợn mây
                                    </Text>
                                    <Text bold size={size}>
                                        Bầu trời trong xanh thăm thẳm, không một
                                        gợn mây
                                    </Text>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </Page>
    );
}
 */
var Text = TextComponent;
Text.Title = TitleComponent;
Text.Header = HeaderText;
export default Text;