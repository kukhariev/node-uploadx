import { BaseHandler } from './base-handler';
function isFunction(x: unknown): x is Function {
  return typeof x === 'function';
}
export function Route(httpMethod: string) {
  const func: MethodDecorator = (target, key, descriptor) => {
    const fn = descriptor.value;
    if (isFunction(fn) && fn.constructor.name === 'AsyncFunction') {
      BaseHandler.handlers.set(httpMethod.toUpperCase(), fn as any);
    }
  };
  return func;
}
