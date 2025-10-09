import { Theme } from "src/react/components/app/props-type";

export interface ThemeSwitcherContextType {
    themeMode: Theme | undefined;
    setThemeMode: ({ mode }: { mode: Theme }) => void;
}

declare function useTheme(): [
    Theme | undefined,
    ({ mode }: { mode: Theme }) => void
];
export default useTheme;
