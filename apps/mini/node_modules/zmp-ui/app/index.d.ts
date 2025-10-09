
	import React from "react";

/**
 * @category Container
 * @subcategory App
 * @displayName App
 *
 */
export interface AppProps {
    /**
     * Thiết lập giao diện sáng / tối cho các component trong ứng dụng
     *
     * @default 'light'
     */
    theme?: "dark" | "light";
    children?: React.ReactNode;
    id?: string;
}

export type Theme = AppProps["theme"];

	declare const App: React.FunctionComponent<AppProps>;

	export default App;
  