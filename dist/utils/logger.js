"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLogger = getLogger;
exports.createLogEntry = createLogEntry;
exports.logDebug = logDebug;
exports.logInfo = logInfo;
exports.logWarn = logWarn;
exports.logError = logError;
const winston = __importStar(require("winston"));
const config_1 = require("../config");
const { combine, timestamp, printf, colorize, align } = winston.format;
let loggerInstance = null;
const customFormat = printf(({ level, message, timestamp: ts, ...metadata }) => {
    let msg = `${ts} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});
function getLogger() {
    if (!loggerInstance) {
        const config = (0, config_1.getConfig)();
        const transports = [
            new winston.transports.Console({
                format: combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), align(), customFormat)
            })
        ];
        try {
            const fs = require('fs');
            const path = require('path');
            const logDir = path.join(process.cwd(), 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            transports.push(new winston.transports.File({
                filename: path.join(logDir, 'error.log'),
                level: 'error',
                format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), align(), customFormat)
            }), new winston.transports.File({
                filename: path.join(logDir, 'combined.log'),
                format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), align(), customFormat)
            }));
        }
        catch (error) {
            // Ignore file transport errors
        }
        loggerInstance = winston.createLogger({
            level: config.toolChain.logLevel,
            levels: {
                debug: 0,
                info: 1,
                warn: 2,
                error: 3
            },
            transports
        });
    }
    return loggerInstance;
}
function createLogEntry(level, source, message, data) {
    return {
        timestamp: new Date(),
        level,
        source,
        message,
        data
    };
}
function logDebug(source, message, data) {
    const logger = getLogger();
    logger.debug(`[${source}] ${message}`, { data });
}
function logInfo(source, message, data) {
    const logger = getLogger();
    logger.info(`[${source}] ${message}`, { data });
}
function logWarn(source, message, data) {
    const logger = getLogger();
    logger.warn(`[${source}] ${message}`, { data });
}
function logError(source, message, data) {
    const logger = getLogger();
    logger.error(`[${source}] ${message}`, { data });
}
//# sourceMappingURL=logger.js.map