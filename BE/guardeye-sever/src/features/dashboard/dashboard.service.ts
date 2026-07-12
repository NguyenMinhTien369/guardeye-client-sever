/*
// CODE CŨ (TỪ NHÁNH CỦA BẠN TRƯỚC KHI PULL):
// src/features/dashboard/dashboard.service.ts

// -----------------------------------------------------------------------------
// DASHBOARD SERVICE — Business logic cho Dashboard FE.
// Kiểm tra quyền sở hữu trước khi trả dữ liệu WindowEvent.
// -----------------------------------------------------------------------------

import dashboardRepository, { GetActivityParams } from "./dashboard.repository";

export interface GetActivityResponse {
  events: Array<{
    id: string;
    deviceId: string;
    timestamp: string;
    title: string;
    processName: string;
    dateKey: string;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  dateKey: string;
}

const dashboardService_old = {
  async getActivity(
    deviceId: string,
    ownerId: string,
    params: { dateKey?: string; page?: number; limit?: number },
  ): Promise<GetActivityResponse> {
    const isOwner = await dashboardRepository.verifyDeviceOwnership(deviceId, ownerId);
    if (!isOwner) {
      throw new Error("Bạn không có quyền xem dữ liệu thiết bị này");
    }

    const page  = Math.max(1, params.page  || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 30));
    const dateKey = params.dateKey || new Date().toISOString().slice(0, 10);

    const { events, total } = await dashboardRepository.getWindowEvents(
      deviceId,
      { dateKey, page, limit },
    );

    return {
      events,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      dateKey,
    };
  },
};
*/

// CODE MỚI TRÊN GITHUB:
import mongoose from "mongoose";
import { DashboardResponseDto } from "./dashboard.dto";
import Device, { DeviceStatus } from "../devices/devices.model";
import { WindowEvent } from "../agent/agent.model";

// --- Helper: Phân loại ứng dụng tạm thời ---
function getCategory(processName: string): { category: string; color: string; isGaming: boolean } {
  const name = processName.toLowerCase();
  
  // Danh sách Game
  if (name.includes("cs2") || name.includes("league") || name.includes("valorant") || name.includes("roblox") || name.includes("minecraft")) {
    return { category: "Game", color: "#EF4444", isGaming: true }; // Red
  }
  // Danh sách Giáo dục
  if (name.includes("word") || name.includes("excel") || name.includes("powerpoint") || name.includes("zoom") || name.includes("teams")) {
    return { category: "Giáo dục", color: "#10B981", isGaming: false }; // Green
  }
  // Danh sách Mạng xã hội & Giải trí
  if (name.includes("discord") || name.includes("skype") || name.includes("zalo")) {
    return { category: "Mạng xã hội", color: "#3B82F6", isGaming: false }; // Blue
  }
  if (name.includes("spotify") || name.includes("vlc") || name.includes("netflix")) {
    return { category: "Giải trí", color: "#F59E0B", isGaming: false }; // Orange
  }
  
  // Trình duyệt (có thể là học tập hoặc giải trí, gom vào Khác tạm)
  if (name.includes("chrome") || name.includes("edge") || name.includes("coccoc") || name.includes("firefox")) {
    return { category: "Trình duyệt", color: "#6B7280", isGaming: false }; // Gray
  }

  return { category: "Khác", color: "#6B7280", isGaming: false };
}

// --- Helper: Format phút ---
function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} phút`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h} giờ`;
  return `${h} giờ ${m} phút`;
}

