import { Component, type ErrorInfo, type ReactNode } from 'react';
type Props = {
    children: ReactNode;
};
type State = {
    hasError: boolean;
};
export declare class ErrorBoundary extends Component<Props, State> {
    state: State;
    static getDerivedStateFromError(): State;
    componentDidCatch(error: Error, errorInfo: ErrorInfo): void;
    handleReload: () => void;
    render(): string | number | boolean | import("react/jsx-runtime").JSX.Element | Iterable<ReactNode> | null | undefined;
}
export {};
//# sourceMappingURL=ErrorBoundary.d.ts.map