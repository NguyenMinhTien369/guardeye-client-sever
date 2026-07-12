export interface TopApp {
  name: string;
  durationFormatted: string;
  percentage: number;
  isGaming: boolean;
  category: string;
}

export interface CategoryChart {
  category: string;
  percentage: number;
}

export interface TimelineEvent {
  time: string;
  activity: string;
  categoryTag: string;
  isWarning: boolean;
}

export interface DashboardResponseDto {
  overview: {
    totalTimeFormatted: string;
    timeDiffText: string;
    timeRange: string;
    agentStatus: "ACTIVE" | "PAUSED" | "OFFLINE";
    agentStatusText: string;
  };
  activity: {
    topApps: TopApp[];
    categoryChart: CategoryChart[];
    timeline: TimelineEvent[];
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
      categories: Record<string, number>;
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
