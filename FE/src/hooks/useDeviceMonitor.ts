import { useState, useEffect, useCallback } from "react";
import { dashboardService } from "../services/dashboard.service";
import type { WindowEventItem, ScreenshotItem } from "../services/dashboard.service";

// -----------------------------------------------------------------------------
// useDeviceMonitor — Hook quản lý state cho trang DeviceMonitor.
// Fetch WindowEvent + Screenshot theo deviceId và dateKey.
// -----------------------------------------------------------------------------

interface UseDeviceMonitorState {
  events: WindowEventItem[];
  screenshots: ScreenshotItem[];
  loadingEvents: boolean;
  loadingScreenshots: boolean;
  error: string | null;
  currentDate: string;                 // "YYYY-MM-DD"
  totalEvents: number;
  totalScreenshots: number;
  eventPage: number;
  screenshotPage: number;
  eventTotalPages: number;
  screenshotTotalPages: number;
  search: string;
  sort: "desc" | "asc";
}

interface UseDeviceMonitorReturn extends UseDeviceMonitorState {
  changeDate: (dateKey: string) => void;
  setSearch: (term: string) => void;
  setSort: (order: "desc" | "asc") => void;
  setEventPage: (page: number) => void;
  setScreenshotPage: (page: number) => void;
  refresh: () => void;
}

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useDeviceMonitor(deviceId: string): UseDeviceMonitorReturn {
  const [state, setState] = useState<UseDeviceMonitorState>({
    events: [],
    screenshots: [],
    loadingEvents: false,
    loadingScreenshots: false,
    error: null,
    currentDate: todayDateKey(),
    totalEvents: 0,
    totalScreenshots: 0,
    eventPage: 1,
    screenshotPage: 1,
    eventTotalPages: 1,
    screenshotTotalPages: 1,
    search: "",
    sort: "desc",
  });

  // ── Fetch WindowEvents ──────────────────────────────────────────────────────
  const fetchEvents = useCallback(
    async (dateKey: string, page: number, search: string, sort: "desc" | "asc") => {
      setState((s) => ({ ...s, loadingEvents: true, error: null }));
      try {
        // Parse startDate / endDate theo giờ địa phương của trình duyệt
        const start = new Date(`${dateKey}T00:00:00.000`);
        const end = new Date(`${dateKey}T23:59:59.999`);
        
        const res = await dashboardService.getActivity(deviceId, {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          search: search || undefined,
          sort,
          page,
          limit: 20,
        });
        setState((s) => ({
          ...s,
          events: res.events,
          totalEvents: res.total,
          eventTotalPages: res.totalPages,
          loadingEvents: false,
          eventPage: page,
        }));
      } catch (err) {
        setState((s) => ({
          ...s,
          loadingEvents: false,
          error: err instanceof Error ? err.message : "Không thể tải dữ liệu hoạt động",
        }));
      }
    },
    [deviceId]
  );

  // ── Fetch Screenshots ───────────────────────────────────────────────────────
  const fetchScreenshots = useCallback(
    async (dateKey: string, page: number, append = false) => {
      setState((s) => ({ ...s, loadingScreenshots: true }));
      try {
        const start = new Date(`${dateKey}T00:00:00.000`);
        const end = new Date(`${dateKey}T23:59:59.999`);
        
        const res = await dashboardService.getScreenshots(deviceId, {
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          search: state.search || undefined,
          sort: state.sort,
          page,
          limit: 12,
        });
        setState((s) => ({
          ...s,
          screenshots: append
            ? [...s.screenshots, ...res.screenshots]
            : res.screenshots,
          totalScreenshots: res.total,
          screenshotTotalPages: res.totalPages,
          loadingScreenshots: false,
          screenshotPage: page,
        }));
      } catch {
        setState((s) => ({ ...s, loadingScreenshots: false }));
      }
    },
    [deviceId]
  );

  // ── Initial load & khi state thay đổi ───────────────────────────────────
  useEffect(() => {
    if (!deviceId) return;
    fetchEvents(state.currentDate, state.eventPage, state.search, state.sort);
  }, [deviceId, fetchEvents, state.currentDate, state.eventPage, state.search, state.sort]);

  useEffect(() => {
    if (!deviceId) return;
    fetchScreenshots(state.currentDate, state.screenshotPage);
  }, [deviceId, fetchScreenshots, state.currentDate, state.screenshotPage]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const changeDate = useCallback((dateKey: string) => {
    setState((s) => ({
      ...s,
      currentDate: dateKey,
      eventPage: 1,
      screenshotPage: 1,
    }));
  }, []);

  const setSearch = useCallback((term: string) => {
    setState((s) => ({
      ...s,
      search: term,
      eventPage: 1,
    }));
  }, []);

  const setSort = useCallback((order: "desc" | "asc") => {
    setState((s) => ({
      ...s,
      sort: order,
      eventPage: order === "desc" ? 1 : Math.max(1, s.eventTotalPages),
    }));
  }, []);

  const setEventPage = useCallback((page: number) => {
    setState((s) => ({ ...s, eventPage: page }));
  }, []);

  const setScreenshotPage = useCallback((page: number) => {
    setState((s) => ({ ...s, screenshotPage: page }));
  }, []);

  const refresh = useCallback(() => {
    fetchEvents(state.currentDate, state.eventPage, state.search, state.sort);
    fetchScreenshots(state.currentDate, state.screenshotPage);
  }, [state.currentDate, state.eventPage, state.search, state.sort, fetchEvents, fetchScreenshots]);

  return { 
    ...state, 
    changeDate, 
    setSearch, 
    setSort, 
    setEventPage, 
    setScreenshotPage, 
    refresh 
  };
}
