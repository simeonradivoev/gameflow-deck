import { SettingsType } from '@/shared/constants';
import Conf from 'conf';
import { AppEventMap } from '../../src/bun/types/types';
import EventEmitter from "node:events";
import { TaskQueue } from '@/bun/api/task-queue';

export * from '../../src/bun/types/types.schema';
export * from '../../src/bun/types/types';
export * from '../../src/bun/api/hooks/app';
export * from '../../src/shared/constants';
export * from '../../src/shared/types';
export * from '../../src/shared/utils';

export declare const config: Conf<SettingsType>;
export declare let events: EventEmitter<AppEventMap>;
export declare let taskQueue: TaskQueue;

export { };