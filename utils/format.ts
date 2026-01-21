
export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(amount);
};

export const generateInvoiceNumber = () => {
  const prefix = 'TMV';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}-${timestamp}-${random}`;
};

const getInvoiceSummaryText = (invoice: any) => {
  const itemsText = invoice.items
    .map((item: any) => `${item.quantity} bags of ${item.description} @ ${formatCurrency(item.unitPrice)}`)
    .join('\n');

  let discountText = '';
  if (invoice.discountAmount > 0) {
    discountText = `*Discount (${invoice.discountPercent}%):* -${formatCurrency(invoice.discountAmount)}\n`;
  }

  const statusText = invoice.status === 'paid' ? '✅ *PAID IN FULL*' : '⏳ *PAYMENT PENDING*';

  return `*INVOICE FROM THREM MULTILINKS VENTURE*
----------------------------------
*Invoice:* ${invoice.invoiceNumber}
*Status:* ${statusText}
*Customer:* ${invoice.customer.name}
*Date:* ${new Date(invoice.date).toLocaleDateString()}
----------------------------------
*Items:*
${itemsText}
----------------------------------
*Subtotal:* ${formatCurrency(invoice.subtotal)}
${discountText}*Delivery:* ${formatCurrency(invoice.deliveryFee)}
*TOTAL:* ${formatCurrency(invoice.totalAmount)}
----------------------------------
_Thank you for your business!_`;
};

export const generateWhatsAppLink = (invoice: any) => {
  const text = encodeURIComponent(getInvoiceSummaryText(invoice));
  return `https://wa.me/${invoice.customer.phone.replace(/\D/g, '')}?text=${text}`;
};

export const generateTelegramLink = (invoice: any) => {
  const text = encodeURIComponent(getInvoiceSummaryText(invoice));
  return `https://t.me/share/url?url=${encodeURIComponent('Threm Multilinks Invoice')}&text=${text}`;
};
