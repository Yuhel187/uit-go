import { EventEmitter } from 'events';


export const appEmitter = new EventEmitter();

export const EmitterEvents = {
  NOTIFY_DRIVER: 'notify:driver',
  NOTIFY_PASSENGER: 'notify:passenger',
};