import * as winston from 'winston';
import { LogEntry } from '../types';
export declare function getLogger(): winston.Logger;
export declare function createLogEntry(level: LogEntry['level'], source: string, message: string, data?: unknown): LogEntry;
export declare function logDebug(source: string, message: string, data?: unknown): void;
export declare function logInfo(source: string, message: string, data?: unknown): void;
export declare function logWarn(source: string, message: string, data?: unknown): void;
export declare function logError(source: string, message: string, data?: unknown): void;
//# sourceMappingURL=logger.d.ts.map