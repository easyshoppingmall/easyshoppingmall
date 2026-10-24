import { Image } from 'react-native';

export interface DropshippingInvoiceItem {
  name: string;
  variant?: string;
  sku?: string;
  image?: string;
  quantity: string;
  sellingPrice: string;
  totalPrice: string;
}

export interface DropshippingInvoiceData {
  orderId: string;
  orderDate: string;
  orderStatus: string;
  paymentStatus: string;
  paymentMethod: string;
  paymentType?: string;
  provider?: string;
  transactionId?: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  subtotal: string;
  deliveryCharge: string;
  discount?: string;
  total: string;
  paid: string;
  codAmount: string;
  courier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shopName: string;
  shopOwner: string;
  shopAddress: string;
  shopWebsite?: string;
  shopLogo?: string;
  items: DropshippingInvoiceItem[];
  customerMessage: string;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

export function createDropshippingInvoiceHtml(invoice: DropshippingInvoiceData): string {
  const defaultLogo = Image.resolveAssetSource(require('../../../../assets/logo.png'))?.uri;
  const logo = defaultLogo || '';
  const rows = invoice.items.map((item) => `
    <tr>
      <td>
        <div class="product">
        ${item.image ? `<img class="product-image" src="${escapeHtml(item.image)}" />` : ''}
        <span class="product-name">${escapeHtml(item.name)}
          ${item.sku ? `<small>SKU: ${escapeHtml(item.sku)}</small>` : ''}
          ${item.variant ? `<small>${escapeHtml(item.variant)}</small>` : ''}
        </span>
        </div>
      </td>
      <td class="center">${escapeHtml(item.quantity)}</td>
      <td class="right">${escapeHtml(item.sellingPrice)}</td>
      <td class="right">${escapeHtml(item.totalPrice)}</td>
    </tr>
  `).join('');

  return `<!doctype html>
  <html lang="bn">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width,initial-scale=1" />
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 28px; color: #12263A; font: 13px Arial, sans-serif; }
        .brand { display: flex; align-items: center; gap: 12px; border-bottom: 2px solid #0092EE; padding-bottom: 16px; }
        .logo { width: 54px; height: 54px; border-radius: 12px; object-fit: contain; }
        h1 { margin: 0; color: #0077C2; font-size: 19px; }
        .muted { margin-top: 4px; color: #64748B; font-size: 11px; }
        .title-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 20px 0 12px; }
        .title { margin: 0; font-size: 18px; }
        .badge { padding: 6px 10px; border-radius: 99px; background: #E5F4FD; color: #0077C2; font-size: 10px; font-weight: 700; }
        .box { margin: 12px 0; padding: 14px; border: 1px solid #E3EAF1; border-radius: 12px; }
        .row { display: flex; justify-content: space-between; gap: 20px; margin: 8px 0; }
        .label { color: #64748B; }
        .value { min-width: 0; text-align: right; font-weight: 600; overflow-wrap: anywhere; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border-bottom: 1px solid #E3EAF1; padding: 10px 6px; text-align: left; }
        th { color: #64748B; font-size: 10px; }
        .product { display: flex; align-items: center; gap: 8px; }
        .product-image { width: 42px; height: 42px; border-radius: 6px; object-fit: cover; }
        .product-name { min-width: 0; overflow-wrap: anywhere; }
        small { display: block; margin-top: 3px; color: #64748B; font-size: 9px; }
        .center { text-align: center; }
        .right { text-align: right; }
        .total { color: #0077C2; font-size: 15px; font-weight: 700; }
        .thank-you { margin-top: 20px; padding: 16px; border-radius: 12px; background: #F4FAFE; text-align: center; }
        .thank-you strong { color: #0077C2; }
        .footer { margin-top: 12px; color: #64748B; text-align: center; font-size: 10px; }
        @media (max-width: 600px) {
          body { padding: 14px; font-size: 12px; }
          .box { padding: 11px; }
          th, td { padding: 8px 4px; font-size: 10px; }
          .product-image { width: 32px; height: 32px; }
          .product { gap: 5px; }
        }
        @media print { body { padding: 10px; } }
      </style>
    </head>
    <body>
      <header class="brand">
        ${logo ? `<img class="logo" src="${escapeHtml(logo)}" />` : ''}
        <div>
          <h1>EasyShoppingMallBD</h1>
          <div class="muted">easyshoppingmallbd.com</div>
        </div>
      </header>
      <div class="title-row">
        <h2 class="title">${escapeHtml(invoice.orderStatus === 'তথ্য নেই' ? 'অর্ডার' : invoice.orderStatus)} ইনভয়েস</h2>
        <span class="badge">${escapeHtml(invoice.paymentStatus)}</span>
      </div>
      <section class="box">
        <div class="row"><span class="label">অর্ডার আইডি</span><span class="value">${escapeHtml(invoice.orderId)}</span></div>
        <div class="row"><span class="label">তারিখ</span><span class="value">${escapeHtml(invoice.orderDate)}</span></div>
        <div class="row"><span class="label">অর্ডারের অবস্থা</span><span class="value">${escapeHtml(invoice.orderStatus)}</span></div>
        <div class="row"><span class="label">পেমেন্টের অবস্থা</span><span class="value">${escapeHtml(invoice.paymentStatus)}</span></div>
        ${invoice.paymentMethod ? `<div class="row"><span class="label">পেমেন্ট মাধ্যম</span><span class="value">${escapeHtml(invoice.paymentMethod)}</span></div>` : ''}
        ${invoice.paymentType ? `<div class="row"><span class="label">পেমেন্টের ধরন</span><span class="value">${escapeHtml(invoice.paymentType)}</span></div>` : ''}
        ${invoice.provider ? `<div class="row"><span class="label">সেবা প্রদানকারী</span><span class="value">${escapeHtml(invoice.provider)}</span></div>` : ''}
        ${invoice.transactionId ? `<div class="row"><span class="label">ট্রানজেকশন আইডি</span><span class="value">${escapeHtml(invoice.transactionId)}</span></div>` : ''}
        ${invoice.courier ? `<div class="row"><span class="label">কুরিয়ার</span><span class="value">${escapeHtml(invoice.courier)}</span></div>` : ''}
        ${invoice.trackingNumber ? `<div class="row"><span class="label">ট্র্যাকিং নম্বর</span><span class="value">${escapeHtml(invoice.trackingNumber)}</span></div>` : ''}
        ${invoice.trackingUrl ? `<div class="row"><span class="label">ট্র্যাকিং লিংক</span><span class="value">${escapeHtml(invoice.trackingUrl)}</span></div>` : ''}
      </section>
      <section class="box">
        <strong>ড্রপশিপার / শপ</strong>
        ${invoice.shopLogo ? `<img class="logo" src="${escapeHtml(invoice.shopLogo)}" />` : ''}
        <div class="row"><span class="label">শপের নাম</span><span class="value">${escapeHtml(invoice.shopName)}</span></div>
        <div class="row"><span class="label">অ্যাকাউন্টের নাম</span><span class="value">${escapeHtml(invoice.shopOwner)}</span></div>
        ${invoice.shopAddress ? `<div class="row"><span class="label">শপের ঠিকানা</span><span class="value">${escapeHtml(invoice.shopAddress)}</span></div>` : ''}
        ${invoice.shopWebsite ? `<div class="row"><span class="label">শপের ওয়েবসাইট</span><span class="value">${escapeHtml(invoice.shopWebsite)}</span></div>` : ''}
      </section>
      <section class="box">
        <strong>গ্রাহকের তথ্য</strong>
        <div class="row"><span class="label">নাম</span><span class="value">${escapeHtml(invoice.customerName)}</span></div>
        <div class="row"><span class="label">মোবাইল</span><span class="value">${escapeHtml(invoice.customerPhone)}</span></div>
        <div class="row"><span class="label">ঠিকানা</span><span class="value">${escapeHtml(invoice.customerAddress)}</span></div>
      </section>
      <section class="box">
        <strong>পণ্যের বিবরণ</strong>
        <table>
          <thead><tr><th>পণ্য</th><th class="center">পরিমাণ</th><th class="right">একক মূল্য</th><th class="right">সর্বমোট</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4">পণ্যের তথ্য পাওয়া যায়নি।</td></tr>'}</tbody>
        </table>
      </section>
      <section class="box">
        <div class="row"><span class="label">সাবটোটাল</span><span class="value">${escapeHtml(invoice.subtotal)}</span></div>
        <div class="row"><span class="label">ডেলিভারি চার্জ</span><span class="value">${escapeHtml(invoice.deliveryCharge)}</span></div>
        ${invoice.discount ? `<div class="row"><span class="label">ছাড়</span><span class="value">${escapeHtml(invoice.discount)}</span></div>` : ''}
        <div class="row total"><span>সর্বমোট</span><span>${escapeHtml(invoice.total)}</span></div>
        <div class="row"><span class="label">পরিশোধিত</span><span class="value">${escapeHtml(invoice.paid)}</span></div>
        <div class="row"><span class="label">ক্যাশ অন ডেলিভারি</span><span class="value">${escapeHtml(invoice.codAmount)}</span></div>
      </section>
      <section class="thank-you">
        <strong>${invoice.customerName !== 'তথ্য নেই' ? `ধন্যবাদ, ${escapeHtml(invoice.customerName)}!` : 'কেনাকাটার জন্য ধন্যবাদ!'}</strong>
        <div class="muted">${escapeHtml(invoice.customerMessage)}</div>
      </section>
      <footer class="footer"><strong>EasyShoppingMallBD</strong> · এই ইনভয়েসটি অ্যাপ থেকে তৈরি করা হয়েছে।</footer>
    </body>
  </html>`;
}
