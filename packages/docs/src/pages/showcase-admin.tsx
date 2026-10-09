import { useEffect, useState } from 'react';
import { z } from 'zod';
import SEO from '../components/SEO';
import { ShowcaseAppCard } from '../components/ShowcaseCards';
import {
  SHOWCASE_QUEUE_SCHEMA,
  submissionToShowcaseApp,
  type ShowcaseQueuedApp,
} from '../lib/showcase-submissions';

type QueueState = 'loading' | 'signed-out' | 'ready' | 'unavailable';

export default function ShowcaseAdmin() {
  const [state, setState] = useState<QueueState>('loading');
  const [queue, setQueue] = useState<ShowcaseQueuedApp[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/showcase/admin', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (response.status === 401) {
          setState('signed-out');
          return;
        }
        if (!response.ok) throw new Error('Unable to load queue');
        const data: unknown = await response.json();
        setQueue(SHOWCASE_QUEUE_SCHEMA.parse(data).submissions);
        setState('ready');
      } catch {
        if (!controller.signal.aborted) setState('unavailable');
      }
    }
    void load();
    return () => controller.abort();
  }, [reload]);

  async function review(id: string, decision: 'approved' | 'rejected') {
    setBusy(id);
    setMessage('');
    try {
      const response = await fetch('/api/showcase/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Showcase-Request': '1',
        },
        body: JSON.stringify({ id, decision }),
      });
      if (response.status === 401) {
        setState('signed-out');
        return;
      }
      if (response.status === 409) {
        setMessage(
          'This app was already reviewed. The queue has been refreshed.'
        );
        setReload((value) => value + 1);
        return;
      }
      if (response.status === 422) {
        const data: unknown = await response.json();
        setMessage(z.object({ error: z.string() }).parse(data).error);
        return;
      }
      if (!response.ok) throw new Error('Review failed');
      setQueue((apps) => apps.filter((app) => app.id !== id));
      setReload((value) => value + 1);
      setMessage(
        decision === 'approved'
          ? 'App approved. It will appear in the showcase shortly.'
          : 'App rejected. It remains unpublished.'
      );
    } catch {
      setMessage('The review could not be saved. Try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="home">
      <SEO title="Review showcase submissions" path="/showcase/admin" noIndex />
      <section className="home-section">
        <div className="section-container showcase-admin">
          <h1>Review showcase submissions</h1>
          <p>Private queue · Apps appear publicly only after approval.</p>
          {state === 'ready' ? <a href="/api/auth/signout">Sign out</a> : null}
          {state === 'loading' ? (
            <p role="status">Loading submissions…</p>
          ) : null}
          {state === 'signed-out' ? (
            <a
              className="showcase-sign-in"
              href="/api/auth/signin?callbackUrl=%2Fshowcase%2Fadmin"
            >
              Sign in with GitHub
            </a>
          ) : null}
          {state === 'unavailable' ? (
            <div role="status">
              <p>
                The review queue is unavailable. Check the showcase server
                configuration and try again.
              </p>
              <button
                type="button"
                onClick={() => setReload((value) => value + 1)}
              >
                Try again
              </button>
            </div>
          ) : null}
          <p role="status">{message}</p>
          {state === 'ready' && !queue.length ? (
            <p>No apps awaiting review.</p>
          ) : null}
          {state === 'ready'
            ? queue.map((entry) => (
                <article key={entry.id} className="showcase-review-entry">
                  <ShowcaseAppCard
                    app={submissionToShowcaseApp(entry.submission)}
                  />
                  <p>
                    Submitted{' '}
                    {new Date(entry.createdAt).toLocaleDateString('en-US')} ·{' '}
                    <a href={`mailto:${entry.submission.contactEmail}`}>
                      {entry.submission.contactEmail}
                    </a>
                  </p>
                  <div className="showcase-review-actions">
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        void review(entry.id, 'approved');
                      }}
                    >
                      Approve and publish
                    </button>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => {
                        void review(entry.id, 'rejected');
                      }}
                    >
                      Reject
                    </button>
                    {busy === entry.id ? (
                      <span role="status">Saving…</span>
                    ) : null}
                  </div>
                </article>
              ))
            : null}
        </div>
      </section>
    </div>
  );
}
