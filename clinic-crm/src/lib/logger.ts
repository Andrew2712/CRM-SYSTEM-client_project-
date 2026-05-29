type LogLevel = "info" | "warn" | "error" | "debug";

function log(level: LogLevel, message: string, meta?: object) {
  const entry = JSON.stringify({ level, message, ...meta });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else if (level === "debug") {
    if (process.env.NODE_ENV !== "production") console.debug(entry);
  } else console.log(entry);
}

const logger = {
  info: (message: string, meta?: object) => log("info", message, meta),
  warn: (message: string, meta?: object) => log("warn", message, meta),
  error: (message: string, meta?: object) => log("error", message, meta),
  debug: (message: string, meta?: object) => log("debug", message, meta),
};

export default logger;