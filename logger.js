import winston from 'winston';
const _logger = winston.createLogger({
    level: 'debug',
});

if (process.env.NODE_ENV !== 'production') {
    _logger.add(new winston.transports.Console({
        format: winston.format.simple(),
    }));
} else {
    _logger.add(new winston.transports.Console({
        level: 'info',
    }));
}

/**
 * Log an error message
 * @param {string} msg Message to log
 */
export function error(msg) {
    _logger.error(msg);
}

/**
 * Log a warning message
 * @param {string} msg Message to log
 */
export function warn(msg) {
    _logger.warn(msg);
}

/**
 * Log an info message
 * @param {string} msg Message to log
 */
export function info(msg) {
    _logger.info(msg);
}

/**
 * Log a verbose message
 * @param {string} msg Message to log
 */
export function verbose(msg) {
    _logger.verbose(msg);
}

/**
 * Log a debug message
 * @param {string} msg Message to log
 */
export function debug(msg) {
    _logger.debug(msg);
}

export default {
    error,
    warn,
    info,
    verbose,
    debug
}