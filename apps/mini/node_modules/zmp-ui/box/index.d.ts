
	/**
 * @category Layout
 * @subcategory Box
 * @displayName Box
 *
 */
export interface BoxProps extends React.HTMLProps<HTMLDivElement> {
    id?: string;
    className?: string;
    style?: React.CSSProperties;
    /**
     * Các element sẽ có `margin: 0` và `padding: 0`
     *
     * @default false
     */
    noSpace?: boolean;
    /**
     * Nhận giá trị `true` nếu muốn các element inline block
     *
     * @default false
     */
    inline?: boolean;
    /** Giá trị margin của box, nhận giá trị là level từ 0 đến 10, với giá trị margin tương ứng là level x 4px */
    m?: number;
    /** Giá trị padding của box, nhận giá trị là level từ 0 đến 10, với giá trị padding tương ứng là level x 4px */
    p?: number;
    /** Giá trị margin top */
    mt?: number;
    /** Giá trị margin left */
    ml?: number;
    /** Giá trị margin bottom */
    mb?: number;
    /** Giá trị margin right */
    mr?: number;
    /** Giá trị padding top */
    pt?: number;
    /** Giá trị padding left */
    pl?: number;
    /** Giá trị padding bottom */
    pb?: number;
    /** Giá trị padding right */
    pr?: number;
    /** Giá trị margin left và margin right */
    mx?: number;
    /** Giá trị margin top và margin bottom */
    my?: number;
    /** Giá trị padding left và padding right */
    px?: number;
    /** Giá trị padding top và padding bottom */
    py?: number;
    /** Chiều rộng của box */
    width?: number;
    /** Chiều dài của box */
    height?: number;
    /**
     * Giá trị vertical-align
     *
     * @type VerticalAlignEnum
     */
    verticalAlign?:
        | "baseline"
        | "sub"
        | "super"
        | "top"
        | "text-top"
        | "middle"
        | "bottom"
        | "text-bottom"
        | "initial"
        | "inherit";
    /**
     * Giá trị text-align
     *
     * @type string
     */
    textAlign?: "left" | "right" | "center" | "justify" | "initial" | "inherit";
    /**
     * Chuyển box sang flex layout
     *
     * @default false
     */
    flex?: boolean;
    /**
     * Giá trị flex-direction
     */
    flexDirection?: "row" | "row-reverse" | "column" | "column-reverse";
    /**
     * Giá trị flex-wrap
     *
     * @default false
     */
    flexWrap?: boolean;
    /**
     * Giá trị justify-content
     *
     * @type string
     */
    justifyContent?:
        | "flex-start"
        | "flex-end"
        | "center"
        | "space-between"
        | "space-around"
        | "space-evenly"
        | "initial";
    /**
     * Giá trị align-items
     *
     * @type string
     */
    alignItems?:
        | "flex-start"
        | "flex-end"
        | "stretch"
        | "baseline"
        | "center"
        | "initial";
    /**
     * Giá trị align-content
     *
     * @type string
     */
    alignContent?:
        | "stretch"
        | "center"
        | "flex-start"
        | "flex-end"
        | "space-between"
        | "space-around"
        | "space-evenly"
        | "initial";
    ref?: React.MutableRefObject<HTMLDivElement>;
    /** ReactNode */
    children?: React.ReactNode;
}

	declare const Box: React.FunctionComponent<BoxProps>;

	export default Box;
  