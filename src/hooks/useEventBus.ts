import { useCallback } from "react";
import { emitEvent } from "@/lib/eventBus";

/**
 * Hook for emitting events to the Omnichannel Notification Engine.
 * Non-blocking — errors are silently caught.
 *
 * Usage:
 *   const { emit } = useEventBus();
 *   emit("study_session_end", { duration: 30, topicId: "..." });
 */
export function useEventBus() {
  const emit = useCallback(
    (
      eventType: string,
      data: Record<string, any> = {},
      options: { source?: string; title?: string; body?: string } = {}
    ) => {
      emitEvent(eventType, data, options);
    },
    []
  );

  return { emit };
}
