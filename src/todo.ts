export interface Todo {
  id: number;
  text: string;
  done: boolean;
}

export type Filter = "all" | "active" | "done";

// Simple in-memory store with a subscribe/notify pattern.
export class TodoStore {
  private todos: Todo[] = [];
  private seq = 1;
  private listeners = new Set<() => void>();
  filter: Filter = "all";

  constructor(seed: string[] = []) {
    for (const t of seed) this.add(t);
  }

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private emit() {
    for (const fn of this.listeners) fn();
  }

  all(): Todo[] {
    return this.todos;
  }
  visible(): Todo[] {
    if (this.filter === "active") return this.todos.filter((t) => !t.done);
    if (this.filter === "done") return this.todos.filter((t) => t.done);
    return this.todos;
  }
  counts() {
    const done = this.todos.filter((t) => t.done).length;
    return { total: this.todos.length, done, active: this.todos.length - done };
  }

  add(text: string): Todo | null {
    const clean = text.trim();
    if (!clean) return null;
    const todo: Todo = { id: this.seq++, text: clean, done: false };
    this.todos.unshift(todo);
    this.emit();
    return todo;
  }
  toggle(id: number): boolean {
    const t = this.todos.find((x) => x.id === id);
    if (!t) return false;
    t.done = !t.done;
    this.emit();
    return t.done;
  }
  remove(id: number) {
    this.todos = this.todos.filter((t) => t.id !== id);
    this.emit();
  }
  clearDone() {
    this.todos = this.todos.filter((t) => !t.done);
    this.emit();
  }
  setFilter(f: Filter) {
    this.filter = f;
    this.emit();
  }
}
