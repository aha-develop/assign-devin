export interface ServerSuccess<T> {
  ok: true;
  result: T;
}

export interface ServerError {
  ok: false;
  message: string;
}

export type ServerResponse<T> = ServerSuccess<T> | ServerError;
