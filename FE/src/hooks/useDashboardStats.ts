import { useState, useEffect, useCallback } from "react";
import { childrenService } from "../services/children.service";
import { devicesService } from "../services/devices.service";
import type { Child } from "../types/children.types";
import type { Device } from "../types/devices.types";

export interface DashboardStats {
  children: Child[];
  devices: Device[];
  totalChildren: number;
  totalDevices: number;
  activeDevices: number;
  loading: boolean;
  error: string | null;
}

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats>({
    children: [],
    devices: [],
    totalChildren: 0,
    totalDevices: 0,
    activeDevices: 0,
    loading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setStats((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const [childrenRes, devicesRes] = await Promise.all([
        childrenService.getAll(),
        devicesService.getAll(),
      ]);

      const children = childrenRes.data || [];
      const devices = devicesRes.data || [];

      const activeDevices = devices.filter((d) => d.status === "active" && !d.isPaused).length;

      setStats({
        children,
        devices,
        totalChildren: children.length,
        totalDevices: devices.length,
        activeDevices,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      setStats((prev) => ({
        ...prev,
        loading: false,
        error: err.message || "Lỗi khi tải dữ liệu dashboard",
      }));
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { ...stats, refresh: fetchData };
}
