import type http from 'http';

export type IncomingMessage = http.IncomingMessage & {
  originalUrl?: string;
};

export type ServerResponse = http.ServerResponse;

export interface IncomingMessageWithBody<T = unknown> extends http.IncomingMessage {
  body?: T;
  _body?: boolean;
}

export type Headers = Record<string, number | string | string[]>;

export type ResponseBodyType = 'text' | 'json';

export type ResponseTuple<T = unknown> = [statusCode: number, body?: T, headers?: Headers];

export interface UploadxResponse<T = unknown> {
  statusCode?: number;
  headers?: Headers;
  body?: T;
}
