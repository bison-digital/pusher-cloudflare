import type {
  PusherConfig,
  TriggerOptions,
  TriggerResponse,
  AuthResponse,
  PresenceMemberData,
  BatchTriggerEvent,
  ChannelInfo,
  ChannelInfoOptions,
  PusherError
} from './types';

/**
 * Pusher client for Cloudflare Workers
 *
 * A lightweight Pusher implementation that works with Cloudflare Workers'
 * Web Crypto API instead of Node.js crypto module.
 */
export class Pusher {
  private readonly appId: string;
  private readonly key: string;
  private readonly secret: string;
  private readonly cluster: string;
  private readonly useTLS: boolean;
  private readonly baseUrl: string;

  constructor(config: PusherConfig) {
    if (!config.appId || !config.key || !config.secret) {
      throw new Error('Pusher config requires appId, key, and secret');
    }

    this.appId = config.appId;
    this.key = config.key;
    this.secret = config.secret;
    this.cluster = config.cluster || 'mt1';
    this.useTLS = config.useTLS !== false;

    const protocol = this.useTLS ? 'https' : 'http';
    this.baseUrl = `${protocol}://api-${this.cluster}.pusher.com`;
  }

  /**
   * Trigger an event on one or more channels
   */
  async trigger(
    channels: string | string[],
    event: string,
    data: any,
    socketId?: string
  ): Promise<TriggerResponse>;
  async trigger(options: TriggerOptions): Promise<TriggerResponse>;
  async trigger(
    channelsOrOptions: string | string[] | TriggerOptions,
    event?: string,
    data?: any,
    socketId?: string
  ): Promise<TriggerResponse> {
    let channels: string[];
    let eventName: string;
    let eventData: any;
    let excludeSocketId: string | undefined;

    if (typeof channelsOrOptions === 'object' && 'channels' in channelsOrOptions) {
      // Options object provided
      const options = channelsOrOptions;
      channels = Array.isArray(options.channels) ? options.channels : [options.channels];
      eventName = options.event;
      eventData = options.data;
      excludeSocketId = options.socketId;
    } else {
      // Individual parameters provided
      channels = Array.isArray(channelsOrOptions) ? channelsOrOptions : [channelsOrOptions];
      eventName = event!;
      eventData = data;
      excludeSocketId = socketId;
    }

    const timestamp = Math.floor(Date.now() / 1000);

    const payload: any = {
      name: eventName,
      data: typeof eventData === 'string' ? eventData : JSON.stringify(eventData),
      channels
    };

    if (excludeSocketId) {
      payload.socket_id = excludeSocketId;
    }

    const body = JSON.stringify(payload);

    try {
      const md5 = await this.computeMD5(body);
      const signature = await this.createSignature('POST', '/apps/' + this.appId + '/events', timestamp, body, md5);

      const query = new URLSearchParams({
        auth_key: this.key,
        auth_timestamp: timestamp.toString(),
        auth_version: '1.0',
        body_md5: md5,
        auth_signature: signature
      });

      const url = `${this.baseUrl}/apps/${this.appId}/events?${query}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: errorText || `HTTP ${response.status}`,
          status: response.status
        };
      }

      await response.text();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Trigger multiple events in a single API call
   */
  async triggerBatch(events: BatchTriggerEvent[]): Promise<TriggerResponse> {
    const timestamp = Math.floor(Date.now() / 1000);

    const batch = events.map(event => ({
      channel: event.channel,
      name: event.name,
      data: typeof event.data === 'string' ? event.data : JSON.stringify(event.data),
      ...(event.socketId && { socket_id: event.socketId })
    }));

    const payload = { batch };
    const body = JSON.stringify(payload);

    try {
      const md5 = await this.computeMD5(body);
      const signature = await this.createSignature('POST', '/apps/' + this.appId + '/batch_events', timestamp, body, md5);

      const query = new URLSearchParams({
        auth_key: this.key,
        auth_timestamp: timestamp.toString(),
        auth_version: '1.0',
        body_md5: md5,
        auth_signature: signature
      });

      const url = `${this.baseUrl}/apps/${this.appId}/batch_events?${query}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: errorText || `HTTP ${response.status}`,
          status: response.status
        };
      }

