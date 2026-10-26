import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Paged, Ticket, TicketMessage } from '../models';

/**
 * 后端 /api/support/tickets 的原始返回：
 * 列表项只有 body/author/createdAt（没有 lastMessage/updatedAt），
 * 且忽略 page/size 查询参数，永远返回全量。适配层在这里补齐字段并本地分页，
 * 保证页面拿到的数据形状稳定，后端实现变化时只需改这里。
 */
interface RawMessage {
  id?: number;
  author?: string;
  authorEmail?: string;
  role?: string;
  body?: string;
  createdAt?: string;
}

interface RawTicket {
  id?: number;
  subject?: string;
  status?: string;
  statusText?: string;
  createdAt?: string;
  updatedAt?: string;
  author?: string;
  userName?: string;
  ownerEmail?: string;
  body?: string;
  lastMessage?: string;
  messageCount?: number;
  userId?: number;
  messages?: RawMessage[];
}

interface RawList {
  items?: RawTicket[];
  total?: number;
}

/** 列表额外带回各状态的工单数量，供状态页签显示角标（服务端不提供，由本层统计）。 */
export interface TicketPage extends Paged<Ticket> {
  counts: Record<string, number>;
}

function toMessage(raw: RawMessage, index: number): TicketMessage {
  return {
    id: Number(raw.id ?? index + 1),
    author: String(raw.author ?? ''),
    authorEmail: raw.authorEmail ? String(raw.authorEmail) : undefined,
    role: String(raw.role ?? 'member'),
    body: String(raw.body ?? ''),
    createdAt: String(raw.createdAt ?? ''),
  };
}

function toTicket(raw: RawTicket): Ticket {
  const messages = Array.isArray(raw.messages) ? raw.messages.map(toMessage) : undefined;
  const last = messages && messages.length > 0 ? messages[messages.length - 1] : undefined;
  return {
    id: Number(raw.id ?? 0),
    subject: String(raw.subject ?? ''),
    status: String(raw.status ?? 'open'),
    statusText: String(raw.statusText ?? ''),
    createdAt: String(raw.createdAt ?? ''),
    updatedAt: String(raw.updatedAt ?? last?.createdAt ?? raw.createdAt ?? ''),
    userName: String(raw.userName ?? raw.author ?? '会员'),
    ownerEmail: raw.ownerEmail ? String(raw.ownerEmail) : undefined,
    lastMessage: String(raw.lastMessage ?? last?.body ?? raw.body ?? ''),
    // 列表接口不返回消息数，正文本身就是第一条消息，因此至少计 1 条。
    messageCount: Number(raw.messageCount ?? messages?.length ?? (raw.body ? 1 : 0)),
    userId: raw.userId,
    messages,
  };
}

@Injectable({ providedIn: 'root' })
export class SupportApi {
  private readonly http = inject(HttpClient);

  /** 状态筛选与分页都在客户端完成：服务端列表接口不分页，且 status 过滤由本层兜底。 */
  tickets(status = '', page = 1, size = 10): Observable<TicketPage> {
    return this.http.get<RawList>('/api/support/tickets').pipe(
      map((res) => {
        const all = (res.items ?? []).map(toTicket);
        const counts: Record<string, number> = { all: all.length };
        for (const ticket of all) {
          counts[ticket.status] = (counts[ticket.status] ?? 0) + 1;
        }
        const filtered = status ? all.filter((ticket) => ticket.status === status) : all;
        const start = Math.max(0, (page - 1) * size);
        return {
          items: filtered.slice(start, start + size),
          total: filtered.length,
          page,
          size,
          counts,
        };
      }),
    );
  }

  ticket(id: number | string): Observable<Ticket> {
    return this.http.get<RawTicket>('/api/support/tickets/' + id).pipe(map(toTicket));
  }

  create(subject: string, body: string): Observable<Ticket> {
    return this.http.post<RawTicket>('/api/support/tickets', { subject, body }).pipe(map(toTicket));
  }

  /** 回复接口返回整条工单（含全部消息），页面可直接用它刷新会话流，无需二次 GET。 */
  reply(id: number, body: string): Observable<Ticket> {
    return this.http
      .post<RawTicket>('/api/support/tickets/' + id + '/messages', { body })
      .pipe(map(toTicket));
  }

  close(id: number): Observable<Ticket> {
    return this.http.post<RawTicket>('/api/support/tickets/' + id + '/close', {}).pipe(map(toTicket));
  }
}
