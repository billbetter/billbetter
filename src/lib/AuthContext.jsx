import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { sdk } from "@/api/sdk";
import { supabase } from "@/api/supabaseClient";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const lastUserIdRef = useRef(null);

  const loadProfile = useCallback(async () => {
    try {
      setAuthError(null);
      const currentUser = await sdk.auth.me();
      if (currentUser) {
        setUser(currentUser);
        setIsAuthenticated(true);
        lastUserIdRef.current = currentUser.id;
      } else {
        setUser(null);
        setIsAuthenticated(false);
        lastUserIdRef.current = null;
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
      setIsAuthenticated(false);
      lastUserIdRef.current = null;
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      // Ignore events that don't change the effective user to avoid refetch loops.
      const nextId = session?.user?.id || null;
      if (event === "TOKEN_REFRESHED" && nextId === lastUserIdRef.current)
        return;
      if (event === "INITIAL_SESSION" && nextId === lastUserIdRef.current)
        return;

      if (event === "SIGNED_OUT" || !nextId) {
        setUser(null);
        setIsAuthenticated(false);
        lastUserIdRef.current = null;
        setIsLoadingAuth(false);
        return;
      }

      if (nextId !== lastUserIdRef.current) {
        setIsLoadingAuth(true);
        loadProfile();
      }
    });

    return () => {
      sub?.subscription?.unsubscribe?.();
    };
  }, [loadProfile]);

  const logout = async (shouldRedirect = true) => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("signOut error:", e);
    }
    setUser(null);
    setIsAuthenticated(false);
    lastUserIdRef.current = null;
    if (shouldRedirect) {
      window.location.href = "/";
    }
  };

  const navigateToLogin = () => {
    sdk.auth.redirectToLogin();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        logout,
        navigateToLogin,
        checkAppState: loadProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
