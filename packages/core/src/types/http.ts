import type * as http from 'http';

export type IncomingMessage = http.IncomingMessage & {
  originalUrl?: string;
};

export type ServerResponse = http.ServerResponse;

export interface IncomingMessageWithBody<T = any> extends http.IncomingMessage {
  body?: T;
  _body?: boolean;
}

export type Headers = Record<string, number | string | string[]>;

export type ResponseBody = string | Record<string, any>;
export type ResponseBodyType = 'text' | 'json';

export type ResponseTuple<T = ResponseBody> = [statusCode: number, body?: T, headers?: Headers];

export interface UploadxResponse<T = ResponseBody> extends Record<string, any> {
  statusCode?: number;
  headers?: Headers;
  body?: T;
}
