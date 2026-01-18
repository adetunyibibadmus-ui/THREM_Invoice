
export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Customer {
  name: string;
  phone: string;
  address?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  date: string;
  customer: Customer;
  items: InvoiceItem[];
  subtotal: number;
  tax: number;
  discountPercent: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  status: 'pending' | 'paid' | 'cancelled';
  notes?: string;
}

export type ViewMode = 'create' | 'history' | 'preview';
