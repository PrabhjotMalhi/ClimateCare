import webpush from "web-push";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

interface PushSubscription {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class WebPushService {
  private vapidKeys: VapidKeys;
  private subscriptions: Map<string, PushSubscription> = new Map();
  private keysPath: string;
  private subscriptionsPath: string;

  constructor() {
    this.keysPath = join(process.cwd(), 'server', 'data', 'vapid-keys.json');
    this.subscriptionsPath = join(process.cwd(), 'server', 'data', 'push-subscriptions.json');
    
    this.vapidKeys = this.loadOrGenerateVapidKeys();
    this.loadSubscriptions();
    
    webpush.setVapidDetails(
      'mailto:admin@climatecare.ai',
      this.vapidKeys.publicKey,
      this.vapidKeys.privateKey
    );
  }

  private loadOrGenerateVapidKeys(): VapidKeys {
    try {
      if (existsSync(this.keysPath)) {
        const data = readFileSync(this.keysPath, 'utf-8');
        const keys = JSON.parse(data);
        console.log('[WebPush] Loaded existing VAPID keys');
        return keys;
      }
    } catch (error) {
      console.error('[WebPush] Error loading VAPID keys:', error);
    }

    console.log('[WebPush] Generating new VAPID keys...');
    const keys = webpush.generateVAPIDKeys();
    const vapidKeys: VapidKeys = {
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
    };

    try {
      writeFileSync(this.keysPath, JSON.stringify(vapidKeys, null, 2));
      console.log('[WebPush] VAPID keys saved to disk');
    } catch (error) {
      console.error('[WebPush] Error saving VAPID keys:', error);
    }

    return vapidKeys;
  }

  private loadSubscriptions(): void {
    try {
      if (existsSync(this.subscriptionsPath)) {
        const data = readFileSync(this.subscriptionsPath, 'utf-8');
        const subscriptions: PushSubscription[] = JSON.parse(data);
        subscriptions.forEach(sub => {
          this.subscriptions.set(sub.endpoint, sub);
        });
        console.log(`[WebPush] Loaded ${subscriptions.length} push subscriptions`);
      }
    } catch (error) {
      console.error('[WebPush] Error loading subscriptions:', error);
    }
  }

  private saveSubscriptions(): void {
    try {
      const subscriptions = Array.from(this.subscriptions.values());
      writeFileSync(this.subscriptionsPath, JSON.stringify(subscriptions, null, 2));
    } catch (error) {
      console.error('[WebPush] Error saving subscriptions:', error);
    }
  }

  getPublicKey(): string {
    return this.vapidKeys.publicKey;
  }

  addSubscription(subscription: PushSubscription): void {
    this.subscriptions.set(subscription.endpoint, subscription);
    this.saveSubscriptions();
    console.log(`[WebPush] Added subscription: ${subscription.endpoint.substring(0, 50)}...`);
  }

  removeSubscription(endpoint: string): void {
    this.subscriptions.delete(endpoint);
    this.saveSubscriptions();
    console.log(`[WebPush] Removed subscription: ${endpoint.substring(0, 50)}...`);
  }

  async sendNotification(title: string, body: string, data?: any): Promise<number> {
    const payload = JSON.stringify({
      title,
      body,
      data,
      icon: '/favicon.png',
    });

    let successCount = 0;
    const promises: Promise<void>[] = [];

    for (const [endpoint, subscription] of Array.from(this.subscriptions.entries())) {
      const promise = webpush
        .sendNotification(subscription, payload)
        .then(() => {
          successCount++;
        })
        .catch((error: any) => {
          console.error(`[WebPush] Error sending to ${endpoint.substring(0, 50)}...:`, error);
          if (error.statusCode === 410) {
            console.log(`[WebPush] Removing expired subscription: ${endpoint.substring(0, 50)}...`);
            this.subscriptions.delete(endpoint);
          }
        });

      promises.push(promise);
    }

    await Promise.all(promises);
    
    if (this.subscriptions.size !== Array.from(this.subscriptions.values()).length) {
      this.saveSubscriptions();
    }

    console.log(`[WebPush] Sent ${successCount}/${this.subscriptions.size} notifications`);
    return successCount;
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}

export const webPushService = new WebPushService();
