/** In-process cancel hooks for active Remotion renders (same Node process). */

const cancelByJobId = new Map<string, () => void>();

export function registerRenderCancel(id: string, cancel: () => void) {
  cancelByJobId.set(id, cancel);
}

export function clearRenderCancel(id: string) {
  cancelByJobId.delete(id);
}

export function cancelRenderJob(id: string) {
  const cancel = cancelByJobId.get(id);
  if (cancel) cancel();
}
