import type { AuthResponse, PresenceMemberData } from './types';

/**
 * Authentication utilities for Pusher channels
 */
export class PusherAuth {
  constructor(
    private readonly key: string,
    private readonly secret: string
  ) {}

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
   * Compute HMAC-SHA256 signature
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