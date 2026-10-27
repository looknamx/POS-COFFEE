import QRCode from 'qrcode';

function formatField(id: string, value: string): string {
  const len = String(value.length).padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Generate Thai QR Payment (PromptPay) standard EMVCo payload string
 * @param target Phone number (10 digits) or Tax ID / National ID (13 digits)
 * @param amount Amount in Baht (e.g. 55.00)
 */
export function generatePromptPayPayload(target: string, amount?: number): string {
  const cleanTarget = (target || '').replace(/[^0-9]/g, '');
  if (!cleanTarget) return '';

  // 13 digits = National ID / Tax ID (Type 02), otherwise Phone number (Type 01)
  const isTaxOrNationalId = cleanTarget.length >= 13;
  const targetType = isTaxOrNationalId ? '02' : '01';

  let formattedTarget = cleanTarget;
  if (!isTaxOrNationalId) {
    // International format: 0066XXXXXXXXX (remove leading 0)
    formattedTarget = `0066${cleanTarget.replace(/^0/, '')}`;
  }

  // Merchant Account Info (Tag 29)
  const sub00 = formatField('00', 'A000000677010111'); // PromptPay AID
  const sub01 = formatField(targetType, formattedTarget);
  const tag29 = formatField('29', sub00 + sub01);

  let payload = formatField('00', '01'); // Payload Format Indicator
  payload += formatField('01', amount && amount > 0 ? '12' : '11'); // 12=Dynamic (with amount), 11=Static
  payload += tag29;
  payload += formatField('53', '764'); // Currency: THB (764)

  if (amount && amount > 0) {
    payload += formatField('54', Number(amount).toFixed(2));
  }

  payload += formatField('58', 'TH'); // Country: Thailand
  payload += '6304';
  payload += crc16(payload);

  return payload;
}

/**
 * Render PromptPay QR Code as Base64 Data URL
 */
export async function generatePromptPayQRCode(target: string, amountInBaht?: number): Promise<string> {
  const payload = generatePromptPayPayload(target, amountInBaht);
  if (!payload) return '';

  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width: 280,
    color: {
      dark: '#1c1917',
      light: '#ffffff'
    }
  });
}

