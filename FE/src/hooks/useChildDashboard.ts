import { useState, useEffect } from "react";
import { dashboardService } from "../services/dashboard.service";
import type { DashboardResponseDto } from "../types/dashboard.types";

export function useChildDashboard(childId: string | undefined) {
  const [data, setData] = useState<DashboardResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    if (!childId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await dashboardService.getDashboardSummary(childId);
      setData(res);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [childId]);

  return { data, loading, error, refresh: fetchDashboard };
}
