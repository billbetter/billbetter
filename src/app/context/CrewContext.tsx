'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createClient } from '@/app/lib/supabase';

interface CrewMember {
    id: string;
    name: string;
    email: string;
    role: string;
    user_id?: string;
}

interface CrewContextType {
    crewMembers: CrewMember[];
    setCrewMembers: (members: CrewMember[]) => void;
    loading: boolean;
    refreshCrew: () => void;
}

const CrewContext = createContext<CrewContextType>({
    crewMembers: [],
    setCrewMembers: () => {},
    loading: false,
    refreshCrew: () => {},
});

export function CrewProvider({ children }: { children: ReactNode }) {
    const [crewMembers, setCrewMembers] = useState<CrewMember[]>([]);
    const [loading, setLoading] = useState(false);

  const refreshCrew = async () => {
        try {
                setLoading(true);
                const supabase = createClient();
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) return;
                const { data } = await supabase
                  .from('crew_members')
                  .select('*')
                  .eq('owner_id', user.id);
                if (data) setCrewMembers(data);
        } catch (err) {
                console.error('Error fetching crew:', err);
        } finally {
                setLoading(false);
        }
  };

  useEffect(() => {
        refreshCrew();
  }, []);

  return (
        <CrewContext.Provider value={{ crewMembers, setCrewMembers, loading, refreshCrew }}>
          {children}
        </CrewContext.Provider>
      );
}

export function useCrew() {
    return useContext(CrewContext);
}
