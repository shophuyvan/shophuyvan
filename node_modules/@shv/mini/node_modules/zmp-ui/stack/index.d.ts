
	/**
 * @category Layout
 * @subcategory Stack
 * @displayName Stack
 *
 */
export interface StackProps {
    id?: string;
    className?: string;
    style?: React.CSSProperties;
    /**
     * A CSS `margin` value
     *
     * @defaultvalue var(--s1)
     */
    space?: string;
    /**
     *  Whether the spaces apply recursively (i.e. regardless of nesting level)
     *
     * @defaultvalue false
     */
    recursive?: boolean;
    /**
     *  The element after which to _split_ the stack with an auto margin
     *
     * @defaultvalue null
     */
    splitAfter?: number;
    ref?: React.MutableRefObject<HTMLDivElement>;
    /** ReactNode */
    children?: React.ReactNode;
}

export interface StackRef {
    layout: HTMLDivElement | null;
}

	declare const Stack: React.FunctionComponent<StackProps>;

	export default Stack;
  