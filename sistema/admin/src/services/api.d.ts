export interface AdminProduct {
    id: string;
    ean: string;
    name: string;
    alternativeDescription?: string | null;
    price: number;
    promotionalPrice?: number | null;
    stock?: number | null;
    unit?: string;
    badges?: string | null;
    active: boolean;
}
export interface AdminProductsResponse {
    data: AdminProduct[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}
export interface ProductPayload {
    ean: string;
    name: string;
    alternativeDescription?: string;
    price: number;
    promotionalPrice?: number | null;
    stock?: number;
    unit?: string;
    badges?: string;
}
export interface SolidcomSyncHistoryItem {
    id: string;
    at: string;
    products: number;
    synced: number;
    errors: number;
}
export interface SolidcomStatusResponse {
    integration: 'solidcom';
    productsCount: number;
    lastSync: SolidcomSyncHistoryItem | null;
    history: SolidcomSyncHistoryItem[];
}
export interface SalesAnalyticsPoint {
    date: string;
    total: number;
    orders: number;
}
export interface SalesAnalyticsResponse {
    period: string;
    data: SalesAnalyticsPoint[];
}
export interface StatusAnalyticsResponse {
    total: number;
    data: Array<{
        status: string;
        count: number;
    }>;
}
export interface RevenueAnalyticsResponse {
    today: number;
    week: number;
    month: number;
    delta: {
        todayVsYesterday: number;
        weekVsPreviousWeek: number;
        monthVsPreviousMonth: number;
    };
}
export interface TopProductAnalyticsItem {
    productId: string;
    name: string;
    ean: string;
    quantity: number;
    revenue: number;
    orders: number;
}
export declare const api: import("axios").AxiosInstance;
export declare function getApiErrorMessage(error: unknown, fallback?: string): string;
export declare const authAPI: {
    login: (email: string, password: string) => Promise<import("axios").AxiosResponse<any, any, {}>>;
};
export declare const productsAPI: {
    getAll: () => Promise<import("axios").AxiosResponse<any, any, {}>>;
    getAdmin: (params: {
        page?: number;
        limit?: number;
        search?: string;
    }) => Promise<import("axios").AxiosResponse<AdminProductsResponse, any, {}>>;
    createAdmin: (data: ProductPayload) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    create: (data: ProductPayload) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    update: (id: string, data: Partial<ProductPayload>) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    delete: (id: string) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    sync: () => Promise<import("axios").AxiosResponse<any, any, {}>>;
    getTopAnalytics: (limit?: number) => Promise<import("axios").AxiosResponse<TopProductAnalyticsItem[], any, {}>>;
};
export declare const ordersAPI: {
    getAll: () => Promise<import("axios").AxiosResponse<any, any, {}>>;
    updateStatus: (id: string, status: string) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    update: (id: string, data: { paymentStatus?: string; paymentMethod?: string }) => Promise<import("axios").AxiosResponse<any, any, {}>>;
    getSalesAnalytics: (period?: string) => Promise<import("axios").AxiosResponse<SalesAnalyticsResponse, any, {}>>;
    getStatusAnalytics: () => Promise<import("axios").AxiosResponse<StatusAnalyticsResponse, any, {}>>;
    getRevenueAnalytics: () => Promise<import("axios").AxiosResponse<RevenueAnalyticsResponse, any, {}>>;
};
export declare const customersAPI: {
    getAll: () => Promise<import("axios").AxiosResponse<any, any, {}>>;
};
export declare const integrationsAPI: {
    getSolidcomStatus: () => Promise<import("axios").AxiosResponse<SolidcomStatusResponse, any, {}>>;
};
//# sourceMappingURL=api.d.ts.map