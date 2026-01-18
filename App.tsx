
import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  History as HistoryIcon, 
  Plus, 
  Share2, 
  Printer, 
  Trash2, 
  ChevronRight,
  Sparkles,
  User,
  Phone,
  Truck,
  Send,
  Loader2,
  CheckCircle,
  Clock,
  MessageCircle,
  Tag,
  Image as ImageIcon,
  FileDown
} from 'lucide-react';
import { Invoice, InvoiceItem, ViewMode } from './types';
import { generateInvoiceNumber, formatCurrency, generateWhatsAppLink, generateTelegramLink } from './utils/format';
import { parseInvoiceInput } from './services/geminiService';

declare const html2canvas: any;
declare const jspdf: any;

const Logo: React.FC = () => (
  <div className="flex items-center gap-2">
    <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-lg">
      T
    </div>
    <div>
      <h1 className="font-bold text-slate-800 leading-tight">THREM MULTILINKS</h1>
      <p className="text-xs text-slate-500 font-medium tracking-wider uppercase">Venture • Cement Depot</p>
    </div>
  </div>
);

const EmptyState: React.FC<{ onCreate: () => void }> = ({ onCreate }) => (
  <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
    <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-6 text-slate-400">
      <FileText size={40} />
    </div>
    <h3 className="text-xl font-semibold text-slate-800 mb-2">No Invoices Yet</h3>
    <p className="text-slate-500 max-w-sm mb-8">
      Start by creating your first invoice for a customer or use the AI assistant to parse a quick message.
    </p>
    <button 
      onClick={onCreate}
      className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-all shadow-md active:scale-95"
    >
      <Plus size={20} /> Create New Invoice
    </button>
  </div>
);

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('create');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const invoiceRef = useRef<HTMLDivElement>(null);

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [items, setItems] = useState<Partial<InvoiceItem>[]>([{ id: '1', description: '', quantity: 1, unitPrice: 0 }]);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem('threm_invoices');
    if (saved) {
      setInvoices(JSON.parse(saved));
    }
  }, []);

  const saveToHistory = (newInvoice: Invoice) => {
    const updated = [newInvoice, ...invoices];
    setInvoices(updated);
    localStorage.setItem('threm_invoices', JSON.stringify(updated));
  };

  const updateInvoiceStatus = (id: string, status: 'paid' | 'pending') => {
    const updated = invoices.map(inv => inv.id === id ? { ...inv, status } : inv);
    setInvoices(updated);
    localStorage.setItem('threm_invoices', JSON.stringify(updated));
    if (currentInvoice?.id === id) {
      setCurrentInvoice({ ...currentInvoice, status });
    }
  };

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(), description: '', quantity: 1, unitPrice: 0 }]);
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeItem = (id: string) => {
    if (items.length > 1) {
      setItems(items.filter(item => item.id !== id));
    }
  };

  const calculateTotals = () => {
    const subtotal = items.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unitPrice || 0)), 0);
    const discountAmount = subtotal * (discountPercent / 100);
    return {
      subtotal,
      discountAmount,
      total: subtotal - discountAmount + deliveryFee
    };
  };

  const handleCreateInvoice = () => {
    const { subtotal, discountAmount, total } = calculateTotals();
    const newInvoice: Invoice = {
      id: Math.random().toString(),
      invoiceNumber: generateInvoiceNumber(),
      date: new Date().toISOString(),
      customer: { name: customerName, phone: customerPhone, address: customerAddress },
      items: items.map(i => ({ ...i, total: (i.quantity || 0) * (i.unitPrice || 0) })) as InvoiceItem[],
      subtotal,
      tax: 0,
      discountPercent,
      discountAmount,
      deliveryFee,
      totalAmount: total,
      status: 'pending',
      notes
    };
    
    saveToHistory(newInvoice);
    setCurrentInvoice(newInvoice);
    setView('preview');
  };

  const handleShareFile = async (format: 'pdf' | 'image') => {
    if (!invoiceRef.current || !currentInvoice) return;
    setIsFileLoading(true);

    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      let file: File;
      if (format === 'image') {
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob(resolve, 'image/png'));
        file = new File([blob], `Invoice-${currentInvoice.invoiceNumber}.png`, { type: 'image/png' });
      } else {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jspdf.jsPDF({
          orientation: 'portrait',
          unit: 'px',
          format: [canvas.width, canvas.height]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        const pdfBlob = pdf.output('blob');
        file = new File([pdfBlob], `Invoice-${currentInvoice.invoiceNumber}.pdf`, { type: 'application/pdf' });
      }

      if (navigator.share) {
        await navigator.share({
          files: [file],
          title: `Invoice ${currentInvoice.invoiceNumber}`,
          text: `Invoice for ${currentInvoice.customer.name}`
        });
      } else {
        // Fallback: Download
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.click();
        alert("Sharing not supported by this browser. File has been downloaded instead.");
      }
    } catch (err) {
      console.error("File generation failed:", err);
      alert("Failed to generate file. Please try printing to PDF instead.");
    } finally {
      setIsFileLoading(false);
    }
  };

  const handleAiAction = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiLoading(true);
    const result = await parseInvoiceInput(aiPrompt);
    setIsAiLoading(false);
    
    if (result) {
      setCustomerName(result.customer?.name || "");
      setCustomerPhone(result.customer?.phone || "");
      setCustomerAddress(result.customer?.address || "");
      if (result.items && result.items.length > 0) {
        setItems(result.items.map((item: any, idx: number) => ({
          id: idx.toString(),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        })));
      }
      setDeliveryFee(result.deliveryFee || 0);
      setNotes(result.notes || "");
      setAiPrompt("");
    }
  };

  const deleteInvoice = (id: string) => {
    if (confirm("Delete this invoice forever?")) {
      const updated = invoices.filter(inv => inv.id !== id);
      setInvoices(updated);
      localStorage.setItem('threm_invoices', JSON.stringify(updated));
    }
  };

  const resetForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setCustomerAddress("");
    setItems([{ id: '1', description: '', quantity: 1, unitPrice: 0 }]);
    setDeliveryFee(0);
    setDiscountPercent(0);
    setNotes("");
    setView('create');
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      {isFileLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
          <p className="font-bold text-slate-800">Generating Invoice File...</p>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-4 md:px-8 no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Logo />
          
          <nav className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setView('create')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'create' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Plus size={18} /> New Invoice
            </button>
            <button 
              onClick={() => setView('history')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <HistoryIcon size={18} /> History
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {view === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="text-blue-600" size={20} />
                  <h2 className="text-lg font-bold text-slate-800">AI Quick Entry</h2>
                </div>
                <div className="relative">
                  <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="E.g., 50 bags of Dangote to John 08012345678, delivery 15k"
                    className="w-full p-4 pr-12 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[100px] resize-none text-slate-900"
                  />
                  <button 
                    onClick={handleAiAction}
                    disabled={isAiLoading || !aiPrompt.trim()}
                    className="absolute bottom-4 right-4 bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-90"
                  >
                    {isAiLoading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                  </button>
                </div>
              </div>

              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-8">
                <section className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                    <User className="text-slate-400" size={18} />
                    <h3 className="font-bold text-slate-700">Customer Details</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Customer Name</label>
                      <input 
                        type="text" 
                        value={customerName} 
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 text-slate-900 outline-none" 
                        placeholder="John Doe"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Phone Number</label>
                      <input 
                        type="tel" 
                        value={customerPhone} 
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 text-slate-900 outline-none" 
                        placeholder="08012345678"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Delivery Address</label>
                    <input 
                      type="text" 
                      value={customerAddress} 
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 text-slate-900 outline-none" 
                      placeholder="Street, City, State"
                    />
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="text-slate-400" size={18} />
                      <h3 className="font-bold text-slate-700">Invoice Items</h3>
                    </div>
                    <button 
                      onClick={addItem}
                      className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700"
                    >
                      <Plus size={16} /> Add Item
                    </button>
                  </div>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="flex flex-col md:flex-row gap-3 items-end md:items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
                        <div className="flex-1 w-full space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Description</label>
                          <input 
                            type="text" 
                            value={item.description}
                            onChange={(e) => updateItem(item.id!, 'description', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 outline-none" 
                            placeholder="Dangote Cement 42.5R"
                          />
                        </div>
                        <div className="w-full md:w-24 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Qty</label>
                          <input 
                            type="number" 
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id!, 'quantity', parseInt(e.target.value) || 0)}
                            className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 outline-none" 
                          />
                        </div>
                        <div className="w-full md:w-40 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Unit Price</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">₦</span>
                            <input 
                              type="number" 
                              value={item.unitPrice}
                              onChange={(e) => updateItem(item.id!, 'unitPrice', parseInt(e.target.value) || 0)}
                              className="w-full pl-7 pr-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 outline-none" 
                            />
                          </div>
                        </div>
                        <button 
                          onClick={() => removeItem(item.id!)}
                          className="p-2 text-slate-300 hover:text-red-500"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-6 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Truck className="text-slate-400" size={18} />
                            <h3 className="font-bold text-slate-700">Logistics</h3>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Delivery Fee</label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">₦</span>
                              <input 
                                type="number" 
                                value={deliveryFee}
                                onChange={(e) => setDeliveryFee(parseInt(e.target.value) || 0)}
                                className="w-full pl-8 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none" 
                              />
                            </div>
                          </div>
                       </div>
                       <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Tag className="text-slate-400" size={18} />
                            <h3 className="font-bold text-slate-700">Discount</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            {[0, 1, 2, 3].map(pct => (
                              <button
                                key={pct}
                                onClick={() => setDiscountPercent(pct)}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border ${discountPercent === pct ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}
                              >
                                {pct === 0 ? 'None' : `${pct}%`}
                              </button>
                            ))}
                          </div>
                       </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                        <FileText className="text-slate-400" size={18} />
                        <h3 className="font-bold text-slate-700">Notes</h3>
                      </div>
                      <textarea 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 min-h-[140px] outline-none" 
                        placeholder="Additional notes..."
                      />
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-200 sticky top-28">
                <h2 className="text-xl font-bold text-slate-800 mb-6 pb-4 border-b border-slate-100">Summary</h2>
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal</span>
                    <span className="font-bold text-slate-800">{formatCurrency(totals.subtotal)}</span>
                  </div>
                  {discountPercent > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount ({discountPercent}%)</span>
                      <span className="font-bold">-{formatCurrency(totals.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-500">
                    <span>Delivery</span>
                    <span className="font-bold text-slate-800">{formatCurrency(deliveryFee)}</span>
                  </div>
                  <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-lg font-black text-slate-800 uppercase tracking-tighter">Total</span>
                    <span className="text-2xl font-black text-blue-600">{formatCurrency(totals.total)}</span>
                  </div>
                </div>
                
                <button 
                  onClick={handleCreateInvoice}
                  disabled={!customerName || items.some(i => !i.description)}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-4 rounded-xl font-black text-lg shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2"
                >
                  <FileText size={20} /> Generate Invoice
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800">History</h2>
            </div>
            {invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-100">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                           <div className="font-mono text-sm font-bold text-slate-600">{inv.invoiceNumber}</div>
                           <div className="text-[10px] text-slate-400 uppercase font-bold">{new Date(inv.date).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-black text-slate-800 uppercase">{inv.customer.name}</div>
                        </td>
                        <td className="px-6 py-4">
                           <button 
                             onClick={() => updateInvoiceStatus(inv.id, inv.status === 'paid' ? 'pending' : 'paid')}
                             className={`px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${inv.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
                           >
                             {inv.status}
                           </button>
                        </td>
                        <td className="px-6 py-4 font-black text-blue-600">{formatCurrency(inv.totalAmount)}</td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => { setCurrentInvoice(inv); setView('preview'); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><FileText size={18} /></button>
                            <button onClick={() => deleteInvoice(inv.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState onCreate={() => setView('create')} />
            )}
          </div>
        )}

        {view === 'preview' && currentInvoice && (
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap items-center justify-between mb-8 gap-4 no-print">
              <button onClick={() => setView('history')} className="text-slate-500 hover:text-slate-800 font-bold flex items-center gap-2">
                <ChevronRight size={18} className="rotate-180" /> Back
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button 
                  onClick={() => handleShareFile('image')}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-200 transition-all shadow-sm"
                >
                  <ImageIcon size={18} /> Share Image
                </button>
                <button 
                  onClick={() => handleShareFile('pdf')}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-200 transition-all shadow-sm"
                >
                  <FileDown size={18} /> Share PDF
                </button>
                <a 
                  href={generateWhatsAppLink(currentInvoice)} 
                  target="_blank" 
                  className="px-4 py-2 bg-[#25D366] text-white rounded-xl font-bold flex items-center gap-2 hover:opacity-90 shadow-sm transition-all"
                >
                  <MessageCircle size={18} /> Send Text
                </a>
              </div>
            </div>

            <div ref={invoiceRef} className="bg-white p-12 md:p-16 rounded-2xl shadow-xl border border-slate-200 relative overflow-hidden">
              {currentInvoice.status === 'paid' && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-12 border-8 border-green-500/30 text-green-500/30 font-black text-8xl px-12 py-6 rounded-3xl pointer-events-none z-10 select-none">
                  PAID
                </div>
              )}

              <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-16 relative z-0">
                <div>
                  <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-3xl mb-4 shadow-xl">T</div>
                  <h1 className="text-3xl font-black text-slate-900">THREM MULTILINKS</h1>
                  <p className="text-blue-600 font-bold tracking-widest uppercase text-sm mb-4">Venture • Cement Depot</p>
                  <div className="text-slate-500 text-xs space-y-1">
                    <p>Main Depot, Enugu, Nigeria</p>
                    <p>+234 812 345 6789</p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <h2 className="text-5xl font-black text-slate-200 mb-4 tracking-tighter">INVOICE</h2>
                  <div className="space-y-2">
                    <div className="flex justify-end gap-4 text-sm">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">Number</span>
                      <span className="font-mono font-bold text-slate-800">{currentInvoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-end gap-4 text-sm">
                      <span className="text-slate-400 font-bold uppercase tracking-wider">Date</span>
                      <span className="font-bold text-slate-800">{new Date(currentInvoice.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-16">
                <h3 className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-2">Bill To</h3>
                <p className="text-2xl font-black text-slate-900 uppercase">{currentInvoice.customer.name}</p>
                <p className="text-slate-600 font-bold text-sm">{currentInvoice.customer.phone}</p>
                {currentInvoice.customer.address && <p className="text-slate-500 text-sm mt-1">{currentInvoice.customer.address}</p>}
              </div>

              <div className="mb-12">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-slate-900">
                      <th className="py-4 text-left font-black text-xs uppercase tracking-widest text-slate-900">Description</th>
                      <th className="py-4 text-center font-black text-xs uppercase tracking-widest text-slate-900">Qty</th>
                      <th className="py-4 text-right font-black text-xs uppercase tracking-widest text-slate-900">Price</th>
                      <th className="py-4 text-right font-black text-xs uppercase tracking-widest text-slate-900">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentInvoice.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-6 font-bold text-slate-900 uppercase text-sm">{item.description}</td>
                        <td className="py-6 text-center font-bold text-slate-700">{item.quantity}</td>
                        <td className="py-6 text-right font-bold text-slate-700">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-6 text-right font-black text-slate-900">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mb-16">
                <div className="w-full md:w-80 space-y-4">
                  <div className="flex justify-between items-center text-slate-500 text-sm">
                    <span className="font-bold uppercase tracking-widest">Subtotal</span>
                    <span className="font-bold">{formatCurrency(currentInvoice.subtotal)}</span>
                  </div>
                  {currentInvoice.discountAmount > 0 && (
                    <div className="flex justify-between items-center text-green-600 text-sm">
                      <span className="font-bold uppercase tracking-widest text-[10px]">Discount ({currentInvoice.discountPercent}%)</span>
                      <span className="font-bold">-{formatCurrency(currentInvoice.discountAmount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center text-slate-500 text-sm">
                    <span className="font-bold uppercase tracking-widest text-[10px]">Delivery</span>
                    <span className="font-bold">{formatCurrency(currentInvoice.deliveryFee)}</span>
                  </div>
                  <div className="pt-4 border-t-2 border-slate-900 flex justify-between items-center">
                    <span className="font-black uppercase text-sm tracking-widest text-slate-900">Total</span>
                    <span className="text-3xl font-black text-blue-600">{formatCurrency(currentInvoice.totalAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-16 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                <div>
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Notes</p>
                  <p className="text-slate-500 text-xs italic font-medium">{currentInvoice.notes || "Goods sold are in good condition. Thank you for your business."}</p>
                </div>
                <div className="text-right">
                  <div className="inline-block border-t border-slate-300 px-12 pt-2">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Signature</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
