# @bison.digital/pusher-cloudflare

A lightweight Pusher SDK implementation for Cloudflare Workers that uses Web Crypto API instead of Node.js crypto module.

## Features

- ✅ Full compatibility with Cloudflare Workers
- ✅ No Node.js dependencies
- ✅ TypeScript support with full type definitions
- ✅ Private and presence channel authentication
- ✅ Batch event triggering
- ✅ Channel information queries
- ✅ Lightweight and performant

## Installation

```bash
npm install @bison.digital/pusher-cloudflare
# or
pnpm add @bison.digital/pusher-cloudflare
# or
yarn add @bison.digital/pusher-cloudflare
```

## Usage

### Basic Setup

```typescript
import { Pusher } from '@bison.digital/pusher-cloudflare';

const pusher = new Pusher({
  appId: 'your-app-id',
  key: 'your-key',
  secret: 'your-secret',
  cluster: 'eu', // optional, defaults to 'mt1'
  useTLS: true   // optional, defaults to true
});
```

### Triggering Events

```typescript
// Single channel
await pusher.trigger('my-channel', 'my-event', {
  message: 'Hello World!'
});

// Multiple channels
await pusher.trigger(['channel-1', 'channel-2'], 'my-event', {
  message: 'Hello Everyone!'
});

// With socket exclusion
await pusher.trigger('my-channel', 'my-event', {
  message: 'Hello World!'
}, 'socket-id-to-exclude');

// Using options object
await pusher.trigger({
  channels: 'my-channel',
  event: 'my-event',
  data: { message: 'Hello World!' },
  socketId: 'socket-id-to-exclude'
});
```

### Batch Triggering

```typescript
await pusher.triggerBatch([
  {
    channel: 'channel-1',
    name: 'event-1',
    data: { message: 'Hello Channel 1!' }
  },
  {
    channel: 'channel-2',
    name: 'event-2',
    data: { message: 'Hello Channel 2!' },
    socketId: 'socket-to-exclude'
  }
]);
```

### Channel Authentication

#### Private Channels

```typescript
// In your auth endpoint
const authResponse = await pusher.authorizeChannel(
  socketId,
  'private-channel-name'
);

return new Response(JSON.stringify(authResponse), {
  headers: { 'Content-Type': 'application/json' }
});
```

#### Presence Channels

```typescript
const authResponse = await pusher.authenticatePresenceChannel(
  socketId,
  'presence-channel-name',
  {
    user_id: 'user-123',
    user_info: {
      name: 'John Doe',
      email: 'john@example.com'
    }
  }
);

return new Response(JSON.stringify(authResponse), {
  headers: { 'Content-Type': 'application/json' }
});
```

### Channel Information

```typescript
// Get single channel info
const channelInfo = await pusher.getChannel('my-channel', {
  info: ['subscription_count']
});

// Get all channels with prefix
const channels = await pusher.getChannels('presence-', {
  info: ['user_count']
});
```

## Cloudflare Worker Example

```typescript
export default {
  async fetch(request: Request, env: Env) {
    const pusher = new Pusher({
      appId: env.PUSHER_APP_ID,
      key: env.PUSHER_KEY,
      secret: env.PUSHER_SECRET,
      cluster: env.PUSHER_CLUSTER
    });

    // Handle Pusher auth endpoint
    if (request.url.includes('/pusher/auth')) {
      const formData = await request.formData();
      const socketId = formData.get('socket_id') as string;
      const channel = formData.get('channel_name') as string;

      const authResponse = await pusher.authorizeChannel(socketId, channel);

      return new Response(JSON.stringify(authResponse), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Trigger an event
    await pusher.trigger('my-channel', 'my-event', {
      message: 'Hello from Cloudflare Worker!'
    });

    return new Response('Event sent!');
  }
};
```

## Migration from Standard Pusher SDK

The API is designed to be familiar to users of the standard Pusher SDK, with a few key differences:

1. **All auth methods are async**: Since we use Web Crypto API, channel authorization methods return Promises.

```typescript
// Standard SDK (sync)
const auth = pusher.authenticate(socketId, channel);

// This SDK (async)
const auth = await pusher.authorizeChannel(socketId, channel);
```

2. **No Node.js dependencies**: This SDK uses only Web APIs available in Cloudflare Workers.

3. **Explicit configuration**: Pass all configuration in a single object to the constructor.

## Error Handling

```typescript
try {
  const result = await pusher.trigger('my-channel', 'my-event', data);
  if (!result.success) {
    console.error('Trigger failed:', result.error);
  }
} catch (error) {
  console.error('Unexpected error:', error);
}
```

## TypeScript Support

This package includes full TypeScript definitions:

```typescript
import type {
  PusherConfig,
  TriggerOptions,
  AuthResponse,
  PresenceMemberData
} from '@bison.digital/pusher-cloudflare';
```

## API Reference

### `new Pusher(config: PusherConfig)`

Creates a new Pusher instance.

### `pusher.trigger(channels, event, data, socketId?): Promise<TriggerResponse>`

Triggers an event on one or more channels.

### `pusher.triggerBatch(events): Promise<TriggerResponse>`

Triggers multiple events in a single API call.

### `pusher.authorizeChannel(socketId, channel): Promise<AuthResponse>`

Generates authentication signature for private channel subscription.

### `pusher.authenticatePresenceChannel(socketId, channel, presenceData): Promise<AuthResponse>`

Generates authentication for presence channel subscription.

### `pusher.getChannel(channel, options?): Promise<ChannelInfo>`

Gets information about a specific channel.

### `pusher.getChannels(prefix?, options?): Promise<{ channels: Record<string, ChannelInfo> }>`

Gets information about multiple channels.

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/bison-digital/pusher-cloudflare/issues).