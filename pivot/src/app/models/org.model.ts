export type NorangTodoState =
  | 'TODO'
  | 'NEXT'
  | 'STARTED'
  | 'WAITING'
  | 'HOLD'
  | 'DONE'
  | 'CANCELLED';

export type FastTodoKey = 't' | 'n' | 's' | 'w' | 'h' | 'd' | 'c';

export interface OrgClockEntry {
  id: string;
  startTime: string; // ISO string
  endTime?: string;
  durationMinutes: number;
  note?: string;
}

export interface OrgStateLog {
  timestamp: string;
  fromState?: NorangTodoState;
  toState: NorangTodoState;
  note?: string;
}

export interface OrgTask {
  id: string;
  title: string;
  state: NorangTodoState;
  scheduled?: string;
  deadline?: string;
  effort?: string; // e.g. "0:30", "1:15"
  tags: string[];
  properties: Record<string, string>;
  clocks: OrgClockEntry[];
  closedAt?: string;
  logs: OrgStateLog[];
  subtasks: OrgTask[];
  parentId?: string;
  file: string; // 'refile.org' | 'todo.org' | 'habits.org' | 'projects.org' | 'archive.org'
  body?: string;
  createdAt: string;
}

export interface CaptureTemplate {
  key: string;
  name: string;
  targetFile: string;
  defaultState: NorangTodoState;
  description: string;
}

export interface ActiveClock {
  taskId: string;
  taskTitle: string;
  startTime: string;
}

export interface BabelExecutionResult {
  status: 'success' | 'error';
  language: string;
  output: string;
}
