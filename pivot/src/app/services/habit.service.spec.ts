import { describe, it, expect, beforeEach } from 'vitest';
import { HabitService } from './habit.service';
import { OrgEngineService } from './org-engine.service';
import { AudioService } from './audio.service';

describe('HabitService (HabitFlow Pro Precision Engine)', () => {
  let habitService: HabitService;
  let orgService: OrgEngineService;
  let audioService: AudioService;

  beforeEach(() => {
    orgService = new OrgEngineService();
    audioService = new AudioService();
    habitService = new HabitService(orgService, audioService);
  });

  describe('Habit Streaks & Metrics', () => {
    it('should initialize with default precision habits (interval & daily)', () => {
      const habits = habitService.habits();
      expect(habits.length).toBeGreaterThanOrEqual(4);
      expect(habits.some(h => h.type === 'interval')).toBe(true);
      expect(habits.some(h => h.type === 'daily')).toBe(true);
    });

    it('should calculate accurate streak metrics for daily habits', () => {
      const habit = habitService.habits().find(h => h.id === 'habit-1');
      expect(habit).toBeDefined();
      if (habit) {
        const metrics = habitService.calculateStreakMetrics(habit);
        expect(metrics.currentStreak).toBeGreaterThanOrEqual(1);
        expect(metrics.bestStreak).toBeGreaterThanOrEqual(metrics.currentStreak);
      }
    });

    it('should log a check-in for an interval habit and sync with Org-Mode', () => {
      const intervalHabit = habitService.habits().find(h => h.type === 'interval');
      expect(intervalHabit).toBeDefined();
      if (intervalHabit) {
        const initialLogs = habitService.getTodayIntervalCount(intervalHabit.id);
        habitService.logIntervalHabit(intervalHabit.id);
        const newLogs = habitService.getTodayIntervalCount(intervalHabit.id);
        expect(newLogs).toBe(initialLogs + 1);

        // Verify Org-mode task was updated or exists
        const orgTasks = orgService.getAllTasks();
        expect(orgTasks.some(t => t.file === 'habits.org' || t.title.includes(intervalHabit.name))).toBe(true);
        const orgTask = orgService.getTask(`org-${intervalHabit.id}`);
        expect(orgTask?.scheduled).toBeDefined();
        expect(orgTask?.logs.some(l => l.note?.includes('advanced repeater'))).toBe(true);
      }
    });

    it('should calculate KPI metrics correctly', () => {
      const kpis = habitService.kpiMetrics();
      expect(kpis.todayCount).toBeGreaterThanOrEqual(0);
      expect(kpis.activeIntervalCount).toBeGreaterThan(0);
      expect(kpis.allTimeStreak).toBeGreaterThanOrEqual(0);
    });

    it('should handle interval timer countdown tick and reset', () => {
      const intervalHabit = habitService.habits().find(h => h.type === 'interval');
      if (intervalHabit) {
        habitService.setTimerRemaining(intervalHabit.id, 5);
        expect(habitService.getTimerRemaining(intervalHabit.id)).toBe(5);

        habitService.tickTimer(intervalHabit.id);
        expect(habitService.getTimerRemaining(intervalHabit.id)).toBe(4);
      }
    });
  });
});
