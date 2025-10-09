
	/**
 * @category Layout
 * @subcategory Grid
 * @displayName Grid
 *
 */

export interface GridProps {
    id?: string;
    className?: string;
    style?: React.CSSProperties;
    /**
     * Specifying the columns in a grid
     *
     * @defaultvalue 1
     */
    columnCount?: number;
    /**
     * A CSS length value representing x in minmax(min(x, 100%), 1fr)
     *
     * @defaultvalue 250px
     */
    min?: string;
    /**
     * The space between grid row
     *
     * @defaultvalue var(--s1)
     */
    rowSpace?: string;
    /**
     * The space between grid column
     *
     * @defaultvalue var(--s1)
     */
    columnSpace?: string;
    ref?: React.MutableRefObject<HTMLDivElement>;
    /** ReactNode */
    children?: React.ReactNode;
}

export interface GridRef {
    layout: HTMLDivElement | null;
}

	declare const Grid: React.FunctionComponent<GridProps>;

	export default Grid;
  