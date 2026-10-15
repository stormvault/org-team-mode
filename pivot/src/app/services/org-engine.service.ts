import { Injectable, signal, computed } from '@angular/core';
import {
  NorangTodoState,
  FastTodoKey,
  OrgTask,
  OrgClockEntry,
  ActiveClock,
  CaptureTemplate,
  BabelExecutionResult
} from '../models/org.model';

@Injectable({
  providedIn: 'root'
})
export class OrgEngineService {
  private tasksSignal = signal<OrgTask[]>([]);
  public readonly tasks = this.tasksSignal.asReadonly();

  private activeClockSignal = signal<ActiveClock | null>(null);
  public readonly activeClock = this.activeClockSignal.asReadonly();

  public readonly captureTemplates: CaptureTemplate[] = [
    { key: 't', name: 'Task', targetFile: 'refile.org', defaultState: 'TODO', description: 'Actionable todo item' },
    { key: 'h', name: 'Habit', targetFile: 'habits.org', defaultState: 'TODO', description: 'Recurring daily or interval habit' },
    { key: 'n', name: 'Note', targetFile: 'refile.org', defaultState: 'TODO', description: 'Quick observation or knowledge item' },
    { key: 'p', name: 'Phone Call', targetFile: 'refile.org', defaultState: 'TODO', description: 'Phone call log with action items' },
    { key: 'm', name: 'Meeting', targetFile: 'refile.org', defaultState: 'TODO', description: 'Meeting notes and attendee log' }
  ];

  public readonly nextActions = computed(() =>
    this.tasksSignal().filter(t => t.state === 'NEXT')
  );

  public readonly waitingTasks = computed(() =>
    this.tasksSignal().filter(t => t.state === 'WAITING')
  );

  public readonly holdTasks = computed(() =>
    this.tasksSignal().filter(t => t.state === 'HOLD')
  );

  constructor() {
    this.seedDefaultTasks();
  }

  private seedDefaultTasks(): void {
    const defaultTasks: OrgTask[] = [
      {
        id: 'task-org-1',
        title: 'Review weekly GTD projects and clear inbox',
        state: 'NEXT',
        tags: ['review', 'admin'],
        properties: { CATEGORY: 'OrgReview' },
        clocks: [],
        logs: [{ timestamp: new Date().toISOString(), toState: 'NEXT' }],
        subtasks: [],
        file: 'todo.org',
        createdAt: new Date().toISOString()
      },
      {
        id: 'task-org-2',
        title: 'Verify phone MFA linking flow',
        state: 'TODO',
        effort: '0:45',
        tags: ['security', 'auth'],
        properties: {},
        clocks: [],
        logs: [{ timestamp: new Date().toISOString(), toState: 'TODO' }],
        subtasks: [],
        file: 'projects.org',
        createdAt: new Date().toISOString()
      }
    ];
    this.tasksSignal.set(defaultTasks);
  }

  public getStateFromFastKey(key: string): NorangTodoState | null {
    switch (key.toLowerCase()) {
      case 't': return 'TODO';
      case 'n': return 'NEXT';
      case 's': return 'STARTED';
      case 'w': return 'WAITING';
      case 'h': return 'HOLD';
      case 'd': return 'DONE';
      case 'c': return 'CANCELLED';
      default: return null;
    }
  }

  public createTask(params: Partial<OrgTask> & { title: string }): OrgTask {
    const newTask: OrgTask = {
      id: params.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      title: params.title,
      state: params.state || 'TODO',
      scheduled: params.scheduled,
      deadline: params.deadline,
      effort: params.effort,
      tags: params.tags || [],
      properties: params.properties || {},
      clocks: params.clocks || [],
      logs: params.logs || [],
      subtasks: params.subtasks || [],
      parentId: params.parentId,
      file: params.file || 'refile.org',
      body: params.body || '',
      createdAt: new Date().toISOString()
    };

    this.tasksSignal.update(tasks => [...tasks, newTask]);
    return newTask;
  }

  public getTask(id: string): OrgTask | undefined {
    return this.tasksSignal().find(t => t.id === id);
  }

  public getAllTasks(): OrgTask[] {
    return this.tasksSignal();
  }

