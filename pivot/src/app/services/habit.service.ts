import { Injectable, signal, computed } from '@angular/core';
import { Habit, StreakMetrics, KpiMetrics, TimerState } from '../models/habit.model';
import { OrgEngineService } from './org-engine.service';
import { AudioService } from './audio.service';

@Injectable({
  providedIn: 'root'
})
export class HabitService {
  private habitsSignal = signal<Habit[]>([]);
  public readonly habits = this.habitsSignal.asReadonly();

  private timersSignal = signal<Record<string, TimerState>>({});
  public readonly timers = this.timersSignal.asReadonly();

  public readonly kpiMetrics = computed<KpiMetrics>(() => {
    const list = this.habitsSignal();
    const todayKey = this.formatDateKey(new Date());

    let todayCount = 0;
    let todayTarget = 0;
    let bestCurrentStreak = 0;
    let bestCurrentName = 'None';
    let allTimeRecord = 0;
    let allTimeName = 'None';

    list.forEach(h => {
      const streak = this.calculateStreakMetrics(h);
      if (streak.currentStreak > bestCurrentStreak) {
        bestCurrentStreak = streak.currentStreak;
        bestCurrentName = h.name;
      }
      if (streak.bestStreak > allTimeRecord) {
        allTimeRecord = streak.bestStreak;
        allTimeName = h.name;
      }

      if (h.type === 'daily') {
        todayTarget += 1;
        if (h.logs && h.logs[todayKey]) todayCount += 1;
      } else {
        const stamps = (h.timestamps && h.timestamps[todayKey]) || [];
        todayCount += stamps.length;
        todayTarget += 4; // default target expectation for intervals
      }
    });

    const activeIntervalCount = list.filter(h => h.type === 'interval').length;
    const percent = todayTarget > 0 ? Math.min(100, Math.round((todayCount / todayTarget) * 100)) : 0;

    return {
      todayCount,
      todayTarget,
      todayPercent: percent,
      activeIntervalCount,
      bestStreak: bestCurrentStreak,
      bestStreakName: bestCurrentName,
      allTimeStreak: allTimeRecord,
      allTimeStreakName: allTimeName
    };
  });

  constructor(
    private orgEngine: OrgEngineService,
    private audioService: AudioService
  ) {
    this.seedHabits();
  }

  private seedHabits(): void {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dKey = (offset: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      return this.formatDateKey(d);
    };

    const h1Logs: Record<string, boolean> = {};
    [-5, -4, -3, -2, -1, 0].forEach(offset => h1Logs[dKey(offset)] = true);

    const h2Logs: Record<string, boolean> = {};
    [-8, -7, -6, -4, -3, -2, -1, 0].forEach(offset => h2Logs[dKey(offset)] = true);

    const todayKey = this.formatDateKey(today);
    const now = Date.now();
    const intervalTimestamps = [
      now - (3.5 * 3600 * 1000),
      now - (2.7 * 3600 * 1000),
      now - (1.9 * 3600 * 1000),
      now - (1.1 * 3600 * 1000),
      now - (0.3 * 3600 * 1000)
    ];

    const initialHabits: Habit[] = [
      {
        id: 'habit-interval-water',
        name: 'Hydrate 250ml Water (Refill & Stretch)',
        category: 'Health',
        type: 'interval',
        intervalSeconds: 2400, // 40m
        icon: '💧',
        color: 'sky',
        timestamps: { [todayKey]: intervalTimestamps }
      },
      {
        id: 'habit-1',
        name: 'Morning Mindfulness (15m)',
        category: 'Mindfulness',
        type: 'daily',
        icon: '🧘',
        color: 'purple',
        targetPerWeek: 7,
        logs: h1Logs
      },
      {
        id: 'habit-2',
        name: 'Deep Work Sprint (90m)',
        category: 'Productivity',
        type: 'daily',
        icon: '💻',
        color: 'indigo',
        targetPerWeek: 5,
        logs: h2Logs
      },
      {
        id: 'habit-interval-stretch',
        name: 'Desk Posture & Eye Rest Check',
        category: 'Health',
        type: 'interval',
        intervalSeconds: 1200, // 20m
        icon: '🚶',
        color: 'emerald',
        timestamps: {
          [todayKey]: [now - (2 * 3600 * 1000), now - (1 * 3600 * 1000)]
        }
      }
    ];

    this.habitsSignal.set(initialHabits);

    // Initialize timers for interval habits
    const initialTimers: Record<string, TimerState> = {};
    initialHabits.forEach(h => {
      if (h.type === 'interval' && h.intervalSeconds) {
        initialTimers[h.id] = {
          remainingSeconds: h.intervalSeconds,
          totalSeconds: h.intervalSeconds,
          isRunning: true
        };
      }
    });
    this.timersSignal.set(initialTimers);

    // Sync with Org-Mode engine
    initialHabits.forEach(h => this.syncHabitToOrg(h));
  }

