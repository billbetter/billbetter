import { PDFDocument, rgb, StandardFonts } from 'npm:pdf-lib@1.17.1';

function arrayBufferToBase64(buffer: Uint8Array) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function formatCurrency(value: number) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-CA');
}

// Strip/replace chars that Helvetica (WinAnsi) cannot encode, preventing pdf-lib from throwing.
function safe(text: unknown): string {
  if (text == null) return '';
  return String(text)
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    // Remove anything outside the Latin-1 range (emojis, CJK, etc.)
    .replace(/[^\x20-\x7E\xA1-\xFF]/g, '');
}

export async function buildInvoicePDF(payload: any) {
  const {
    invoice_number,
    client_name,
    client_email,
    client_address,
    client_phone,
    items = [],
    subtotal = 0,
    tax_rate = 0,
    tax_amount = 0,
    total = 0,
    notes = '',
    due_date,
    business_settings = {},
    created_at,
  } = payload;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const primaryColor = rgb(0.06, 0.72, 0.51); // emerald-500
  const textColor = rgb(0.2, 0.2, 0.2);
  const lightGray = rgb(0.4, 0.4, 0.4);

  let y = height - 40;

  // Header
  page.drawText(safe(business_settings.business_name || 'Invoicium'), {
    x: 40, y, size: 24, font: fontBold, color: primaryColor,
  });
  y -= 20;
  page.drawText(safe(business_settings.email || ''), { x: 40, y, size: 10, font, color: lightGray });
  y -= 14;
  page.drawText(safe(business_settings.phone || ''), { x: 40, y, size: 10, font, color: lightGray });
  y -= 14;
  page.drawText(safe(business_settings.address || ''), { x: 40, y, size: 10, font, color: lightGray });

  // Invoice Title
  page.drawText(safe('INVOICE'), { x: width - 140, y: height - 50, size: 28, font: fontBold, color: textColor });
  page.drawText(safe(`#${invoice_number || ''}`), { x: width - 140, y: height - 80, size: 12, font, color: lightGray });

  y = height - 160;

  // Bill To
  page.drawText(safe('BILL TO'), { x: 40, y, size: 10, font: fontBold, color: lightGray });
  y -= 16;
  page.drawText(safe(client_name || 'Client'), { x: 40, y, size: 12, font: fontBold, color: textColor });
  y -= 14;
  if (client_email) {
    page.drawText(safe(client_email), { x: 40, y, size: 10, font, color: lightGray });
    y -= 14;
  }
  if (client_address) {
    page.drawText(safe(client_address), { x: 40, y, size: 10, font, color: lightGray });
    y -= 14;
  }
  if (client_phone) {
    page.drawText(safe(client_phone), { x: 40, y, size: 10, font, color: lightGray });
    y -= 14;
  }

  // Dates
  const dateX = width - 200;
  let dy = height - 160;
  page.drawText(safe('Invoice Date:'), { x: dateX, y: dy, size: 10, font: fontBold, color: lightGray });
  page.drawText(safe(formatDate(created_at)), { x: dateX + 90, y: dy, size: 10, font, color: textColor });
  dy -= 16;
  page.drawText(safe('Due Date:'), { x: dateX, y: dy, size: 10, font: fontBold, color: lightGray });
  page.drawText(safe(formatDate(due_date)), { x: dateX + 90, y: dy, size: 10, font, color: textColor });

  y -= 60;

  // Table Header
  page.drawRectangle({ x: 40, y: y - 5, width: width - 80, height: 24, color: rgb(0.95, 0.95, 0.95) });
  page.drawText(safe('Description'), { x: 48, y: y + 2, size: 10, font: fontBold, color: textColor });
  page.drawText(safe('Qty'), { x: 340, y: y + 2, size: 10, font: fontBold, color: textColor });
  page.drawText(safe('Rate'), { x: 400, y: y + 2, size: 10, font: fontBold, color: textColor });
  page.drawText(safe('Amount'), { x: width - 100, y: y + 2, size: 10, font: fontBold, color: textColor });
  y -= 20;

  // Table Rows
  const lineItems = Array.isArray(items) ? items : JSON.parse(items || '[]');
  for (const item of lineItems) {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    const amount = Number(item.total || qty * rate || 0);
    page.drawText(safe(String(item.description || '').substring(0, 60)), { x: 48, y, size: 10, font, color: textColor });
    page.drawText(safe(String(qty)), { x: 340, y, size: 10, font, color: textColor });
    page.drawText(safe(formatCurrency(rate)), { x: 400, y, size: 10, font, color: textColor });
    page.drawText(safe(formatCurrency(amount)), { x: width - 100, y, size: 10, font, color: textColor });
    y -= 18;
    if (y < 200) {
      y = height - 40;
      // For simplicity in v1, we won't handle page breaks — add later if needed
    }
  }

  // Totals
  y -= 20;
  page.drawLine({ start: { x: width - 200, y }, end: { x: width - 40, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 18;
  page.drawText(safe('Subtotal'), { x: width - 190, y, size: 10, font, color: lightGray });
  page.drawText(safe(formatCurrency(subtotal)), { x: width - 100, y, size: 10, font: fontBold, color: textColor });
  y -= 16;
  page.drawText(safe(`Tax (${Number(tax_rate || 0)}%)`), { x: width - 190, y, size: 10, font, color: lightGray });
  page.drawText(safe(formatCurrency(tax_amount)), { x: width - 100, y, size: 10, font: fontBold, color: textColor });
  y -= 20;
  page.drawText(safe('TOTAL'), { x: width - 190, y, size: 12, font: fontBold, color: primaryColor });
  page.drawText(safe(formatCurrency(total)), { x: width - 100, y, size: 12, font: fontBold, color: primaryColor });

  // Notes
  if (notes) {
    y -= 40;
    page.drawText(safe('Notes'), { x: 40, y, size: 10, font: fontBold, color: lightGray });
    y -= 16;
    page.drawText(safe(notes.substring(0, 500)), { x: 40, y, size: 10, font, color: textColor, maxWidth: width - 80 });
  }

  // Footer
  page.drawText(safe('Thank you for your business!'), { x: 40, y: 60, size: 10, font, color: lightGray });

  const pdfBytes = await pdfDoc.save();
  return arrayBufferToBase64(pdfBytes);
}

export async function buildQuotePDF(payload: any) {
  const {
    quote_number,
    client_name,
    client_email,
    client_address,
    client_phone,
    items = [],
    subtotal = 0,
    tax_rate = 0,
    tax_amount = 0,
    total = 0,
    notes = '',
    expiry_date,
    date_issued,
    business_settings = {},
  } = payload;

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([612, 792]);
  const { width, height } = page.getSize();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const primaryColor = rgb(0.06, 0.72, 0.51);
  const textColor = rgb(0.2, 0.2, 0.2);
  const lightGray = rgb(0.4, 0.4, 0.4);

  let y = height - 40;

  page.drawText(safe(business_settings.business_name || 'Invoicium'), {
    x: 40, y, size: 24, font: fontBold, color: primaryColor,
  });
  y -= 20;
  page.drawText(safe(business_settings.email || ''), { x: 40, y, size: 10, font, color: lightGray });
  y -= 14;
  page.drawText(safe(business_settings.phone || ''), { x: 40, y, size: 10, font, color: lightGray });
  y -= 14;
  page.drawText(safe(business_settings.address || ''), { x: 40, y, size: 10, font, color: lightGray });

  page.drawText(safe('QUOTE'), { x: width - 120, y: height - 50, size: 28, font: fontBold, color: textColor });
  page.drawText(safe(`#${quote_number || ''}`), { x: width - 120, y: height - 80, size: 12, font, color: lightGray });

  y = height - 160;

  page.drawText(safe('BILL TO'), { x: 40, y, size: 10, font: fontBold, color: lightGray });
  y -= 16;
  page.drawText(safe(client_name || 'Client'), { x: 40, y, size: 12, font: fontBold, color: textColor });
  y -= 14;
  if (client_email) { page.drawText(safe(client_email), { x: 40, y, size: 10, font, color: lightGray }); y -= 14; }
  if (client_address) { page.drawText(safe(client_address), { x: 40, y, size: 10, font, color: lightGray }); y -= 14; }
  if (client_phone) { page.drawText(safe(client_phone), { x: 40, y, size: 10, font, color: lightGray }); y -= 14; }

  const dateX = width - 200;
  let dy = height - 160;
  page.drawText(safe('Quote Date:'), { x: dateX, y: dy, size: 10, font: fontBold, color: lightGray });
  page.drawText(safe(formatDate(date_issued)), { x: dateX + 90, y: dy, size: 10, font, color: textColor });
  dy -= 16;
  page.drawText(safe('Valid Until:'), { x: dateX, y: dy, size: 10, font: fontBold, color: lightGray });
  page.drawText(safe(formatDate(expiry_date)), { x: dateX + 90, y: dy, size: 10, font, color: textColor });

  y -= 60;

  page.drawRectangle({ x: 40, y: y - 5, width: width - 80, height: 24, color: rgb(0.95, 0.95, 0.95) });
  page.drawText(safe('Description'), { x: 48, y: y + 2, size: 10, font: fontBold, color: textColor });
  page.drawText(safe('Qty'), { x: 340, y: y + 2, size: 10, font: fontBold, color: textColor });
  page.drawText(safe('Rate'), { x: 400, y: y + 2, size: 10, font: fontBold, color: textColor });
  page.drawText(safe('Amount'), { x: width - 100, y: y + 2, size: 10, font: fontBold, color: textColor });
  y -= 20;

  const lineItems = Array.isArray(items) ? items : JSON.parse(items || '[]');
  for (const item of lineItems) {
    const qty = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    const amount = Number(item.total || qty * rate || 0);
    page.drawText(safe(String(item.description || '').substring(0, 60)), { x: 48, y, size: 10, font, color: textColor });
    page.drawText(safe(String(qty)), { x: 340, y, size: 10, font, color: textColor });
    page.drawText(safe(formatCurrency(rate)), { x: 400, y, size: 10, font, color: textColor });
    page.drawText(safe(formatCurrency(amount)), { x: width - 100, y, size: 10, font, color: textColor });
    y -= 18;
  }

  y -= 20;
  page.drawLine({ start: { x: width - 200, y }, end: { x: width - 40, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 18;
  page.drawText(safe('Subtotal'), { x: width - 190, y, size: 10, font, color: lightGray });
  page.drawText(safe(formatCurrency(subtotal)), { x: width - 100, y, size: 10, font: fontBold, color: textColor });
  y -= 16;
  page.drawText(safe(`Tax (${Number(tax_rate || 0)}%)`), { x: width - 190, y, size: 10, font, color: lightGray });
  page.drawText(safe(formatCurrency(tax_amount)), { x: width - 100, y, size: 10, font: fontBold, color: textColor });
  y -= 20;
  page.drawText(safe('TOTAL'), { x: width - 190, y, size: 12, font: fontBold, color: primaryColor });
  page.drawText(safe(formatCurrency(total)), { x: width - 100, y, size: 12, font: fontBold, color: primaryColor });

  if (notes) {
    y -= 40;
    page.drawText(safe('Notes'), { x: 40, y, size: 10, font: fontBold, color: lightGray });
    y -= 16;
    page.drawText(safe(notes.substring(0, 500)), { x: 40, y, size: 10, font, color: textColor, maxWidth: width - 80 });
  }

  page.drawText(safe('This quote is valid until the date shown above.'), { x: 40, y: 60, size: 10, font, color: lightGray });

  const pdfBytes = await pdfDoc.save();
  return arrayBufferToBase64(pdfBytes);
}
