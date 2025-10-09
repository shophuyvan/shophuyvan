
	import React from "react";

/**
 * @category Data Display
 * @subcategory Progress
 * @displayName Progress
 *
 */
export interface ProgressProps {
    /**
     * Giá trị tối đa của thanh tiến trình, cũng là mốc hoàn tất.
     * @default 100
     */
    maxCompleted?: number;
    /**
     * Giá trị hiện tại của thanh tiến trình.
     * @default 0
     */
    completed: number;
    /**
     * Hàm được dùng để tuỳ chỉnh nội dung được hiển thị trên nhãn. Cần được sử dùng cùng với `showLabel`.
     * @function formatLabel
     */
    formatLabel?: (current: number, maxCompleted: number) => React.ReactNode;
    /**
     * Nhãn của tiến trình, được hiển thị bên phải thanh tiến trình.
     *
     * @default false
     */
    showLabel?: boolean;
    /**
     * Độ dày của thanh tiến trình, tính theo đơn vị px.
     *
     * @default 4
     */
    strokeWidth?: number;
    /**
     * Màu của phần đã hoàn tất trên thanh tiến trình.
     */
    strokeColor?: string;
    /**
     * Màu của phần chưa hoàn tất trên thanh tiến trình.
     */
    trailColor?: string;
    /**
     * CSS class của thanh tiến trình.
     */
    className?: string;
    id?: string;
}

	declare const Progress: React.FunctionComponent<ProgressProps>;

	export default Progress;
  