import { Inject, OnModuleDestroy } from '@nestjs/common';
import { WebSocketGateway, OnGatewayInit } from '@nestjs/websockets';
import type { NotificationEvents } from '../../../../../packages/shared/src/notifications';
import type { NotificationPrincipal } from '../../../../../packages/notifications/src/domain';
import { notificationWhere } from '../../../../../packages/notifications/src/persistence';
import { prisma } from '../../../../../packages/database/src/client';
import { PlatformSessionAuthenticator } from '../../common/platform-auth';
import type { PlatformPrincipal } from '../../../../../packages/shared/src/contracts';
import type { Server, Socket, Namespace } from 'socket.io';
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
const platformOrigin = () =>
  process.env.PLATFORM_ORIGIN || 'http://localhost:3001';
const matches = (
  headers: Record<string, string | string[] | undefined>,
  expected: string,
) =>
  headers.origin
    ? headers.origin === expected
    : headers['sec-fetch-site'] === 'same-origin' &&
      headers.host === new URL(expected).host;
const allowed = (headers: Record<string, string | string[] | undefined>) =>
  matches(headers, origin()) || matches(headers, platformOrigin());
const platformEnabled = () =>
  process.env.PLATFORM_ADMIN_ENABLED !== 'false' &&
  (process.env.NODE_ENV !== 'production' ||
    process.env.PLATFORM_ADMIN_ENABLED === 'true');
const cookieToken = (cookie: string | undefined, name: string) =>
  decodeURIComponent(
    (cookie || '')
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith(name + '='))
      ?.slice(name.length + 1) || '',
  );
export const rooms = {
  hall: (a: Actor) => `tenant:${a.tenantId}:branch:${a.branchId}:hall`,
  kitchen: (a: Actor) => `tenant:${a.tenantId}:branch:${a.branchId}:kitchen`,
};
type ListenerMap = {
  [K in keyof (RestaurantEvents & NotificationEvents)]: (
    event: (RestaurantEvents & NotificationEvents)[K],
  ) => void;
};
type Client = Socket<
  Record<string, never>,
  ListenerMap,
  Record<string, never>,
  { actor: Actor; token: string; restricted?: boolean }
>;
type PlatformClient = Socket<
  Record<string, never>,
  ListenerMap,
  Record<string, never>,
  { platform: PlatformPrincipal; token: string }
