// API Client for POS & Inventory Backend

const API_BASE = '/api';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; [key: string]: any }> {
  // Read active cashier ID from localStorage if stored
  const activeStaffId = localStorage.getItem('pos_active_staff_id');
  const token = localStorage.getItem('pos_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (activeStaffId) {
    headers['x-cashier-id'] = activeStaffId;
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const json = await response.json().catch(() => ({
    success: false,
    message: `Server returned status ${response.status}`
  }));

  if (!response.ok && !json.message) {
    json.message = `HTTP Error ${response.status}`;
  }

  return json;
}

// Format Satang integer to THB string: e.g. 5500 -> ฿55.00 or ฿55
export function formatCurrency(satang: number, showDecimals: boolean = false): string {
  const thb = (satang || 0) / 100;
  if (showDecimals || thb % 1 !== 0) {
    return `฿${thb.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `฿${thb.toLocaleString('th-TH')}`;
}

// Format Thai Date & Time in Buddhist Era (พ.ศ.)
export function formatThaiDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  return d.toLocaleDateString('th-TH-u-ca-buddhist', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatThaiDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;

  return d.toLocaleDateString('th-TH-u-ca-buddhist', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

// Convert Gregorian year to Buddhist Era (พ.ศ.)
export function toBuddhistYear(gregorianYear: number): number {
  return gregorianYear + 543;
}

// Convert Buddhist Era (พ.ศ.) to Gregorian year
export function toGregorianYear(buddhistYear: number): number {
  return buddhistYear - 543;
}

export const THAI_MONTH_NAMES = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
];

export const THAI_MONTH_NAMES_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

export const THAI_WEEKDAY_NAMES_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

