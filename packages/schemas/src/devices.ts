import { z } from "zod";

export const registerDeviceRequestSchema = z.object({
  deviceIdentifier: z.string().trim().min(16).max(128),
  hostname: z.string().trim().min(1).max(255),
  osVersion: z.string().trim().min(1).max(128),
  appVersion: z.string().trim().min(1).max(32),
  agentVersion: z.string().trim().min(1).max(32),
});

export const deviceHeartbeatRequestSchema = z.object({
  deviceId: z.string().trim().min(1).max(128),
  memoryWorkingSetBytes: z.number().int().nonnegative().optional(),
  spoolerJobCount: z.number().int().nonnegative().optional(),
  onlinePrinterCount: z.number().int().nonnegative().optional(),
});

export const deviceOfflineRequestSchema = z.object({
  deviceId: z.string().trim().min(1).max(128),
});

export type RegisterDeviceRequestInput = z.infer<typeof registerDeviceRequestSchema>;
export type DeviceHeartbeatRequestInput = z.infer<typeof deviceHeartbeatRequestSchema>;
export type DeviceOfflineRequestInput = z.infer<typeof deviceOfflineRequestSchema>;
