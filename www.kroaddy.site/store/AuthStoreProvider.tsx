/**
 * Auth Store Provider
 * 
 * Zustand Store를 Context API로 제공하는 Provider
 */

"use client";

import { useRef, type ReactNode } from "react";
import { AuthStoreContext, createAuthStore, type AuthStoreProviderProps } from "./authStore";

export function AuthStoreProvider({ children }: AuthStoreProviderProps) {
    const storeRef = useRef<ReturnType<typeof createAuthStore> | undefined>(undefined);

    if (!storeRef.current) {
        storeRef.current = createAuthStore();
    }

    return (
        <AuthStoreContext.Provider value={storeRef.current}>
            {children}
        </AuthStoreContext.Provider>
    );
}

export type { AuthStoreProviderProps } from "./authStore";
