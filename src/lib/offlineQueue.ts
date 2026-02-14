const QUEUE_KEY = "offline-sync-queue";

export interface QueuedStudyLog {
  id: string;
  subjectName: string;
  topicName?: string;
  durationMinutes: number;
  confidenceLevel: "low" | "medium" | "high";
  studyMode: string;
  createdAt: string;
}

function getQueue(): QueuedStudyLog[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedStudyLog[]): void {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function enqueue(entry: Omit<QueuedStudyLog, "id" | "createdAt">): void {
  const queue = getQueue();
  queue.push({
    ...entry,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  saveQueue(queue);
}

export function peekAll(): QueuedStudyLog[] {
  return getQueue();
}

export function removeFromQueue(id: string): void {
  saveQueue(getQueue().filter((e) => e.id !== id));
}

export function clearQueue(): void {
  localStorage.removeItem(QUEUE_KEY);
}

export function queueLength(): number {
  return getQueue().length;
}
