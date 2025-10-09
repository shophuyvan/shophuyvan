
	import { ComponentPropsWithoutRef } from "react";

/**
 * Bao gồm các props của Input trừ `ref`, `size`, `type`
 * @category Data Entry
 * @subcategory Switch
 * @displayName Switch
 *
 */
export interface SwitchProps
    extends Omit<ComponentPropsWithoutRef<"input">, "size" | "type"> {
    /**
     * Nhãn của switch, được hiển thị bên cạnh switch.
     */
    label?: string;
    /**
     * Độ lớn của switch.
     *
     * @default 'medium'
     */
    size?: "medium" | "small";
    /**
     * CSS class của phần tử chứa switch và label nếu có.
     */
    wrapperClassName?: string;
}

export type SwitchSize = SwitchProps["size"];

	declare const Switch: React.FunctionComponent<SwitchProps>;

	export default Switch;
  