export class DashboardService {
  async getDashboardSummary(childId: string): Promise<DashboardResponseDto> {
    // 1. Lấy thông tin thiết bị
    const device = await Device.findOne({ childId: new mongoose.Types.ObjectId(childId) });
    if (!device) {
      throw new Error("Không tìm thấy thiết bị cho trẻ này");
    }

    const deviceId = device._id;

    // 2. Tính toán ngày hiện tại & hôm qua
    const today = new Date();
    const todayKey = today.toISOString().split("T")[0]; // YYYY-MM-DD
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = yesterday.toISOString().split("T")[0];

    // Lấy Agent Status
    let agentStatus: "ACTIVE" | "PAUSED" | "OFFLINE" = "OFFLINE";
    let agentStatusText = "⚪ Ngoại tuyến";
    if (device.status === DeviceStatus.active) {
      agentStatus = "ACTIVE";
      agentStatusText = "● Đang theo dõi";
      if (device.isPaused) {
        agentStatus = "PAUSED";
        agentStatusText = "⏸ Đang tạm dừng";
      }
    }

    // --- AGGREGATION: Tổng thời gian hôm nay & hôm qua ---
    const totalTimeAgg = await WindowEvent.aggregate([
      { 
        $match: { 
          deviceId: deviceId,
          dateKey: { $in: [todayKey, yesterdayKey] }
        }
      },
      {
        $group: {
          _id: "$dateKey",
          // Đếm số document ~ số phút
          totalMinutes: { $sum: 1 },
          firstTime: { $min: "$timestamp" },
          lastTime: { $max: "$timestamp" }
        }
      }
    ]);

    let todayMinutes = 0;
    let yesterdayMinutes = 0;
    let startTime = "";
    let endTime = "";

    totalTimeAgg.forEach(item => {
      if (item._id === todayKey) {
        todayMinutes = item.totalMinutes;
        startTime = new Date(item.firstTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
        endTime = new Date(item.lastTime).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
      } else if (item._id === yesterdayKey) {
        yesterdayMinutes = item.totalMinutes;
      }
    });

    const diff = todayMinutes - yesterdayMinutes;
    const timeDiffText = diff > 0 
      ? `↑ nhiều hơn ${formatMinutes(diff)} so với hôm qua` 
      : diff < 0 
        ? `↓ ít hơn ${formatMinutes(Math.abs(diff))} so với hôm qua` 
        : "Tương đương hôm qua";

    // --- AGGREGATION: Top Apps hôm nay ---
    const topAppsAgg = await WindowEvent.aggregate([
      { $match: { deviceId: deviceId, dateKey: todayKey } },
      { $group: { _id: "$processName", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const topApps = topAppsAgg.map(app => {
      const catInfo = getCategory(app._id);
      return {
        name: app._id.replace(".exe", ""),
        durationFormatted: formatMinutes(app.count),
        percentage: todayMinutes > 0 ? Math.round((app.count / todayMinutes) * 100) : 0,
        isGaming: catInfo.isGaming,
        category: catInfo.category
      };
    });

    // Tính tổng thời gian theo danh mục
    const categoryMap: Record<string, number> = {};
    topAppsAgg.forEach(app => {
      const cat = getCategory(app._id).category;
      categoryMap[cat] = (categoryMap[cat] || 0) + app.count;
    });

    const categoryChart = Object.entries(categoryMap).map(([category, duration]) => ({
      category,
      percentage: todayMinutes > 0 ? Math.round((duration / todayMinutes) * 100) : 0
    }));

    // --- TIMELINE: 20 hoạt động gần nhất hôm nay ---
    const recentEvents = await WindowEvent.find({ deviceId: deviceId, dateKey: todayKey })
      .sort({ timestamp: -1 })
      .limit(20)
      .lean();

    const timeline = recentEvents.map(ev => {
      const catInfo = getCategory(ev.processName);
      return {
        time: new Date(ev.timestamp).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }),
        activity: ev.title || ev.processName,
        categoryTag: `[${catInfo.category}]`,
        isWarning: catInfo.isGaming
      };
    });

    // --- TRENDS: 7 ngày qua ---
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6); // Lấy 6 ngày trước + hôm nay = 7
    const sevenDaysAgoKey = sevenDaysAgo.toISOString().split("T")[0];

    const trendsAgg = await WindowEvent.aggregate([
      { 
        $match: { 
          deviceId: deviceId,
          dateKey: { $gte: sevenDaysAgoKey, $lte: todayKey }
        }
      },
      {
        $group: {
          _id: { dateKey: "$dateKey", processName: "$processName" },
          count: { $sum: 1 }
        }
      }
    ]);

    // Format trends data
    const last7DaysMap: Record<string, { label: string; categories: Record<string, number> }> = {};
    
    // Khởi tạo 7 ngày
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const k = d.toISOString().split("T")[0];
      const dayName = d.toLocaleDateString("vi-VN", { weekday: "short" }); // "Th 2", "Th 3"
      last7DaysMap[k] = { label: dayName, categories: {} };
    }

    trendsAgg.forEach(item => {
      const dKey = item._id.dateKey;
      const pName = item._id.processName;
      const count = item.count;
      
      if (last7DaysMap[dKey]) {
        const cat = getCategory(pName).category;
        last7DaysMap[dKey].categories[cat] = (last7DaysMap[dKey].categories[cat] || 0) + count;
      }
    });

    const last7Days = Object.values(last7DaysMap).map(day => ({
      date: day.label,
      categories: day.categories
    }));

    // Tính thời gian từ lần sync cuối
    const now = new Date();
    const lastSyncDiffMinutes = Math.floor((now.getTime() - device.updatedAt.getTime()) / 60000);
    const lastSyncText = lastSyncDiffMinutes === 0 ? "Vừa xong" : `${lastSyncDiffMinutes} phút trước`;

    return {
      overview: {
        totalTimeFormatted: formatMinutes(todayMinutes),
        timeDiffText,
        timeRange: startTime ? `Bắt đầu ${startTime} — kết thúc ${endTime}` : "Chưa có hoạt động hôm nay",
        agentStatus,
        agentStatusText
      },
      activity: {
        topApps,
        categoryChart,
        timeline
      },
      alerts: {
        badgeCount: 0, // Hiện tại DB chưa có model Alert
        list: []
      },
      trends: {
        last7Days,
        weeklyComparison: [
          `Tổng thời gian hôm nay: ${formatMinutes(todayMinutes)}`
        ],
        streakMessage: todayMinutes > 0 ? "🔥 Con có hoạt động học tập hôm nay!" : "Chưa có dữ liệu"
      },
      management: {
        deviceName: device.deviceName,
        lastSyncText,
        isConnected: device.status === DeviceStatus.active
      }
    };
  }

  async getActivity(
    deviceId: string,
    ownerId: string,
    params: { startDate?: string; endDate?: string; search?: string; sort?: string; page?: number; limit?: number },
  ) {
    const isOwner = await Device.exists({ _id: deviceId, parentId: ownerId });
    if (!isOwner) {
      throw new Error("Bạn không có quyền xem dữ liệu thiết bị này");
    }

    const page  = Math.max(1, params.page  || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20)); // Limit theo y/c phân trang là 20
    
    const query: any = { deviceId };

    if (params.startDate && params.endDate) {
      query.timestamp = {
        $gte: new Date(params.startDate),
        $lte: new Date(params.endDate)
      };
    } else {
      // Fallback
      const dateKey = new Date().toISOString().slice(0, 10);
      query.dateKey = dateKey;
    }

    if (params.search) {
      const regex = new RegExp(params.search, 'i');
      query.$or = [
        { title: regex },
        { processName: regex }
      ];
    }

    const sortOrder = params.sort === 'asc' ? 1 : -1;
    const skip = (page - 1) * limit;

    const events = await WindowEvent.find(query)
      .sort({ timestamp: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await WindowEvent.countDocuments(query);

    return {
      events: events.map(e => ({
        id: e._id.toString(),
        deviceId: e.deviceId.toString(),
        timestamp: e.timestamp.toISOString(),
        title: e.title,
        processName: e.processName,
        dateKey: e.dateKey
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      dateKey: query.dateKey || "",
    };
  }
}

export const dashboardService = new DashboardService();