      await response.text();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate auth signature for private channel subscription
   */
  async authorizeChannel(socketId: string, channel: string): Promise<AuthResponse> {
    if (!socketId || !channel) {
      throw new Error('Socket ID and channel are required for authorization');
    }

    const stringToSign = `${socketId}:${channel}`;
    const signature = await this.computeHMAC(stringToSign);
    const auth = `${this.key}:${signature}`;

    return { auth };
  }

  /**
   * Generate auth signature for presence channel subscription
   */
  async authenticatePresenceChannel(
    socketId: string,
    channel: string,
    presenceData: PresenceMemberData
  ): Promise<AuthResponse> {
    if (!socketId || !channel || !presenceData) {
      throw new Error('Socket ID, channel, and presence data are required');
    }

    if (!presenceData.user_id) {
      throw new Error('user_id is required in presence data');
    }

    const channelData = JSON.stringify(presenceData);
    const stringToSign = `${socketId}:${channel}:${channelData}`;
    const signature = await this.computeHMAC(stringToSign);
    const auth = `${this.key}:${signature}`;

    return {
      auth,
      channel_data: channelData
    };
  }

  /**
   * Get information about a channel
   */
  async getChannel(channel: string, options?: ChannelInfoOptions): Promise<ChannelInfo> {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = `/apps/${this.appId}/channels/${channel}`;

    const query = new URLSearchParams({
      auth_key: this.key,
      auth_timestamp: timestamp.toString(),
      auth_version: '1.0',
      ...(options?.info && { info: options.info.join(',') })
    });

    const signature = await this.createSignature('GET', path, timestamp);
    query.set('auth_signature', signature);

    const url = `${this.baseUrl}${path}?${query}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get channel info: ${error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get list of all channels
   */
  async getChannels(prefix?: string, options?: ChannelInfoOptions): Promise<{ channels: Record<string, ChannelInfo> }> {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = `/apps/${this.appId}/channels`;

    const query = new URLSearchParams({
      auth_key: this.key,
      auth_timestamp: timestamp.toString(),
      auth_version: '1.0',
      ...(prefix && { filter_by_prefix: prefix }),
      ...(options?.info && { info: options.info.join(',') })
    });

    const signature = await this.createSignature('GET', path, timestamp);
    query.set('auth_signature', signature);

    const url = `${this.baseUrl}${path}?${query}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get channels: ${error || response.statusText}`);
    }

    return response.json();
  }

  /**
   * Compute MD5 hash of a string
   */
  private async computeMD5(str: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);

    // Note: MD5 is not available in Web Crypto API by default
    // For Cloudflare Workers, we'll use a workaround or fallback
    try {
      const hashBuffer = await crypto.subtle.digest('MD5', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      // Fallback: Return empty MD5 for environments without MD5 support
      // Pusher API may accept requests without body_md5 in some cases
      console.warn('MD5 not available, using empty hash');
      return '';
    }
  }

  /**
   * Create HMAC-SHA256 signature
   */
  private async createSignature(
    method: string,
    path: string,
    timestamp: number,
    body?: string,
    md5?: string
  ): Promise<string> {
    const queryParams = [
      `auth_key=${this.key}`,
      `auth_timestamp=${timestamp}`,
      `auth_version=1.0`,
      ...(md5 ? [`body_md5=${md5}`] : [])
    ].join('&');

    const stringToSign = `${method}\n${path}\n${queryParams}`;

    const encoder = new TextEncoder();
    const encodedData = encoder.encode(stringToSign);
    const encodedSecret = encoder.encode(this.secret);

    const key = await crypto.subtle.importKey(
      'raw',
      encodedSecret,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encodedData);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Compute HMAC-SHA256 signature for auth
   */
  private async computeHMAC(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    const encodedSecret = encoder.encode(this.secret);

    const key = await crypto.subtle.importKey(
      'raw',
      encodedSecret,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encodedData);
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    return signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}