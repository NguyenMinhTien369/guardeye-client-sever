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
}

interface UseDeviceMonitorReturn extends UseDeviceMonitorState {
  changeDate: (dateKey: string) => void;
  loadMoreEvents: () => void;
  loadMoreScreenshots: () => void;
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
  });

  // ── Fetch WindowEvents ──────────────────────────────────────────────────────
  const fetchEvents = useCallback(
    async (dateKey: string, page: number, append = false) => {
      setState((s) => ({ ...s, loadingEvents: true, error: null }));
      try {
        const res = await dashboardService.getActivity(deviceId, {
          dateKey,
          page,
          limit: 30,
        });
        setState((s) => ({
          ...s,
          events: append ? [...s.events, ...res.events] : res.events,
          totalEvents: res.total,
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
        const res = await dashboardService.getScreenshots(deviceId, {
          dateKey,
          page,
          limit: 20,
        });
        setState((s) => ({
          ...s,
          screenshots: append
            ? [...s.screenshots, ...res.screenshots]
            : res.screenshots,
          totalScreenshots: res.total,
          loadingScreenshots: false,
          screenshotPage: page,
        }));
      } catch {
        setState((s) => ({ ...s, loadingScreenshots: false }));
      }
    },
    [deviceId]
  );

  // ── Initial load & khi deviceId thay đổi ───────────────────────────────────
  useEffect(() => {
    if (!deviceId) return;
    const today = todayDateKey();
    setState((s) => ({
      ...s,
      currentDate: today,
      events: [],
      screenshots: [],
      eventPage: 1,
      screenshotPage: 1,
    }));
    fetchEvents(today, 1);
    fetchScreenshots(today, 1);
  }, [deviceId, fetchEvents, fetchScreenshots]);

  // ── Actions ─────────────────────────────────────────────────────────────────
  const changeDate = useCallback(
    (dateKey: string) => {
      setState((s) => ({
        ...s,
        currentDate: dateKey,
        events: [],
        screenshots: [],
        eventPage: 1,
        screenshotPage: 1,
      }));
      fetchEvents(dateKey, 1);
      fetchScreenshots(dateKey, 1);
    },
    [fetchEvents, fetchScreenshots]
  );

  const loadMoreEvents = useCallback(() => {
    const nextPage = state.eventPage + 1;
    if (state.events.length < state.totalEvents) {
      fetchEvents(state.currentDate, nextPage, true);
    }
  }, [state, fetchEvents]);

  const loadMoreScreenshots = useCallback(() => {
    const nextPage = state.screenshotPage + 1;
    if (state.screenshots.length < state.totalScreenshots) {
      fetchScreenshots(state.currentDate, nextPage, true);
    }
  }, [state, fetchScreenshots]);

  const refresh = useCallback(() => {
    fetchEvents(state.currentDate, 1);
    fetchScreenshots(state.currentDate, 1);
  }, [state.currentDate, fetchEvents, fetchScreenshots]);

  return { ...state, changeDate, loadMoreEvents, loadMoreScreenshots, refresh };
}