  public setTaskState(id: string, newState: NorangTodoState, note?: string): boolean {
    let updated = false;
    this.tasksSignal.update(tasks =>
      tasks.map(t => {
        if (t.id === id) {
          updated = true;
          const logEntry = {
            timestamp: new Date().toISOString(),
            fromState: t.state,
            toState: newState,
            note
          };
          const closedAt = (newState === 'DONE' || newState === 'CANCELLED')
            ? new Date().toISOString()
            : undefined;

          return {
            ...t,
            state: newState,
            logs: [...t.logs, logEntry],
            closedAt
          };
        }
        return t;
      })
    );
    return updated;
  }

  public capture(params: {
    templateKey: string;
    title: string;
    body?: string;
    tags?: string[];
    effort?: string;
  }): OrgTask {
    const template = this.captureTemplates.find(tpl => tpl.key === params.templateKey)
      || this.captureTemplates[0];

    const tags = params.tags || [];
    if (params.templateKey === 'm' && !tags.includes('meeting')) tags.push('meeting');
    if (params.templateKey === 'p' && !tags.includes('phone')) tags.push('phone');
    if (params.templateKey === 'h' && !tags.includes('habit')) tags.push('habit');

    return this.createTask({
      title: params.title,
      state: template.defaultState,
      file: template.targetFile,
      body: params.body,
      tags,
      effort: params.effort
    });
  }

  public refileTask(id: string, targetFile: string, targetParentId?: string): boolean {
    let updated = false;
    this.tasksSignal.update(tasks =>
      tasks.map(t => {
        if (t.id === id) {
          updated = true;
          return {
            ...t,
            file: targetFile,
            parentId: targetParentId
          };
        }
        return t;
      })
    );
    return updated;
  }

  public clockIn(taskId: string): void {
    const task = this.getTask(taskId);
    if (!task) return;

    // Clock out previous if active
    if (this.activeClockSignal()) {
      this.clockOut();
    }

    this.activeClockSignal.set({
      taskId: task.id,
      taskTitle: task.title,
      startTime: new Date().toISOString()
    });

    this.setTaskState(taskId, 'STARTED');
  }

  public clockOut(note?: string): OrgClockEntry | null {
    const active = this.activeClockSignal();
    if (!active) return null;

    const endTime = new Date();
    const startTime = new Date(active.startTime);
    const diffMs = Math.max(0, endTime.getTime() - startTime.getTime());
    const durationMinutes = Math.round(diffMs / 60000);

    const clockEntry: OrgClockEntry = {
      id: `clock-${Date.now()}`,
      startTime: active.startTime,
      endTime: endTime.toISOString(),
      durationMinutes,
      note
    };

    this.tasksSignal.update(tasks =>
      tasks.map(t => {
        if (t.id === active.taskId) {
          return {
            ...t,
            clocks: [...t.clocks, clockEntry]
          };
        }
        return t;
      })
    );

    this.activeClockSignal.set(null);
    return clockEntry;
  }

  public getActiveClock(): ActiveClock | null {
    return this.activeClockSignal();
  }

