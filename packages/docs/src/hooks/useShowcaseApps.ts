import { useEffect, useState } from 'react';
import { SHOWCASE_APPS, mergeShowcaseApps } from '../lib/showcase';
import { parseApprovedShowcaseApps } from '../lib/showcase-submissions';

export function useShowcaseApps() {
  const [apps, setApps] = useState(SHOWCASE_APPS);
  useEffect(() => {
    const controller = new AbortController();
    async function loadApproved() {
      try {
        const response = await fetch('/api/showcase/apps', {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data: unknown = await response.json();
        setApps(
          mergeShowcaseApps(SHOWCASE_APPS, parseApprovedShowcaseApps(data))
        );
      } catch {
        // Keep the curated catalog available when the queue is offline.
      }
    }
    void loadApproved();
    return () => controller.abort();
  }, []);
  return apps;
}
