import { appConfig } from "@/src/config/app";

export function getHealthStatus() {
  return {
    status: "ok" as const,
    service: appConfig.serviceName,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  };
}