
	/**
 * @category Layout
 * @subcategory Center
 * @displayName Center
 *
 */

export interface CenterProps {
    id?: string;
    className?: string;
    style?: React.CSSProperties;
    /**
     * The maximum width of the centered element
     *
     * @defaultvalue var(--measure)
     */
    max?: string;
    /**
     * Center align the text too
     *
     * @defaultvalue false
     */
    andText?: boolean;
    /**
     * The minimum space on either side of the content
     *
     * @defaultvalue null
     */
    gutters?: string;
    /**
     * Center child elements based on their content width
     *
     * @defaultvalue false
     */
    intrinsic?: boolean;
    ref?: React.MutableRefObject<HTMLDivElement>;
    /** ReactNode */
    children?: React.ReactNode;
}

export interface CenterRef {
    layout: HTMLDivElement | null;
}

	declare const Center: React.FunctionComponent<CenterProps>;

	export default Center;
  