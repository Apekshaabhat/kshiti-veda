import React, { createContext, useContext, useState, useEffect } from "react";

export interface Farm {
  id: string;
  name: string;
  lat: number;
  lon: number;
  area: number;
  crop: string;
}

interface FarmContextType {
  farms: Farm[];
  activeFarm: Farm | null;
  setActiveFarmId: (id: string) => void;
  refreshFarms: (newFarm?: Farm) => Promise<void>;
}

const DEFAULT_FARMS: Farm[] = [
  { id: 'farm-1', name: 'Green Valley Estate', lat: 18.5204, lon: 73.8567, area: 14.2, crop: 'Rice + Wheat' },
  { id: 'farm-2', name: 'North Field Farm', lat: 19.9975, lon: 73.7898, area: 8.5, crop: 'Grapes' },
  { id: 'farm-3', name: 'Sunrise Plantation', lat: 12.9716, lon: 77.5946, area: 22.0, crop: 'Coffee' }
];

const FarmContext = createContext<FarmContextType | undefined>(undefined);

export const FarmProvider = ({ children }: { children: React.ReactNode }) => {
  const [farms, setFarms] = useState<Farm[]>(() => {
    const saved = localStorage.getItem('trinexa_farms_list');
    return saved ? JSON.parse(saved) : DEFAULT_FARMS;
  });
  const [activeFarmId, setActiveFarmId] = useState<string | null>(() => {
    return localStorage.getItem('soilmatrix_farm') || 'farm-1';
  });

  const refreshFarms = async (newFarm?: Farm) => {
    if (newFarm) {
      setFarms((prev) => {
        const updated = [...prev, newFarm];
        localStorage.setItem('trinexa_farms_list', JSON.stringify(updated));
        return updated;
      });
      return;
    }

    try {
      const r = await fetch('http://localhost:3001/api/farms');
      if (r.ok) {
        const data = await r.json();
        if (Array.isArray(data) && data.length > 0) {
          setFarms(data);
          localStorage.setItem('trinexa_farms_list', JSON.stringify(data));
          if (!data.find((f: any) => f.id === activeFarmId)) {
            setActiveFarmId(data[0].id);
            localStorage.setItem('soilmatrix_farm', data[0].id);
          }
          return;
        }
      }
    } catch(e) {
      console.log('Using local farm context fallback');
    }
  };

  useEffect(() => { refreshFarms(); }, []);

  const setActive = (id: string) => {
    setActiveFarmId(id);
    localStorage.setItem('soilmatrix_farm', id);
  };

  const activeFarm = farms.find(f => f.id === activeFarmId) || farms[0] || null;

  return (
    <FarmContext.Provider value={{ farms, activeFarm, setActiveFarmId: setActive, refreshFarms }}>
      {children}
    </FarmContext.Provider>
  );
};

export const useFarm = () => {
  const context = useContext(FarmContext);
  if (!context) throw new Error("useFarm must be used within FarmProvider");
  return context;
};

