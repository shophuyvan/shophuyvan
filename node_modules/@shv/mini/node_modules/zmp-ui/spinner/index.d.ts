
	/**
 * @category Data Display
 * @subcategory Spinner
 * @displayName Spinner
 *
 */
export interface SpinnerProps {
    /**
     * Trạng thái hiển thị của spinner.
     *
     * @default true
     */
    visible?: boolean;
    /**
     * Phần tử được sử dụng làm logo, được hiển thị ở giữa spinner.
     */
    logo?: React.ReactNode;
}

	declare const Spinner: React.FunctionComponent<SpinnerProps>;

	export default Spinner;
  