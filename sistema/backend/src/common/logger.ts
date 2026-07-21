import { createLogger, format, transports, Logger } from 'winston'

const { combine, timestamp, json, errors, colorize, simple } = format

const isDev = process.env.NODE_ENV !== 'production'

export const winstonLogger: Logger = createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }),
    json(),
  ),
  defaultMeta: {
    service: 'antenor-api',
    version: process.env.npm_package_version || '1.17.0-alpha',
    env: process.env.NODE_ENV || 'development',
  },
  transports: [
    new transports.Console({
      format: isDev
        ? combine(colorize(), simple())
        : combine(timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), json()),
    }),
  ],
})
