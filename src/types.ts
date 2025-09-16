/**
 * Configuration options for Pusher client
 */
export interface PusherConfig {
  /** Pusher application ID */
  appId: string;
  /** Pusher application key */
  key: string;
  /** Pusher application secret */
  secret: string;
  /** Pusher cluster (default: 'mt1') */
  cluster?: string;
  /** Use TLS/HTTPS (default: true) */
  useTLS?: boolean;
}

/**
 * Options for triggering events
 */
export interface TriggerOptions {
  /** Channel or array of channels to send to */
  channels: string | string[];
  /** Event name */
  event: string;
  /** Event data payload */
  data: any;
  /** Optional socket ID to exclude from receiving event */
  socketId?: string;
}

/**
 * Batch trigger options for multiple events
 */
export interface BatchTriggerEvent {
  /** Channel name */
  channel: string;
  /** Event name */
  name: string;
  /** Event data */
  data: any;
  /** Optional socket ID to exclude */
  socketId?: string;
}

/**
 * Response from trigger API
 */
export interface TriggerResponse {
  /** Whether the trigger was successful */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** HTTP status code */
  status?: number;
}

/**
 * Authentication response for private/presence channels
 */
export interface AuthResponse {
  /** Authentication signature */
  auth: string;
  /** Optional channel data for presence channels */
  channel_data?: string;
  /** Optional shared secret for encrypted channels */
  shared_secret?: string;
}

/**
 * Presence channel member data
 */
export interface PresenceMemberData {
  /** User ID (required) */
  user_id: string;
  /** Optional user info */
  user_info?: Record<string, any>;
}

/**
 * Channel info request options
 */
export interface ChannelInfoOptions {
  /** Include subscription count */
  info?: string[];
}

/**
 * Channel information response
 */
export interface ChannelInfo {
  /** Channel name */
  channel: string;
  /** Whether channel is occupied */
  occupied?: boolean;
  /** Number of subscribers */
  subscription_count?: number;
  /** User count for presence channels */
  user_count?: number;
}

/**
 * Error thrown by Pusher operations
 */
export class PusherError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'PusherError';
  }
}