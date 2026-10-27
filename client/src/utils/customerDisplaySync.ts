// Real-time synchronization utility for Customer-Facing Second Screen (Dual Display)
// Uses BroadcastChannel with localStorage fallback

export interface CustomerCartItem {
  id: string;
  name: string;
  variantName?: string;
  optionsText?: string;
  quantity: number;
  unitPrice: number; // satang
  lineTotal: number;  // satang
}

export type CustomerDisplayStatus = 'WELCOME' | 'CART' | 'PAYMENT_QR' | 'COMPLETED';

export interface CustomerDisplayState {
  storeName: string;
  storePhone?: string;
  status: CustomerDisplayStatus;
  items: CustomerCartItem[];
  subtotal: number;       // satang
  discountAmount: number; // satang
  netTotal: number;       // satang
  receivedAmount?: number; // satang
  changeAmount?: number;   // satang
  billNo?: string;
  qrCodeUrl?: string;     // Base64 QR data URL
  promptpayNumber?: string;
  lastUpdated: number;
}

const STORAGE_KEY = 'pos_customer_display_state';
const CHANNEL_NAME = 'pos_customer_display_channel';

// Get current state
export function getCustomerDisplayState(): CustomerDisplayState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading customer display state', err);
  }

  return {
    storeName: 'ร้านกาแฟหอมละมุน',
    status: 'WELCOME',
    items: [],
    subtotal: 0,
    discountAmount: 0,
    netTotal: 0,
    lastUpdated: Date.now()
  };
}

// Broadcast new state to second screen
export function broadcastCustomerDisplay(state: Partial<CustomerDisplayState>) {
  const current = getCustomerDisplayState();
  const next: CustomerDisplayState = {
    ...current,
    ...state,
    lastUpdated: Date.now()
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.error('Failed to set localStorage', err);
  }

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(next);
      channel.close();
    }
  } catch (err) {
    console.error('BroadcastChannel postMessage failed', err);
  }
}

// Subscribe to state changes on second screen
export function subscribeCustomerDisplay(callback: (state: CustomerDisplayState) => void): () => void {
  // Initial fire
  callback(getCustomerDisplayState());

  let channel: BroadcastChannel | null = null;

  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data) {
        callback(event.data);
      }
    };
  }

  // Fallback to storage event for cross-window sync
  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY && event.newValue) {
      try {
        callback(JSON.parse(event.newValue));
      } catch (e) {
        // ignore
      }
    }
  };

  window.addEventListener('storage', handleStorage);

  return () => {
    if (channel) {
      channel.close();
    }
    window.removeEventListener('storage', handleStorage);
  };
}

