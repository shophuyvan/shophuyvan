
	/* eslint-disable sonarjs/no-duplicate-string */
export enum JustifyContentEnum {
    "flex-start" = "flex-start",
    "flex-end" = "flex-end",
    "center" = "center",
    "space-between" = "space-between",
    "space-around" = "space-around",
    "space-evenly" = "space-evenly",
    "initial" = "initial",
}

export enum AlignItemsEnum {
    "flex-start" = "flex-start",
    "flex-end" = "flex-end",
    "stretch" = "stretch",
    "baseline" = "baseline",
    "center" = "center",
    "initial" = "initial",
}

/**
 * @category Layout
 * @subcategory Cluster
 * @displayName Cluster
 *
 */

export interface ClusterProps {
    id?: string;
    className?: string;
    style?: React.CSSProperties;
    /**
     * The justify-content value (for horizontal alignment)
     *
     * @defaultvalue flex-start
     */
    justify?: keyof typeof JustifyContentEnum;
    /**
     * The align-items value (for vertical alignment)
     *
     * @defaultvalue flex-start
     */
    align?: keyof typeof AlignItemsEnum;
    /**
     * The space (margin) between each of the clustered elements
     *
     * @defaultvalue var(--s1)
     */
    space?: string;
    ref?: React.MutableRefObject<HTMLDivElement>;
    /** ReactNode */
    children?: React.ReactNode;
}

export interface ClusterRef {
    layout: HTMLDivElement | null;
}

	declare const Cluster: React.FunctionComponent<ClusterProps>;

	export default Cluster;
  