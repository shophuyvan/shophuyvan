
	export type PortalRef = Record<string, unknown>;

export interface PortalProps {
    /**
     * Callback được gọi khi component có thay đổi.
     */
    didUpdate?: (prevProps: PortalProps) => void;
    /**
     * Callback được gọi để lấy ra container của component.
     */
    getContainer: () => HTMLElement;
    /**
     * Phần tử cần được hiển thị bên trong portal.
     */
    children?: React.ReactNode;
}

	declare const Portal: React.FunctionComponent<PortalProps>;

	export default Portal;
  