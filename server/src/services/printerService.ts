import net from 'node:net';
import { exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { db } from '../db/index.js';

export interface PrintOptions {
  saleId?: number;
  printerType?: 'WINDOWS' | 'NETWORK' | 'RAW'; // WINDOWS (USB/driver) or NETWORK (TCP 9100)
  target?: string; // Printer name in Windows or "IP:Port" for network printer
  paperWidth?: '58mm' | '80mm';
  cutPaper?: boolean;
  openDrawer?: boolean;
}

// Get list of installed Windows printers
export function getInstalledPrinters(): Promise<string[]> {
  return new Promise((resolve) => {
    try {
      exec(
        'powershell -NoProfile -Command "Get-Printer | Select-Object -ExpandProperty Name"',
        { encoding: 'utf8', timeout: 5000 },
        (error, stdout) => {
          if (error || !stdout) {
            resolve([]);
            return;
          }
          const printers = stdout
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean);
          resolve(printers);
        }
      );
    } catch (e) {
      resolve([]);
    }
  });
}

// Convert Satang to formatted Baht string
function fmtBaht(satang: number): string {
  return ((satang || 0) / 100).toFixed(2);
}

// Pad string with spaces for aligned columns
function padRight(str: string, length: number): string {
  let s = str || '';
  if (s.length > length) return s.slice(0, length);
  return s + ' '.repeat(length - s.length);
}

function padLeft(str: string, length: number): string {
  let s = str || '';
  if (s.length > length) return s.slice(0, length);
  return ' '.repeat(length - s.length) + s;
}

