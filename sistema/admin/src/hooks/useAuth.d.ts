type AdminData = {
    id: string;
    email: string;
    name: string;
    role?: string;
};
export declare function useAuth(): {
    isAuth: boolean;
    login: (email: string, password: string) => Promise<any>;
    logout: () => void;
    getAdminData: () => AdminData | null;
};
export {};
//# sourceMappingURL=useAuth.d.ts.map