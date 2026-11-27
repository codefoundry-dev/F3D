import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@forethread/api-client', () => ({
  notificationStreamUrl: () => 'http://api.test/v1/notifications/stream',
  queryKeys: { notifications: { all: () => ['notifications'] } },
}));

import { useNotificationStream } from './useNotificationStream';

/** Minimal EventSource stand-in that lets a test dispatch named events. */
class FakeEventSource {
  static instances: FakeEventSource[] = [];
  readonly listeners = new Map<string, Set<(e: Event) => void>>();
  closed = false;

  constructor(
    readonly url: string,
    readonly init?: EventSourceInit,
  ) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (e: Event) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(cb);
  }

  removeEventListener(type: string, cb: (e: Event) => void) {
    this.listeners.get(type)?.delete(cb);
  }

  close() {
    this.closed = true;
  }

  dispatch(type: string, data?: string) {
    const event = new MessageEvent(type, { data });
    this.listeners.get(type)?.forEach((cb) => cb(event));
  }
}

function setup() {
  const qc = new QueryClient();
  const invalidate = vi.spyOn(qc, 'invalidateQueries').mockResolvedValue();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useNotificationStream(true), { wrapper });
  const source = FakeEventSource.instances[FakeEventSource.instances.length - 1];
  return { invalidate, hook, source };
}

describe('useNotificationStream', () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal('EventSource', FakeEventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the stream with the session cookie', () => {
    const { source } = setup();
    expect(source.url).toBe('http://api.test/v1/notifications/stream');
    expect(source.init).toEqual({ withCredentials: true });
  });

  it('refreshes the notification feed on a notification event', () => {
    const { source, invalidate } = setup();
    source.dispatch('notification', '{}');
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications'] });
  });

  it('refetches the chat thread and its thread lookup on a message event', () => {
    const { source, invalidate } = setup();
    source.dispatch(
      'message',
      JSON.stringify({ threadId: 't-1', contextType: 'QUOTE_RESPONSE', contextId: 'q-1' }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['messages', 't-1'] });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['message-threads', 'QUOTE_RESPONSE', 'q-1'],
    });
  });

  it('ignores a malformed message event', () => {
    const { source, invalidate } = setup();
    source.dispatch('message', 'not json');
    source.dispatch('message', JSON.stringify({ contextId: 'q-1' }));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('closes the stream on unmount', () => {
    const { source, hook } = setup();
    hook.unmount();
    expect(source.closed).toBe(true);
    expect(source.listeners.get('message')?.size ?? 0).toBe(0);
  });
});
