
	import { CSSProperties, RefObject } from "react";

export interface ImageType {
    /**
     * Đường dẫn của ảnh.
     */
    src: string;
    /**
     * Mô tả của ảnh. Sẽ được hiển thị khi không thể load ảnh.
     */
    alt?: string;
}

export interface ImageProps extends ImageType {
    /**
     * CSS class cho image.
     */
    className?: string;
    /**
     * Inline style cho image.
     */
    style?: CSSProperties;
    id?: string;
    ref?: RefObject<HTMLDivElement>;
}
export interface ImageViewerProps {
    /**
     * Mảng chứa thông tin của các ảnh cần hiển thị. Mỗi thiết lập bao gồm đường dẫn và mô tả của ảnh. Chi tiết xem {@link ImageType}.
     */
    images: ImageType[];

    /**
     * Index của ảnh đang được hiển thị.
     */
    activeIndex?: number;

    /**
     * Trạng thái hiển thị của image viewer. Cần được sử dụng cùng với `onClose` để đóng image viewer.
     *
     * @default false
     */
    visible?: boolean;

    /**
     * Callback được gọi khi image viewer được đóng. Cần phải update lại state của `visible` nếu được truyền vào.
     */
    onClose?: () => void;

    /**
     * Inline style cho mask của image viewer.
     */
    maskStyle?: CSSProperties;

    /**
     * CSS class cho mask của image viewer.
     */
    maskClassName?: string;

    /**
     * CSS class cho image viewer.
     */
    className?: string;

    /**
     * Inline style cho image viewer.
     */
    style?: CSSProperties;

    id?: string;

    ref?: RefObject<HTMLDivElement>;
}

type CallBackFunc<T> = (val: T) => void;

export type ImageViewerContextType = {
    currentIndex: number;
    isZoomed?: boolean;
    setIsZoomed?: (isZoomed: boolean | CallBackFunc<boolean>) => void;
    showHeader?: boolean;
    setShowHeader?: (show: boolean | CallBackFunc<boolean>) => void;
};

	declare const ImageViewer: React.FunctionComponent<ImageViewerProps>;

	export default ImageViewer;
  