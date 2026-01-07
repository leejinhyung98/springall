/**
 * Auth Store - Ducks Pattern
 * 
 * 인증 상태를 관리하는 Zustand Store
 * 쿠키 기반 인증을 사용하므로 토큰은 저장하지 않음
 */

import { create, useStore } from "zustand";
import { createContext, useContext } from "react";

// ============================================================================
// Types
// ============================================================================

export interface AuthState {
  isAuthenticated: boolean;
}

export interface AuthActions {
  setIsAuthenticated: (isAuthenticated: boolean) => void;
  logout: () => void;
}

export type AuthStore = AuthState & AuthActions;

// ============================================================================
// Store Creator
// ============================================================================

function createAuthStore() {
  return create<AuthStore>((set) => ({
    // State
    isAuthenticated: false,

    // Actions
    setIsAuthenticated: (isAuthenticated: boolean) =>
      set({ isAuthenticated }),

    logout: () =>
      set({ isAuthenticated: false }),
  }));
}

// ============================================================================
// Context
// ============================================================================

type AuthStoreApi = ReturnType<typeof createAuthStore>;

export const AuthStoreContext = createContext<AuthStoreApi | undefined>(undefined);

// ============================================================================
// Hooks
// ============================================================================

/**
 * Auth Store 훅
 * Provider 내부에서만 사용 가능
 */
export function useAuthStore<T>(selector: (store: AuthStore) => T): T {
  const store = useContext(AuthStoreContext);

  if (!store) {
    throw new Error("useAuthStore must be used within AuthStoreProvider");
  }

  return useStore(store, selector);
}

// ============================================================================
// Selectors
// ============================================================================

/**
 * 인증 상태 조회
 */
export const useIsAuthenticated = () =>
  useAuthStore((state) => state.isAuthenticated);

/**
 * 인증 상태 설정 액션
 */
export const useSetIsAuthenticated = () =>
  useAuthStore((state) => state.setIsAuthenticated);

/**
 * 로그아웃 액션
 */
export const useLogout = () =>
  useAuthStore((state) => state.logout);

// ============================================================================
// Legacy Export (하위 호환성)
// ============================================================================

/**
 * @deprecated useAuthStore 또는 개별 selector 훅 사용 권장
 * 하위 호환성을 위해 유지
 */
export const useAuthStoreLegacy = () => {
  const isAuthenticated = useIsAuthenticated();
  const setIsAuthenticated = useSetIsAuthenticated();
  const logout = useLogout();

  return {
    isAuthenticated,
    setIsAuthenticated,
    logout,
  };
};

// ============================================================================
// Export Store Creator (Provider에서 사용)
// ============================================================================

export { createAuthStore };
