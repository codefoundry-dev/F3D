import { NotificationEventsService } from '../notification-events.service';
import { NotificationDto } from '../notification.types';

const sample = (over: Partial<NotificationDto> = {}): NotificationDto => ({
  id: 'n-1',
  type: 'MESSAGE_RECEIVED',
  title: 'New message',
  body: 'hi',
  entityType: 'RFQ',
  entityId: 'rfq-1',
  metadata: null,
  readAt: null,
  createdAt: new Date('2026-07-24').toISOString(),
  sender: null,
  ...over,
});

describe('NotificationEventsService', () => {
  let service: NotificationEventsService;

  beforeEach(() => {
    service = new NotificationEventsService();
  });

  it('delivers an emitted notification to a subscribed user', () => {
    const listener = jest.fn();
    service.subscribe('user-1', listener);

    const n = sample();
    service.emit('user-1', n);

    expect(listener).toHaveBeenCalledWith(n);
  });

  it('does not deliver to a different user', () => {
    const listener = jest.fn();
    service.subscribe('user-1', listener);

    service.emit('user-2', sample());

    expect(listener).not.toHaveBeenCalled();
  });

  it('is a no-op when emitting to a user with no listeners', () => {
    expect(() => service.emit('nobody', sample())).not.toThrow();
  });

  it('stops delivering after unsubscribe (and cleans up the empty set)', () => {
    const listener = jest.fn();
    const unsubscribe = service.subscribe('user-1', listener);

    unsubscribe();
    service.emit('user-1', sample());

    expect(listener).not.toHaveBeenCalled();
    // A second unsubscribe is harmless.
    expect(() => unsubscribe()).not.toThrow();
  });

  it('supports multiple listeners for one user and isolates a throwing one', () => {
    const good = jest.fn();
    const bad = jest.fn(() => {
      throw new Error('boom');
    });
    service.subscribe('user-1', bad);
    service.subscribe('user-1', good);

    expect(() => service.emit('user-1', sample())).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });

  it('only removes the specific listener on unsubscribe, keeping others', () => {
    const a = jest.fn();
    const b = jest.fn();
    const unsubA = service.subscribe('user-1', a);
    service.subscribe('user-1', b);

    unsubA();
    service.emit('user-1', sample());

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
});