  public addManualClock(taskId: string, durationMinutes: number, note?: string): void {
    const entry: OrgClockEntry = {
      id: `clock-${Date.now()}`,
      startTime: new Date(Date.now() - durationMinutes * 60000).toISOString(),
      endTime: new Date().toISOString(),
      durationMinutes,
      note
    };

    this.tasksSignal.update(tasks =>
      tasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            clocks: [...t.clocks, entry]
          };
        }
        return t;
      })
    );
  }

  public advanceHabitSchedule(taskId: string, repeater = '1d'): void {
    const now = new Date();
    let nextDate = new Date(now);
    if (repeater.endsWith('d')) {
      const days = parseInt(repeater, 10) || 1;
      nextDate.setDate(now.getDate() + days);
    } else if (repeater.endsWith('m')) {
      const mins = parseInt(repeater, 10) || 30;
      nextDate = new Date(now.getTime() + mins * 60000);
    }

    this.tasksSignal.update(tasks =>
      tasks.map(t => {
        if (t.id === taskId) {
          return {
            ...t,
            scheduled: nextDate.toISOString(),
            logs: [
              ...t.logs,
              {
                timestamp: new Date().toISOString(),
                fromState: t.state,
                toState: 'TODO',
                note: `Habit completion logged, advanced repeater .+${repeater}`
              }
            ]
          };
        }
        return t;
      })
    );
  }

  public parseEffortMinutes(effort?: string): number {
    if (!effort) return 0;
    const parts = effort.split(':').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    const num = parseInt(effort, 10);
    return isNaN(num) ? 0 : num;
  }

  public getTaskClockSumMinutes(taskId: string): number {
    const task = this.getTask(taskId);
    if (!task) return 0;
    return task.clocks.reduce((sum, c) => sum + (c.durationMinutes || 0), 0);
  }

  public isTaskOvertime(taskId: string): boolean {
    const task = this.getTask(taskId);
    if (!task || !task.effort) return false;
    const effortMin = this.parseEffortMinutes(task.effort);
    if (effortMin <= 0) return false;
    const clockSum = this.getTaskClockSumMinutes(taskId);
    return clockSum > effortMin;
  }

  public getStuckProjects(): OrgTask[] {
    const all = this.tasksSignal();
    // A project is a task in projects.org or tagged 'project', or having subtasks
    const projects = all.filter(
      t => t.file === 'projects.org' || t.tags.includes('project') || all.some(sub => sub.parentId === t.id)
    );

    return projects.filter(proj => {
      // Find subtasks
      const subtasks = all.filter(t => t.parentId === proj.id);
      if (subtasks.length === 0) {
        // Project with no subtasks is stuck unless it's itself NEXT/STARTED
        return proj.state !== 'NEXT' && proj.state !== 'STARTED' && proj.state !== 'DONE';
      }
      // If none of its subtasks are in NEXT or STARTED state, it's stuck!
      const hasActiveAction = subtasks.some(s => s.state === 'NEXT' || s.state === 'STARTED');
      return !hasActiveAction;
    });
  }

  public getNextActions(): OrgTask[] {
    return this.nextActions();
  }

  public filterByTag(tag: string): OrgTask[] {
    const normalized = tag.toLowerCase().replace(/^:/, '').replace(/:$/, '');
    return this.tasksSignal().filter(t =>
      t.tags.some(tg => tg.toLowerCase() === normalized)
    );
  }

  public executeBabelBlock(language: string, code: string): BabelExecutionResult {
    // Client-side deterministic evaluation simulator
    const trimmed = code.trim();
    if (language === 'python') {
      if (trimmed.includes('print(')) {
        const matches = trimmed.match(/print\((?:'|")(.*)(?:'|")\)/);
        const out = matches ? matches[1] : 'Execution completed.';
        return { status: 'success', language, output: out };
      }
      return { status: 'success', language, output: `[Python Output]: Evaluated ${trimmed.length} chars.` };
    } else if (language === 'javascript' || language === 'sh' || language === 'elisp') {
      return { status: 'success', language, output: `[${language} Output]: Output of evaluated block.` };
    }
    return { status: 'success', language, output: `[Babel]: Processed ${language} code successfully.` };
  }

  public exportToMarkdown(): string {
    const lines: string[] = ['# Org Mode Document', '', `Generated: ${new Date().toLocaleString()}`, ''];
    for (const t of this.tasksSignal()) {
      const tagsStr = t.tags.length > 0 ? ` :${t.tags.join(':')}:` : '';
      lines.push(`## [${t.state}] ${t.title}${tagsStr}`);
      if (t.effort) lines.push(`- Effort: ${t.effort}`);
      if (t.clocks.length > 0) {
        const total = this.getTaskClockSumMinutes(t.id);
        lines.push(`- Clock sum: ${Math.floor(total / 60)}h ${total % 60}m`);
      }
      if (t.body) lines.push('', t.body, '');
    }
    return lines.join('\n');
  }

  public exportToHtml(): string {
    const md = this.exportToMarkdown();
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Org Mode Export</title>
  <style>body { font-family: sans-serif; max-width: 800px; margin: 40px auto; line-height: 1.6; color: #1e293b; }</style>
</head>
<body>
<pre>${md}</pre>
</body>
</html>`;
  }

  public exportClockTableToCsv(): string {
    const rows = ['Task ID,Title,File,Total Minutes,Total Hours'];
    for (const t of this.tasksSignal()) {
      const minutes = this.getTaskClockSumMinutes(t.id);
      if (minutes > 0 || t.clocks.length > 0) {
        const hours = (minutes / 60).toFixed(2);
        rows.push(`"${t.id}","${t.title.replace(/"/g, '""')}","${t.file}",${minutes},${hours}`);
      }
    }
    return rows.join('\n');
  }
}