  public formatDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  public calculateStreakMetrics(habit: Habit): StreakMetrics {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayKey = this.formatDateKey(today);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = this.formatDateKey(yesterday);

    if (habit.type === 'interval') {
      const timestampsMap = habit.timestamps || {};
      let currentStreak = 0;
      let cursorDate: Date | null = null;

      if (timestampsMap[todayKey] && timestampsMap[todayKey].length > 0) {
        cursorDate = new Date(today);
      } else if (timestampsMap[yesterdayKey] && timestampsMap[yesterdayKey].length > 0) {
        cursorDate = new Date(yesterday);
      }

      if (cursorDate) {
        while (timestampsMap[this.formatDateKey(cursorDate)] && timestampsMap[this.formatDateKey(cursorDate)].length > 0) {
          currentStreak++;
          cursorDate.setDate(cursorDate.getDate() - 1);
        }
      }

      const activeDates = Object.keys(timestampsMap)
        .filter(k => timestampsMap[k] && timestampsMap[k].length > 0)
        .sort();

      let bestStreak = 0;
      let tempRun = 0;
      let prevDate: Date | null = null;

      for (const dateStr of activeDates) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const currDate = new Date(y, m - 1, d);
        if (!prevDate) {
          tempRun = 1;
        } else {
          const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) tempRun++;
          else if (diffDays > 1) tempRun = 1;
        }
        if (tempRun > bestStreak) bestStreak = tempRun;
        prevDate = currDate;
      }

