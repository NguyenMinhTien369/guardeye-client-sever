export interface DashboardResponseDto {
  overview: {
    totalTimeFormatted: string;
    timeDiffText: string;
    timeRange: string;
    agentStatus: "ACTIVE" | "PAUSED" | "OFFLINE";
    agentStatusText: string;
  };
  activity: {
    topApps: Array<{
      name: string;
      durationFormatted: string;
      percentage: number;
      isGaming: boolean;
    }>;
    categoryChart: Array<{
      category: string;
      percentage: number;
    }>;
    timeline: Array<{
      time: string;
      activity: string;
      durationFormatted?: string;
      categoryTag?: string;
      isWarning?: boolean;
    }>;
  };
  alerts: {
    badgeCount: number;
    list: Array<{
      level: "CRITICAL" | "WARNING" | "INFO";
      time: string;
      message: string;
    }>;
  };
  trends: {
    last7Days: Array<{
      date: string;
      categories: Record<string, number>; // value is in minutes
    }>;
    weeklyComparison: string[];
    streakMessage: string;
  };
  management: {
    deviceName: string;
    lastSyncText: string;
    isConnected: boolean;
  };
}
