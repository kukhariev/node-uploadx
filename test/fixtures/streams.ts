/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { PassThrough } from 'stream';
export class FileWriteStream extends PassThrough {
  get bytesWritten(): number {
    return super.readableLength;
  }

  close(): void {
    return;
  }
}
export class RequestReadStream extends PassThrough {
  __delay = 100;
  __mockdata = '12345';
  __mockSend(data?: any): void {
    setTimeout(() => {
      this.emit('data', data ?? this.__mockdata);
      this.emit('end');
    }, this.__delay);
  }

  __mockAbort(data?: any): void {
    setTimeout(() => {
      this.emit('data', data ?? this.__mockdata);
      this.emit('aborted');
      this.emit('end');
    }, this.__delay);
  }

  __mockPipeError(destination: FileWriteStream, data?: any): void {
    const exception = new Error('Broken pipe');
    setTimeout(() => {
      this.emit('data', data ?? this.__mockdata);
      destination.emit('error', exception);
    }, this.__delay);
  }
}
