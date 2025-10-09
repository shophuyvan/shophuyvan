// eslint-disable-next-line import/no-extraneous-dependencies
import { NavigateFunction, NavigateOptions } from "react-router";

export declare type Pathname = string;
export declare type Search = string;
export declare type Hash = string;
export declare type State = unknown;
export declare type Key = string;

export interface Path {
    pathname: Pathname;
    search: Search;
    hash: Hash;
}
export type NavigationDirection = "forward" | "backward";
export declare type To = string | Partial<Path>;
export interface ZMPNavigationOptions extends NavigateOptions {
    animate?: boolean;
    direction?: NavigationDirection;
}
export interface ZMPNavigationFunction extends NavigateFunction {
    (to: To, options?: ZMPNavigationOptions): void;
    (delta: number): void;
}

declare function useNavigate(): ZMPNavigationFunction;

export default useNavigate;
