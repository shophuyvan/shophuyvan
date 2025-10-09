
	/** Two char of 't' 'b' 'c' 'l' 'r'. Example: 'lt' */
export type AlignPoint = string;

export interface AlignType {
    /**
     * move point of source node to align with point of target node.
     * Such as ['tr','cc'], align top right point of source node with center point of target node.
     * Point can be 't'(top), 'b'(bottom), 'c'(center), 'l'(left), 'r'(right) */
    points?: AlignPoint[];
    /**
     * offset source node by offset[0] in x and offset[1] in y.
     * If offset contains percentage string value, it is relative to sourceNode region.
     */
    offset?: number[];
    /**
     * offset target node by offset[0] in x and offset[1] in y.
     * If targetOffset contains percentage string value, it is relative to targetNode region.
     */
    targetOffset?: number[];
    /**
     * If adjustX fieldpopupType is true, will adjust source node in x direction if source node is invisible.
     * If adjustY field is true, will adjust source node in y direction if source node is invisible.
     */
    overflow?: {
        adjustX?: boolean | number;
        adjustY?: boolean | number;
    };
    /**
     * Whether use css right instead of left to position
     */
    useCssRight?: boolean;
    /**
     * Whether use css bottom instead of top to position
     */
    useCssBottom?: boolean;
    /**
     * Whether use css transform instead of left/top/right/bottom to position if browser supports.
     * Defaults to false.
     */
    useCssTransform?: boolean;
    ignoreShake?: boolean;
}

export type ActionType = string;

export type StretchType = string;

export type AnimationType = string;

export type TransitionNameType = string;

export type BuildInPlacements = Record<string, AlignType>;

export interface Point {
    pageX: number;
    pageY: number;
}

export interface CommonEventHandler {
    remove: () => void;
}

export interface TriggerProps {
    popupType?: "sheet";
    children: React.ReactElement;
    action?: ActionType | ActionType[];
    showAction?: ActionType[];
    hideAction?: ActionType[];
    getPopupClassNameFromAlign?: (align: AlignType) => string;
    onPopupVisibleChange?: (visible: boolean) => void;
    onPopupClick?: React.MouseEventHandler<HTMLDivElement>;
    afterPopupVisibleChange?: (visible: boolean) => void;
    popup: React.ReactNode | (() => React.ReactNode);
    popupStyle?: React.CSSProperties;
    prefixCls?: string;
    popupClassName?: string;
    className?: string;
    popupPlacement?: string;
    builtinPlacements?: BuildInPlacements;
    zIndex?: number;
    focusDelay?: number;
    blurDelay?: number;
    getPopupContainer?: (node: HTMLElement) => HTMLElement;
    getDocument?: (element?: HTMLElement | null) => HTMLDocument;
    forceRender?: boolean;
    destroyPopupOnHide?: boolean;
    mask?: boolean;
    maskClosable?: boolean;
    onPopupAlign?: (element: HTMLElement, align: AlignType) => void;
    popupAlign?: AlignType;
    popupVisible?: boolean;
    defaultPopupVisible?: boolean;
    autoDestroy?: boolean;
    stretch?: string;
    alignPoint?: boolean; // Maybe we can support user pass position in the future

    /**
     * @private Get trigger DOM node.
     * Used for some component is function component which can not access by `findDOMNode`
     */
    getTriggerDOMNode?: (node: React.ReactInstance) => HTMLElement;
}

	declare const Trigger: React.FunctionComponent<TriggerProps>;

	export default Trigger;
  