"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface CrewContextType {
  isEmployee: boolean;
  loading: boolean;
}

const CrewContext = createContext<CrewContextType>({
  isEmployee: false,
  loading: true,
});

export function CrewProvider({ children }: { children: React.ReactNode }) {
  const [isEmployee, setIsEmployee] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkRole = async () => {
      try {
        setIsEmployee(false);
      } catch {
        setIsEmployee(false);
      } finally {
        setLoading(false);
      }
    };
    checkRole();
  }, []);

  return (
    <CrewContext.Provider value={{ isEmployee, loading }}>
      {children}
    </CrewContext.Provider>
  );
}

export function useCrew() {
  return useContext(CrewContext);
}