// Format date to Thai Buddhist Era string
function formatThaiDateTime(dateStr?: string | null): string {
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

// Generate human-readable text receipt (58mm or 80mm column width)
export function generatePlainTextReceipt(sale: any, settings: any, paperWidth: '58mm' | '80mm' = '80mm'): string {
  const colWidth = paperWidth === '58mm' ? 32 : 44;
  const divider = '-'.repeat(colWidth);
  const doubleDivider = '='.repeat(colWidth);

  const lines: string[] = [];

  // Center alignment helper
  const center = (text: string) => {
    const pad = Math.max(0, Math.floor((colWidth - text.length) / 2));
    lines.push(' '.repeat(pad) + text);
  };

  // 1. Store Header
  center(settings.store_name || 'ร้านกาแฟหอมละมุน');
  if (settings.store_address) {
    center(settings.store_address);
  }
  if (settings.store_phone) {
    center(`โทร: ${settings.store_phone}`);
  }
  if (settings.tax_id) {
    center(`Tax ID: ${settings.tax_id}`);
  }
  center('ใบเสร็จรับเงิน / ใบกำกับภาษีอย่างย่อ');
  lines.push(divider);

  // 2. Bill Meta
  lines.push(`เลขที่บิล: ${sale.bill_no}`);
  lines.push(`วันที่:    ${formatThaiDateTime(sale.sale_date)}`);
  lines.push(`แคชเชียร์: ${sale.cashier_name || sale.cashierName || 'พนักงาน'}`);
  lines.push(`การชำระ:  ${sale.payment_method === 'CASH' ? 'เงินสด (Cash)' : sale.payment_method === 'QR_PROMPT_PAY' ? 'พร้อมเพย์ QR' : sale.payment_method || 'เงินสด'}`);
  lines.push(divider);

  // 3. Table Header
  if (paperWidth === '58mm') {
    lines.push('รายการ                    จำนวน/รวม');
  } else {
    lines.push('รายการ                 จำนวน x ราคา       รวม');
  }
  lines.push(divider);

  // 4. Items
  const items = sale.items || [];
  for (const it of items) {
    const name = it.product_name || it.productName || 'สินค้า';
    const variant = it.variant_name || it.variantName ? ` (${it.variant_name || it.variantName})` : '';
    const fullName = `${it.quantity}x ${name}${variant}`;
    const lineTotal = fmtBaht(it.net_total || it.netTotal || 0);
    const unitPrice = fmtBaht(it.unit_price || it.unitPrice || 0);

    if (paperWidth === '58mm') {
      lines.push(fullName);
      lines.push(padLeft(`@${unitPrice}  ${lineTotal}`, colWidth));
    } else {
      const leftPart = padRight(fullName.slice(0, 22), 22);
      const midPart = padRight(`${it.quantity} x ${unitPrice}`, 14);
      const rightPart = padLeft(lineTotal, 8);
      lines.push(`${leftPart}${midPart}${rightPart}`);
    }

    // Print Options / Sweetness / Add-ons
    if (it.options && it.options.length > 0) {
      for (const opt of it.options) {
        const optName = opt.option_name || opt.name;
        const optAdj = opt.price_adjustment > 0 ? ` (+${fmtBaht(opt.price_adjustment)})` : '';
        lines.push(`  + ${optName}${optAdj}`);
      }
    }
    if (it.note) {
      lines.push(`  * ${it.note}`);
    }
  }

  lines.push(divider);

  // 5. Totals
  const subtotalStr = fmtBaht(sale.subtotal || 0);
  const discountStr = fmtBaht(sale.discount_amount || sale.discountAmount || 0);
  const netTotalStr = fmtBaht(sale.net_total || sale.netTotal || 0);
  const receivedStr = fmtBaht(sale.received_amount || sale.receivedAmount || 0);
  const changeStr = fmtBaht(sale.change_amount || sale.changeAmount || 0);

  const printRow = (label: string, val: string) => {
    const space = Math.max(1, colWidth - label.length - val.length);
    lines.push(label + ' '.repeat(space) + val);
  };

  printRow('ยอดรวมสินค้า:', subtotalStr);
  if (Number(sale.discount_amount || sale.discountAmount || 0) > 0) {
    printRow('ส่วนลด:', `-${discountStr}`);
  }
  lines.push(doubleDivider);
  printRow('ยอดสุทธิ (Total Net):', `${netTotalStr} บาท`);
  lines.push(doubleDivider);

  printRow('รับเงินมา:', `${receivedStr} บาท`);
  printRow('เงินทอน:', `${changeStr} บาท`);
  lines.push(divider);

  // 6. Footer
  const footer = settings.receipt_footer || 'ขอบคุณที่ใช้บริการ โอกาสหน้าเชิญใหม่ค่ะ\nThank you for visiting!';
  for (const fLine of footer.split('\n')) {
    center(fLine);
  }
  lines.push('\n\n\n');

  return lines.join('\n');
}

// Generate ESC/POS Binary Buffer for standard thermal receipt printers
export function generateEscPosBuffer(sale: any, settings: any, paperWidth: '58mm' | '80mm' = '80mm', cutPaper = true, openDrawer = false): Buffer {
  const chunks: Buffer[] = [];

  // ESC @: Initialize printer
  chunks.push(Buffer.from([0x1b, 0x40]));

  // Open Cash Drawer if requested: ESC p 0 25 250
  if (openDrawer) {
    chunks.push(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]));
  }

  // Convert plain text receipt into buffer with UTF-8
  const receiptText = generatePlainTextReceipt(sale, settings, paperWidth);
  chunks.push(Buffer.from(receiptText, 'utf8'));

  // GS V 65 3: Cut paper (Feed paper and cut)
  if (cutPaper) {
    chunks.push(Buffer.from([0x1d, 0x56, 0x41, 0x03]));
  }

  return Buffer.concat(chunks);
}

// Send print job directly to a Network (LAN/WiFi) thermal printer via TCP Socket (IP:Port)
export function printToNetworkPrinter(ip: string, port = 9100, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let hasFinished = false;

    socket.setTimeout(6000);

    socket.connect(port, ip, () => {
      socket.write(data, () => {
        hasFinished = true;
        socket.end();
        resolve();
      });
    });

    socket.on('error', (err) => {
      if (!hasFinished) {
        socket.destroy();
        reject(new Error(`ไม่สามารถเชื่อมต่อเครื่องพิมพ์ Network (${ip}:${port}): ${err.message}`));
      }
    });

    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`หมดเวลาเชื่อมต่อเครื่องพิมพ์ Network (${ip}:${port})`));
    });
  });
}

