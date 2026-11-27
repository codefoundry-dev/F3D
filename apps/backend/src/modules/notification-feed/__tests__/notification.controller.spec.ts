import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { NotificationController } from '../notification.controller';

const user: AuthenticatedUser = {
  id: 'user-1',
  role: 'COMPANY_ADMIN',
  companyId: 'comp-1',
  email: 'u1@test.com',
} as AuthenticatedUser;

const mockService = {
  list: jest.fn(),
  unreadCount: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
};

const mockEvents = {
  subscribe: jest.fn(),
  emit: jest.fn(),
};

describe('NotificationController', () => {
  let controller: NotificationController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new NotificationController(mockService as never, mockEvents as never);
  });

  it('list delegates to the service', () => {
    mockService.list.mockReturnValue('list-result');
    const query = { page: 1, limit: 20 };
    expect(controller.list(query as never, user)).toBe('list-result');
    expect(mockService.list).toHaveBeenCalledWith(user, query);
  });

  it('unreadCount delegates to the service', () => {
    mockService.unreadCount.mockReturnValue('count-result');
    expect(controller.unreadCount(user)).toBe('count-result');
    expect(mockService.unreadCount).toHaveBeenCalledWith(user);
  });

  it('markRead delegates to the service', () => {
    mockService.markRead.mockReturnValue('read-result');
    expect(controller.markRead('n-1', user)).toBe('read-result');
    expect(mockService.markRead).toHaveBeenCalledWith(user, 'n-1');
  });

  it('markAllRead delegates to the service', () => {
    mockService.markAllRead.mockReturnValue('all-result');
    expect(controller.markAllRead(user)).toBe('all-result');
    expect(mockService.markAllRead).toHaveBeenCalledWith(user);
  });

  describe('stream (SSE)', () => {
    const makeReqRes = () => {
      const res = {
        set: jest.fn(),
        flushHeaders: jest.fn(),
        write: jest.fn(),
      };
      let closeHandler: (() => void) | undefined;
      const req = {
        on: jest.fn((event: string, cb: () => void) => {
          if (event === 'close') closeHandler = cb;
        }),
      };
      return { req, res, getCloseHandler: () => closeHandler };
    };

    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it('sets SSE headers, opens the stream and subscribes the user', () => {
      const unsubscribe = jest.fn();
      mockEvents.subscribe.mockReturnValue(unsubscribe);
      const { req, res } = makeReqRes();

      controller.stream(user, req as never, res as never);

      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({ 'Content-Type': 'text/event-stream' }),
      );
      expect(res.flushHeaders).toHaveBeenCalled();
      expect(res.write).toHaveBeenCalledWith(': connected\n\n');
      expect(mockEvents.subscribe).toHaveBeenCalledWith('user-1', expect.any(Function));
    });

    it('writes an event frame when a notification is pushed', () => {
      let pushed: ((n: unknown) => void) | undefined;
      mockEvents.subscribe.mockImplementation((_id: string, cb: (n: unknown) => void) => {
        pushed = cb;
        return jest.fn();
      });
      const { req, res } = makeReqRes();

      controller.stream(user, req as never, res as never);
      pushed?.({ event: 'notification', data: { id: 'n-9', title: 'Hi' } });

      expect(res.write).toHaveBeenCalledWith(
        `event: notification\ndata: ${JSON.stringify({ id: 'n-9', title: 'Hi' })}\n\n`,
      );
    });

    it('writes a message event frame when chat activity is pushed', () => {
      let pushed: ((frame: unknown) => void) | undefined;
      mockEvents.subscribe.mockImplementation((_id: string, cb: (frame: unknown) => void) => {
        pushed = cb;
        return jest.fn();
      });
      const { req, res } = makeReqRes();
      const activity = { threadId: 't-1', contextType: 'QUOTE_RESPONSE', contextId: 'q-1' };

      controller.stream(user, req as never, res as never);
      pushed?.({ event: 'message', data: activity });

      expect(res.write).toHaveBeenCalledWith(
        `event: message\ndata: ${JSON.stringify(activity)}\n\n`,
      );
    });

    it('emits heartbeats until the connection closes, then cleans up', () => {
      const unsubscribe = jest.fn();
      mockEvents.subscribe.mockReturnValue(unsubscribe);
      const { req, res, getCloseHandler } = makeReqRes();

      controller.stream(user, req as never, res as never);
      res.write.mockClear();

      jest.advanceTimersByTime(25_000);
      expect(res.write).toHaveBeenCalledWith(': ping\n\n');

      // Client disconnects → unsubscribe + stop heartbeats.
      const close = getCloseHandler();
      expect(close).toBeDefined();
      close?.();
      expect(unsubscribe).toHaveBeenCalled();

      res.write.mockClear();
      jest.advanceTimersByTime(60_000);
      expect(res.write).not.toHaveBeenCalled();
    });
  });
});
