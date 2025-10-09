
	/**
 * @category Layout
 * @subcategory ZBox
 * @displayName ZBox
 *
 */
export interface ZBoxProps {
    id?: string;
    className?: string;
    style?: React.CSSProperties;
    /**
     * The amount by with the Box is padded on all sides
     *
     * @defaultvalue var(--s1)
     */
    padding?: string;
    /**
     *  The width of the (solid) border. If empty or 0, the transparent outline is instated for high contrast mode.
     *
     * @defaultvalue var(--border-thin)
     */
    borderWidth?: string;
    /**
     * Whether to apply an inverted theme. Only recommended for greyscale designs.
     *
     * @defaultvalue false
     */
    invert?: boolean;
    ref?: React.MutableRefObject<HTMLDivElement>;
    /** ReactNode */
    children?: React.ReactNode;
}

export interface ZBoxRef {
    layout: HTMLDivElement | null;
}

	declare const Zbox: React.FunctionComponent<ZboxProps>;

	export default Zbox;
  