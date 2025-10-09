import {
    CSSProperties,
    ForwardRefExoticComponent,
    RefAttributes,
    RefObject,
} from "react";

export interface SwiperRefObject {
    /**
     * Index của slide hiện tại.
     */
    activeIndex: number;
    /**
     * Chuyển đến một slide cụ thể.
     */
    goTo: (slideIndex: number) => void;
    /**
     * Chuyển đến slide tiếp theo.
     */
    next: () => void;
    /**
     * Quay lại slide phía trước.
     */
    prev: () => void;
}

export interface SwiperProps {
    /**
     * Thiết lập cơ chế tự động chuyển slide.
     *
     * @default false
     */
    autoplay?: boolean;
    /**
     * Callback được sau khi slider đã chuyển đến slide mới.
     */
    afterChange?: (currentIndex: number) => void;
    /**
     * Index của slide bắt đầu khi slider được render.
     */
    defaultActive?: number;
    /**
     * Hiển thị các chấm chuyển slide ở phía dưới slider.
     *
     * @default true
     */
    dots?: boolean;
    /**
     * Chứa các `<Swiper.Slide />` component.
     */
    children?: React.ReactNode;
    /**
     * Tham chiếu đến instance của Swiper.
     */
    ref?: RefObject<SwiperRefObject>;
    /**
     * Inline style cho swiper.
     */
    style?: CSSProperties;
    /**
     * CSS class của swiper.
     */
    className?: string;
    /**
     * Thiết lập cơ chế lặp lại các slide. Sau khi chuyển đến slide cuối cùng, slider sẽ quay lại slide đầu tiên.
     *
     * @default false
     */
    loop?: boolean;
    /**
     * Thời gian tự động chuyển giữa các slide (đơn vị: "ms"). Cần được sử dụng kết hợp với `autoplay`.
     */
    duration?: number;
    id?: string;
    /**
     * Tắt cơ chế chuyển slide khi vuốt trên thiết bị di động.
     *
     * @default false
     */
    disableSwipe?: boolean;
}

export interface SwiperSlideProps {
    /**
     * Nội dung cần được hiển thị trong slide.
     */
    children?: React.ReactNode;
    /**
     * Inline style của slide.
     */
    style?: CSSProperties;
    /**
     * CSS class của slide.
     */
    className?: string;
    id?: string;
}

export interface SlideProps extends SwiperProps {
    /**
     * Index của slide.
     */
    index: number;
}

export interface SwiperSlide extends SwiperSlideProps {
    /**
     * Key định danh cho slide bên trong `Swiper`.
     */
    key: string;
    /**
     * Phần tử hiển thị trong slide.
     */
    node: React.ReactElement;
}

export interface SwiperContextType {
    /**
     * Index của slide hiện tại.
     */
    activeIndex: number;
    /**
     * Mảng thiết lập các slide trong `Swiper`.
     */
    slides: SwiperSlide[];
}

export interface CompoundedComponent
    extends ForwardRefExoticComponent<
        SwiperProps & RefAttributes<SwiperRefObject>
    > {
    Slide: ForwardRefExoticComponent<
        SwiperSlideProps & RefAttributes<HTMLDivElement>
    >;
}

declare const Swiper: CompoundedComponent;

export default Swiper;