      return { currentStreak, bestStreak: Math.max(bestStreak, currentStreak) };
    } else {
      const logs = habit.logs || {};
      let currentStreak = 0;
      let cursorDate: Date | null = null;

      if (logs[todayKey]) {
        cursorDate = new Date(today);
      } else if (logs[yesterdayKey]) {
        cursorDate = new Date(yesterday);
      }

      if (cursorDate) {
        while (logs[this.formatDateKey(cursorDate)]) {
          currentStreak++;
          cursorDate.setDate(cursorDate.getDate() - 1);
        }
      }

      const activeDates = Object.keys(logs).filter(k => logs[k]).sort();
      let bestStreak = 0;
      let tempRun = 0;
      let prevDate: Date | null = null;

      for (const dateStr of activeDates) {
        const [y, m, d] = dateStr.split('-').map(Number);
        const currDate = new Date(y, m - 1, d);
        if (!prevDate) {
          tempRun = 1;
        } else {
          const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays === 1) tempRun++;
          else if (diffDays > 1) tempRun = 1;
        }
        if (tempRun > bestStreak) bestStreak = tempRun;
        prevDate = currDate;
      }

      return { currentStreak, bestStreak: Math.max(bestStreak, currentStreak) };
    }
  }

  public getTodayIntervalCount(habitId: string): number {
    const habit = this.habitsSignal().find(h => h.id === habitId);
    if (!habit || habit.type !== 'interval') return 0;
    const todayKey = this.formatDateKey(new Date());
    return (habit.timestamps && habit.timestamps[todayKey]) ? habit.timestamps[todayKey].length : 0;
  }

  public logIntervalHabit(habitId: string): void {
    const todayKey = this.formatDateKey(new Date());
    const now = Date.now();

    this.habitsSignal.update(habits =>
      habits.map(h => {
        if (h.id === habitId) {
          const currentMap = h.timestamps || {};
          const currentStamps = currentMap[todayKey] || [];
          return {
            ...h,
            timestamps: {
              ...currentMap,
              [todayKey]: [...currentStamps, now]
            }
          };
        }
        return h;
      })
    );

    // Reset timer
    const habit = this.habitsSignal().find(h => h.id === habitId);
    if (habit && habit.intervalSeconds) {
      this.timersSignal.update(t => ({
        ...t,
        [habitId]: {
          remainingSeconds: habit.intervalSeconds!,
          totalSeconds: habit.intervalSeconds!,
          isRunning: true
        }
      }));
    }

    this.audioService.playCheckin();
    this.syncHabitLogToOrg(habitId, 'interval');
  }

  public toggleDailyHabit(habitId: string, dateKey?: string): void {
    const targetDateKey = dateKey || this.formatDateKey(new Date());

    this.habitsSignal.update(habits =>
      habits.map(h => {
        if (h.id === habitId) {
          const logs = { ...(h.logs || {}) };
          logs[targetDateKey] = !logs[targetDateKey];
          return { ...h, logs };
        }
        return h;
      })
    );

    this.audioService.playCheckin();
    this.syncHabitLogToOrg(habitId, 'daily');
  }

  public tickTimer(habitId: string): void {
    const timers = this.timersSignal();
    const timer = timers[habitId];
    if (!timer || !timer.isRunning) return;

    if (timer.remainingSeconds <= 1) {
      // Trigger reached!
      this.timersSignal.update(t => ({
        ...t,
        [habitId]: {
          ...timer,
          remainingSeconds: timer.totalSeconds
        }
      }));
      this.audioService.playIntervalTrigger();
    } else {
      this.timersSignal.update(t => ({
        ...t,
        [habitId]: {
          ...timer,
          remainingSeconds: timer.remainingSeconds - 1
        }
      }));
    }
  }

  public getTimerRemaining(habitId: string): number {
    return this.timersSignal()[habitId]?.remainingSeconds || 0;
  }

  public setTimerRemaining(habitId: string, seconds: number): void {
    const current = this.timersSignal()[habitId];
    if (current) {
      this.timersSignal.update(t => ({
        ...t,
        [habitId]: {
          ...current,
          remainingSeconds: seconds
        }
      }));
    }
  }

  public toggleTimerPause(habitId: string): void {
    const current = this.timersSignal()[habitId];
    if (current) {
      this.timersSignal.update(t => ({
        ...t,
        [habitId]: {
          ...current,
          isRunning: !current.isRunning
        }
      }));
    }
  }

  private syncHabitToOrg(habit: Habit): void {
    const existing = this.orgEngine.getAllTasks().find(t => t.id === `org-${habit.id}`);
    if (!existing) {
      this.orgEngine.createTask({
        id: `org-${habit.id}`,
        title: habit.name,
        state: 'TODO',
        file: 'habits.org',
        tags: ['habit', habit.category.toLowerCase()],
        properties: {
          STYLE: 'habit',
          CATEGORY: habit.category,
          INTERVAL: String(habit.intervalSeconds || 0)
        }
      });
    }
  }

  private syncHabitLogToOrg(habitId: string, type: 'daily' | 'interval'): void {
    const orgTaskId = `org-${habitId}`;
    const task = this.orgEngine.getTask(orgTaskId);
    if (task) {
      this.orgEngine.addManualClock(orgTaskId, type === 'interval' ? 5 : 15, `Completed habit: ${type}`);
    }
  }
}
