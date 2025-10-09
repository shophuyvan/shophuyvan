import React from "react";

/**
 * @category Data Display
 * @subcategory Text
 * @displayName Text
 */
export interface BodyTextProps
    extends Omit<React.HTMLProps<HTMLSpanElement>, "size"> {
    /**
     * Độ lớn của text
     */
    size?:
        | "xLarge"
        | "large"
        | "normal"
        | "small"
        | "xSmall"
        | "xxSmall"
        | "xxxSmall"
        | "xxxxSmall";
    /**
     * Inline style của text
     */
    style?: React.CSSProperties;
    /**
     * CSS class của text
     */
    className?: string;
    /**
     * Nội dung văn bản cần hiển thị bên trong text
     */
    children?: React.ReactNode;
    /**
     * In đậm text
     *
     * @default false
     */
    bold?: boolean;
}

/**
 * @category Data Display
 * @subcategory Text
 * @displayName Text.Title
 */
export interface TitleTextProps
    extends Omit<React.HTMLProps<HTMLSpanElement>, "size"> {
    /**
     * Độ lớn của tiêu đề
     */
    size?: "xLarge" | "large" | "normal" | "small";
    /**
     * Inline style của tiêu đề
     */
    style?: React.CSSProperties;
    /**
     * CSS class của tiêu đề
     */
    className?: string;
    /**
     * Nội dung văn bản cần hiển thị bên trong tiêu đề
     */
    children?: React.ReactNode;
}

/**
 * @category Data Display
 * @subcategory Text
 * @displayName Text.Header
 */
export interface HeaderTextProps
    extends Omit<React.HTMLProps<HTMLSpanElement>, "size"> {
    /**
     * Độ lớn của chỉ mục
     */
    size?: "normal" | "small";
    /**
     * Inline style của chỉ mục
     */
    style?: React.CSSProperties;
    /**
     * CSS class của chỉ mục
     */
    className?: string;
    /**
     * Nội dung văn bản cần hiển thị bên trong chỉ mục
     */
    children?: React.ReactNode;
}

export interface CompoundedComponent
    extends React.FunctionComponent<BodyTextProps> {
    Title: React.FunctionComponent<TitleTextProps>;
    Header: React.FunctionComponent<HeaderTextProps>;
}

declare const Text: CompoundedComponent;

export default Text;