// Send print job directly to a Windows installed printer queue (bypassing browser)
export function printToWindowsPrinter(printerName: string, text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tempFile = path.join(os.tmpdir(), `receipt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.txt`);

    try {
      fs.writeFileSync(tempFile, text, 'utf8');

      // Use PowerShell Out-Printer directly to spool without opening any dialog
      const safePrinterName = printerName.replace(/'/g, "''");
      const cmd = `powershell -NoProfile -Command "Get-Content -Raw -Encoding UTF8 '${tempFile}' | Out-Printer -Name '${safePrinterName}'"`;

      exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
        try {
          fs.unlinkSync(tempFile);
        } catch (e) {}

        if (error) {
          reject(new Error(`เกิดข้อผิดพลาดในการพิมพ์ไปยัง '${printerName}': ${stderr || error.message}`));
        } else {
          resolve();
        }
      });
    } catch (err: any) {
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {}
      reject(err);
    }
  });
}

// Main high-level print dispatch function
export async function executeDirectPrint(options: PrintOptions): Promise<{ success: boolean; message: string }> {
  // Read store settings
  const rows = db.prepare('SELECT key, value FROM store_settings').all() as any[];
  const settings: Record<string, string> = {};
  for (const r of rows) settings[r.key] = r.value;

  const printerType = options.printerType || (settings.printer_type as any) || 'WINDOWS';
  const target = options.target || settings.printer_name || settings.printer_ip || 'Microsoft Print to PDF';
  const paperWidth = options.paperWidth || (settings.printer_paper_width as any) || '80mm';
  const cutPaper = options.cutPaper ?? (settings.printer_auto_cut !== '0');
  const openDrawer = options.openDrawer ?? (settings.printer_open_drawer === '1');

  // Load sale data if saleId provided
  let saleData: any = null;
  if (options.saleId) {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(options.saleId) as any;
    if (!sale) {
      throw new Error(`ไม่พบบิลการขาย ID: ${options.saleId}`);
    }

    const items = db.prepare(`
      SELECT si.*, p.name as product_name
      FROM sale_items si
      JOIN products p ON p.id = si.product_id
      WHERE si.sale_id = ?
    `).all(options.saleId) as any[];

    // Fetch options for each item
    for (const it of items) {
      const opts = db.prepare(`
        SELECT sio.option_name, sio.price_adjustment
        FROM sale_item_options sio
        WHERE sio.sale_item_id = ?
      `).all(it.id);
      it.options = opts;
    }

    sale.items = items;
    saleData = sale;
  } else {
    // Generate Sample Test Sale
    saleData = {
      bill_no: 'TEST-00001',
      sale_date: new Date().toISOString(),
      cashier_name: 'ผู้ดูแลระบบ',
      payment_method: 'CASH',
      items: [
        {
          quantity: 1,
          product_name: 'เอสเพรสโซ่เย็น (Iced Espresso)',
          variant_name: 'เย็น 16oz',
          unit_price: 5500,
          net_total: 5500,
          options: [{ option_name: 'หวาน 50%' }]
        },
        {
          quantity: 1,
          product_name: 'ครัวซองต์เนยสด (Butter Croissant)',
          unit_price: 6500,
          net_total: 6500,
          options: []
        }
      ],
      subtotal: 12000,
      discount_amount: 0,
      net_total: 12000,
      received_amount: 15000,
      change_amount: 3000
    };
  }

  // Execute print based on printer type
  if (printerType === 'NETWORK') {
    // Network printer (e.g. 192.168.1.200:9100)
    let ip = target;
    let port = 9100;
    if (target.includes(':')) {
      const parts = target.split(':');
      ip = parts[0];
      port = parseInt(parts[1], 10) || 9100;
    }

    const escposBuffer = generateEscPosBuffer(saleData, settings, paperWidth, cutPaper, openDrawer);
    await printToNetworkPrinter(ip, port, escposBuffer);
    return {
      success: true,
      message: `พิมพ์สลิปใบเสร็จตรงไปยัง Network Thermal Printer (${ip}:${port}) เรียบร้อยแล้ว`
    };
  } else {
    // Windows Printer (USB / Driver / Spooler)
    const plainText = generatePlainTextReceipt(saleData, settings, paperWidth);
    await printToWindowsPrinter(target, plainText);
    return {
      success: true,
      message: `ส่งคำสั่งพิมพ์ตรงไปยังเครื่องพิมพ์ '${target}' เรียบร้อยแล้ว (ไม่ผ่าน Browser)`
    };
  }
}

