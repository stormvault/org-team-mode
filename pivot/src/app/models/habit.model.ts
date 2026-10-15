export type HabitType = 'daily' | 'interval';

export type HabitColor = 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky' | 'purple';

export interface Habit {
  id: string;
  name: string;
  category: string;
  type: HabitType;
  icon: string;
  color: HabitColor;
  intervalSeconds?: number;
  targetPerWeek?: number;
  logs?: Record<string, boolean>; // dateKey YYYY-MM-DD -> boolean
  timestamps?: Record<string, number[]>; // dateKey -> timestamp array
  orgTaskId?: string;
}

export interface StreakMetrics {
  currentStreak: number;
  bestStreak: number;
}

export interface KpiMetrics {
  todayCount: number;
  todayTarget: number;
  todayPercent: number;
  activeIntervalCount: number;
  bestStreak: number;
  bestStreakName: string;
  allTimeStreak: number;
  allTimeStreakName: string;
}

export interface TimerState {
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
}