>;
@WebSocketGateway({
  path: '/socket.io',
  maxHttpBufferSize: 4096,
  cors: {
    origin: (
      value: string | undefined,
      callback: (err: Error | null, allowed?: boolean) => void,
    ) => callback(null, value === origin() || value === platformOrigin()),
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
    { actor: Actor; token: string; restricted?: boolean }
  >;
  private platform?: Namespace<
    Record<string, never>,
    ListenerMap,
    Record<string, never>,
    { platform: PlatformPrincipal; token: string }
  >;
  private timer?: ReturnType<typeof setInterval>;
  private sweeping = false;
  constructor(
    @Inject(RestaurantSessionAuthenticator)
    private readonly auth: RestaurantSessionAuthenticator,
    @Inject(PlatformSessionAuthenticator)
    private readonly platformAuth: PlatformSessionAuthenticator,
  ) {
    super();
  }
  afterInit(
    server: Server<
      Record<string, never>,
      ListenerMap,
      Record<string, never>,
      { actor: Actor; token: string; restricted?: boolean }
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
        if (!matches(socket.handshake.headers, origin()))
          throw new Error('ORIGIN_REJECTED');
        const cookie = socket.handshake.headers.cookie || '';
        const token = decodeURIComponent(
          cookie
            .split(';')
            .map((x) => x.trim())
            .find((x) => x.startsWith('session='))
            ?.slice(8) || '',
        );
        const actor = await this.auth
          .authenticate(token)
          .catch(() => this.auth.authenticate(token, { allowSuspended: true }));
        const peers = [...server.sockets.sockets.values()].filter(
          (s) => s.data.actor?.sessionId === actor.sessionId,
        );
        if (peers.length >= 4) throw new Error('CONNECTION_LIMIT');
        socket.data = {
          actor,
          token,
          restricted: actor.tenantStatus === 'SUSPENDED',
        };
        next();
      })().catch(() => next(new Error('AUTH_REQUIRED')));
    });
    const platform = server.of(
      '/platform-notifications',
    ) as unknown as Namespace<
      Record<string, never>,
      ListenerMap,
      Record<string, never>,
      { platform: PlatformPrincipal; token: string }
    >;
    this.platform = platform;
    platform.use((socket, next) => {
      void (async () => {
        if (
          !platformEnabled() ||
          !matches(socket.handshake.headers, platformOrigin()) ||
          this.platform!.sockets.size >= 100
        )
          throw new Error('PLATFORM_AUTH_REQUIRED');
        const token = cookieToken(
          socket.handshake.headers.cookie,
          'platform_session',
        );
        const principal = await this.platformAuth.authenticate(token);
        if (
          [...this.platform!.sockets.values()].filter(
            (s) => s.data.platform.sessionId === principal.sessionId,
          ).length >= 4
        )
          throw new Error('CONNECTION_LIMIT');
        socket.data = { platform: principal, token };
        next();
      })().catch(() => next(new Error('PLATFORM_AUTH_REQUIRED')));
    });
    platform.on('connection', (socket) =>
      socket.onAny(() => socket.disconnect(true)),
    );
    server.on('connection', (socket) => {
      const a = socket.data.actor;
      if (
        !socket.data.restricted &&
        (a.role === 'MANAGER' || a.role === 'WAITER')
      )
        void socket.join(rooms.hall(a));
      if (
        !socket.data.restricted &&
        (a.role === 'MANAGER' || a.role === 'KITCHEN')
      )
        void socket.join(rooms.kitchen(a));
      // Notifications only: there is no client room-join or mutation protocol.
      socket.onAny(() => socket.disconnect(true));
    });
    this.timer = setInterval(() => {
      if (!this.sweeping) {
        this.sweeping = true;
        void this.visit([...server.sockets.sockets.values()], async (s) => {
          await this.current(s, Boolean(s.data.restricted));
        })
          .then(() => this.sweepPlatform())
          .finally(() => {
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
  private async current(socket: Client, allowSuspended = false) {
    try {
      const now = await this.auth.authenticate(socket.data.token, {
          allowSuspended,
        }),
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
  private async currentPlatform(socket: PlatformClient) {
    try {
      if (!platformEnabled()) throw new Error('DISABLED');
      const p = await this.platformAuth.authenticate(socket.data.token);
      if (!socket.connected) throw new Error('CLOSED');
      return p;
    } catch {
      socket.disconnect(true);
      return null;
    }
  }
  private async sweepPlatform() {
    const clients = [...(this.platform?.sockets.values() || [])];
    for (let i = 0; i < clients.length; i += 16)
      await Promise.all(
        clients.slice(i, i + 16).map((s) => this.currentPlatform(s)),
      );
  }
  private actorPrincipal(a: Actor): NotificationPrincipal {
    return {
      realm: 'RESTAURANT',
      userId: a.userId,
      sessionId: a.sessionId!,
      membershipId: a.membershipId!,
      tenantId: a.tenantId,
      branchId: a.branchId,
      role: a.role,
      tenantStatus: a.tenantStatus,
    };
  }
  async publishNotification(id: string, kind: 'created' | 'updated') {
    const notification = await prisma.notification.findFirst({
      where: { id, expiresAt: { gt: new Date() } },
    });
    if (!notification) return;
    const emit = async (
      socket: Client | PlatformClient,
      p: NotificationPrincipal,
    ) => {
      if (
        !(await prisma.notification.findFirst({
          where: { ...notificationWhere(p), id },
          select: { id: true },
        }))
      )
        return;
      if (kind === 'created')
        socket.emit('notification:created', {
          notificationId: id,
          type: notification.type,
          priority: notification.priority,
          createdAt: notification.createdAt.toISOString(),
          version: notification.version,
        });
      else
        socket.emit('notification:updated', {
          notificationId: id,
          readAt: notification.readAt?.toISOString() || null,
          acknowledgedAt: notification.acknowledgedAt?.toISOString() || null,
          version: notification.version,
        });
      socket.emit('notification:unread-count', {
        count: await prisma.notification.count({
          where: { ...notificationWhere(p), readAt: null },
        }),
      });
    };
    if (notification.realm === 'RESTAURANT') {
      const clients = [...(this.server?.sockets.sockets.values() || [])].filter(
        (s) =>
          s.data.actor.userId === notification.recipientId &&
          s.data.actor.tenantId === notification.tenantId,
      );
      await this.visit(clients, async (s) => {
        const a = await this.current(
          s,
          notification.type === 'TENANT_SUSPENDED',
        );
        if (a) await emit(s, this.actorPrincipal(a));
      });
    } else
      for (const s of this.platform?.sockets.values() || []) {
        if (s.data.platform.userId !== notification.recipientId) continue;
        const a = await this.currentPlatform(s);
        if (a)
          await emit(s, {
            realm: 'PLATFORM',
            userId: a.userId,
            platformAdminId: a.adminId,
            sessionId: a.sessionId,
          });
      }
  }
  async publishInboxChanged(p: NotificationPrincipal) {
    if (p.realm === 'RESTAURANT')
      await this.visit(
        [...(this.server?.sockets.sockets.values() || [])].filter(
          (s) =>
            s.data.actor.userId === p.userId &&
            s.data.actor.tenantId === p.tenantId,
        ),
        async (s) => {
          const a = await this.current(s, true);
          if (a)
            s.emit('notification:unread-count', {
              count: await prisma.notification.count({
                where: {
                  ...notificationWhere(this.actorPrincipal(a)),
                  readAt: null,
                },
              }),
            });
        },
      );
    else
      for (const s of this.platform?.sockets.values() || []) {
        if (s.data.platform.userId !== p.userId) continue;
        const a = await this.currentPlatform(s);
        if (a)
          s.emit('notification:unread-count', {
            count: await prisma.notification.count({
              where: {
                ...notificationWhere({
                  realm: 'PLATFORM',
                  userId: a.userId,
                  sessionId: a.sessionId,
                  platformAdminId: a.adminId,
                }),
                readAt: null,
              },
            }),
          });
      }
  }
  disconnectSession(sessionId: string) {
    for (const socket of this.server?.sockets.sockets.values() || [])
      if (socket.data.actor?.sessionId === sessionId) socket.disconnect(true);
    for (const socket of this.platform?.sockets.values() || [])
      if (socket.data.platform.sessionId === sessionId) socket.disconnect(true);
  }
  onModuleDestroy() {
    clearInterval(this.timer);
    this.server?.disconnectSockets(true);
    this.platform?.disconnectSockets(true);
  }
}
