import { Inject, OnModuleDestroy } from '@nestjs/common';
import { WebSocketGateway, OnGatewayInit } from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { Actor } from '../../../../../packages/shared/src/contracts';
import type {
  RestaurantEvents,
  OrderNotification,
} from '../../../../../packages/shared/src/realtime';
import { RestaurantSessionAuthenticator } from '../../common/auth';
import {
  RealtimeEventPublisher,
  CommittedOrderChange,
} from '../../common/application/realtime';
const origin = () => process.env.WEB_ORIGIN || 'http://localhost:3000';
const allowed = (headers: Record<string, string | string[] | undefined>) =>
  headers.origin
    ? headers.origin === origin()
    : headers['sec-fetch-site'] === 'same-origin' &&
      headers.host === new URL(origin()).host;
export const rooms = {
  hall: (a: Actor) => `tenant:${a.tenantId}:branch:${a.branchId}:hall`,
  kitchen: (a: Actor) => `tenant:${a.tenantId}:branch:${a.branchId}:kitchen`,
};
type ListenerMap = {
  [K in keyof RestaurantEvents]: (event: RestaurantEvents[K]) => void;
};
type Client = Socket<
  Record<string, never>,
  ListenerMap,
  Record<string, never>,
  { actor: Actor; token: string }
>;
@WebSocketGateway({
  path: '/socket.io',
  maxHttpBufferSize: 4096,
  cors: {
    origin: (
      value: string | undefined,
      callback: (err: Error | null, allowed?: boolean) => void,
    ) => callback(null, value === origin()),
    credentials: true,
  },
  allowRequest: (
    req: { headers: Record<string, string | string[] | undefined> },
    callback: (err: string | null, allowed: boolean) => void,
  ) => callback(null, allowed(req.headers)),
})
export class RestaurantEventsGateway
  extends RealtimeEventPublisher
  implements OnGatewayInit, OnModuleDestroy
{
  private server?: Server<
    Record<string, never>,
    ListenerMap,
    Record<string, never>,
    { actor: Actor; token: string }
  >;
  private timer?: ReturnType<typeof setInterval>;
  private sweeping = false;
  constructor(
    @Inject(RestaurantSessionAuthenticator)
    private readonly auth: RestaurantSessionAuthenticator,
  ) {
    super();
  }
  afterInit(
    server: Server<
      Record<string, never>,
      ListenerMap,
      Record<string, never>,
      { actor: Actor; token: string }
    >,
  ) {
    this.server = server;
    // Check subsequent polling requests and upgrade requests too, not only admission.
    server.engine.use(
      (
        req: IncomingMessage,
        _res: ServerResponse,
        next: (err?: Error) => void,
      ) =>
        next(allowed(req.headers) ? undefined : new Error('ORIGIN_REJECTED')),
    );
    server.use((socket, next) => {
      void (async () => {
        if (server.sockets.sockets.size >= 500)
          throw new Error('CONNECTION_LIMIT');
        const cookie = socket.handshake.headers.cookie || '';
        const token = decodeURIComponent(
          cookie
            .split(';')
            .map((x) => x.trim())
            .find((x) => x.startsWith('session='))
            ?.slice(8) || '',
        );
        const actor = await this.auth.authenticate(token);
        const peers = [...server.sockets.sockets.values()].filter(
          (s) => s.data.actor?.sessionId === actor.sessionId,
        );
        if (peers.length >= 4) throw new Error('CONNECTION_LIMIT');
        socket.data = { actor, token };
        next();
      })().catch(() => next(new Error('AUTH_REQUIRED')));
    });
    server.on('connection', (socket) => {
      const a = socket.data.actor;
      if (a.role === 'MANAGER' || a.role === 'WAITER')
        void socket.join(rooms.hall(a));
      if (a.role === 'MANAGER' || a.role === 'KITCHEN')
        void socket.join(rooms.kitchen(a));
      // Notifications only: there is no client room-join or mutation protocol.
      socket.onAny(() => socket.disconnect(true));
    });
    this.timer = setInterval(() => {
      if (!this.sweeping) {
        this.sweeping = true;
        void this.visit([...server.sockets.sockets.values()], async (s) => {
          await this.current(s);
        }).finally(() => {
          this.sweeping = false;
        });
      }
    }, 5000);
    this.timer.unref();
  }
  private async visit(
    sockets: Client[],
    work: (socket: Client) => Promise<void>,
  ) {
    for (let i = 0; i < sockets.length; i += 16)
      await Promise.all(sockets.slice(i, i + 16).map(work));
  }
  private async current(socket: Client) {
    try {
      const now = await this.auth.authenticate(socket.data.token),
        old = socket.data.actor;
      if (
        now.tenantId !== old.tenantId ||
        now.branchId !== old.branchId ||
        now.role !== old.role ||
        !socket.connected
      )
        throw new Error('AUTH_CHANGED');
      return now;
    } catch {
      socket.disconnect(true);
      return null;
    }
  }
  async publishOrderChanged(change: CommittedOrderChange) {
    const server = this.server;
    if (!server) return;
    const a = { tenantId: change.tenantId, branchId: change.branchId } as Actor;
    const ids = new Set([
      ...(server.sockets.adapter.rooms.get(rooms.hall(a)) || []),
      ...(server.sockets.adapter.rooms.get(rooms.kitchen(a)) || []),
    ]);
    const candidates = [...ids]
      .map((id) => server.sockets.sockets.get(id))
      .filter((s): s is Client => Boolean(s));
    const payload: OrderNotification = {
      eventId: randomUUID(),
      orderId: change.orderId,
      tableId: change.tableId,
      version: change.version,
    };
    await this.visit(candidates, async (socket) => {
      const actor = await this.current(socket);
      if (
        !actor ||
        actor.tenantId !== change.tenantId ||
        actor.branchId !== change.branchId
      )
        return;
      socket.emit(change.created ? 'order:created' : 'order:updated', payload);
      if (actor.role !== 'KITCHEN') socket.emit('table:updated', payload);
      if (change.item)
        socket.emit('kitchen:item-updated', {
          ...payload,
          itemId: change.item.id,
          itemVersion: change.item.version,
          status: change.item.status,
        });
    });
  }
  disconnectSession(sessionId: string) {
    for (const socket of this.server?.sockets.sockets.values() || [])
      if (socket.data.actor?.sessionId === sessionId) socket.disconnect(true);
  }
  onModuleDestroy() {
    clearInterval(this.timer);
    this.server?.disconnectSockets(true);
  }
}
