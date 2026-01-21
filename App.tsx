import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  History as HistoryIcon, 
  Plus, 
  Trash2, 
  ChevronRight,
  Sparkles,
  User,
  Truck,
  Send,
  Loader2,
  MessageCircle,
  Tag,
  Image as ImageIcon,
  FileDown,
  Mic,
  Square,
  AlertCircle
} from 'lucide-react';
import { Invoice, InvoiceItem, ViewMode } from './types.ts';
import { generateInvoiceNumber, formatCurrency, generateWhatsAppLink } from './utils/format.ts';
import { parseInvoiceInput, parseVoiceInput } from './services/geminiService.ts';

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

const App: React.FC = () => {
  const [view, setView] = useState<ViewMode>('create');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isFileLoading, setIsFileLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const invoiceRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.click();
      }
    } catch (err) {
      console.error("File generation failed:", err);
      alert("Failed to generate file. Try using Print to PDF.");
    } finally {
      setIsFileLoading(false);
    }
  };

  const applyAiResult = (result: any) => {
    if (result) {
      if (result.customer) {
        setCustomerName(result.customer.name || customerName);
        setCustomerPhone(result.customer.phone || customerPhone);
        setCustomerAddress(result.customer.address || customerAddress);
      }
      if (result.items && result.items.length > 0) {
        setItems(result.items.map((item: any, idx: number) => ({
          id: (idx + 1).toString(),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice
        })));
      }
      if (result.deliveryFee !== undefined) setDeliveryFee(result.deliveryFee || 0);
      if (result.notes) setNotes(result.notes);
      return true;
    }
    return false;
  };

  const handleAiAction = async () => {
    if (!aiPrompt.trim() || isAiLoading) return;
    setIsAiLoading(true);
    try {
      const result = await parseInvoiceInput(aiPrompt);
      if (applyAiResult(result)) {
        setAiPrompt("");
      } else {
        alert("AI couldn't extract the details. Please try being more specific (e.g., '50 bags of Dangote to John').");
      }
    } catch (e) {
      alert("Something went wrong with the AI service. Please fill the form manually.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        alert("Microphone access requires a secure connection (HTTPS).");
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            setIsAiLoading(true);
            try {
              const result = await parseVoiceInput(base64Audio, 'audio/webm');
              if (!applyAiResult(result)) {
                alert("Could not extract details from your voice. Please try again or type.");
              }
            } catch (e) {
              alert("Error processing audio. Please try text entry.");
            } finally {
              setIsAiLoading(false);
            }
          };
          stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Mic access failed", err);
        alert("Please enable microphone permissions in your browser settings.");
      }
    }
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      {isFileLoading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-blue-600 mb-4" size={48} />
          <p className="font-bold text-slate-800">Generating Invoice...</p>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-4 md:px-8 no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Logo />
          <nav className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
            <button onClick={() => setView('create')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'create' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Plus size={18} /> New
            </button>
            <button onClick={() => setView('history')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${view === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
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
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="text-blue-600" size={20} />
                    <h2 className="text-lg font-bold text-slate-800">Smart Order Entry</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{isRecording ? 'Listening...' : 'Record Voice'}</span>
                    <button 
                      onClick={toggleRecording}
                      disabled={isAiLoading}
                      className={`p-3 rounded-full transition-all shadow-md active:scale-90 ${isRecording ? 'bg-red-500 text-white recording-pulse' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                    >
                      {isRecording ? <Square size={20} /> : <Mic size={20} />}
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="E.g., 100 bags of BUA cement to Alhaji Musa 08030000000, address is Bala Road. Delivery ₦20k."
                    className="w-full p-4 pr-14 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none min-h-[120px] resize-none text-slate-900 shadow-inner"
                  />
                  <button 
                    onClick={handleAiAction}
                    disabled={isAiLoading || !aiPrompt.trim()}
                    className="absolute bottom-4 right-4 bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95 shadow-lg"
                  >
                    {isAiLoading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
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
                      <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 text-slate-900 outline-none" placeholder="Enter name" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase">Phone Number</label>
                      <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 text-slate-900 outline-none" placeholder="080XXXXXXXX" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Delivery Address</label>
                    <input type="text" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 text-slate-900 outline-none" placeholder="House/Site Address" />
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="text-slate-400" size={18} />
                      <h3 className="font-bold text-slate-700">Order Items</h3>
                    </div>
                    <button onClick={addItem} className="text-sm font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700"><Plus size={16} /> Add More</button>
                  </div>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.id} className="flex flex-col md:flex-row gap-3 items-end md:items-center bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-sm">
                        <div className="flex-1 w-full space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Product Description</label>
                          <input type="text" value={item.description} onChange={(e) => updateItem(item.id!, 'description', e.target.value)} className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 outline-none" placeholder="e.g. Dangote Cement 42.5R" />
                        </div>
                        <div className="w-full md:w-24 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Bags</label>
                          <input type="number" value={item.quantity} onChange={(e) => updateItem(item.id!, 'quantity', parseInt(e.target.value) || 0)} className="w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 outline-none" />
                        </div>
                        <div className="w-full md:w-40 space-y-1">
                          <label className="text-[10px] font-bold text-slate-400 uppercase">Price per Bag</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">₦</span>
                            <input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id!, 'unitPrice', parseInt(e.target.value) || 0)} className="w-full pl-7 pr-3 py-2 rounded-lg bg-white border border-slate-200 text-slate-900 outline-none font-bold" />
                          </div>
                        </div>
                        <button onClick={() => removeItem(item.id!)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={20} /></button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-6 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <div className="space-y-4">
                          <div className="flex items-center gap-2 border-b border-slate-100 pb-2"><Truck className="text-slate-400" size={18} /><h3 className="font-bold text-slate-700">Shipping & Logistics</h3></div>
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">Delivery / Loading Fee</label>
                            <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₦</span>
                              <input type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(parseInt(e.target.value) || 0)} className="w-full pl-8 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 outline-none font-bold" />
                            </div>
                          </div>
                       </div>
                    </div>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b border-slate-100 pb-2"><FileText className="text-slate-400" size={18} /><h3 className="font-bold text-slate-700">Special Notes</h3></div>
                      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 min-h-[120px] outline-none shadow-inner" placeholder="Any special instructions..." />
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-200 sticky top-28">
                <h2 className="text-xl font-black text-slate-800 mb-6 pb-4 border-b border-slate-100 uppercase tracking-tighter">Order Summary</h2>
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between text-slate-500 font-medium"><span>Subtotal</span><span className="font-bold text-slate-800">{formatCurrency(totals.subtotal)}</span></div>
                  <div className="flex justify-between text-slate-500 font-medium"><span>Delivery</span><span className="font-bold text-slate-800">{formatCurrency(deliveryFee)}</span></div>
                  <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
                    <span className="text-lg font-black text-slate-800 uppercase tracking-widest">Total</span>
                    <span className="text-3xl font-black text-blue-600 tracking-tighter">{formatCurrency(totals.total)}</span>
                  </div>
                </div>
                <button 
                  onClick={handleCreateInvoice} 
                  disabled={!customerName || items.some(i => !i.description)} 
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-4 rounded-2xl font-black text-lg shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <FileText size={24} /> Create Invoice
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between"><h2 className="text-xl font-bold text-slate-800">Invoice History</h2></div>
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
                        <td className="px-6 py-4"><div className="font-black text-slate-800 uppercase">{inv.customer.name}</div></td>
                        <td className="px-6 py-4 font-black text-blue-600">{formatCurrency(inv.totalAmount)}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => { setCurrentInvoice(inv); setView('preview'); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><FileText size={20} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-20 text-center text-slate-400 font-medium">No invoices created yet.</div>
            )}
          </div>
        )}

        {view === 'preview' && currentInvoice && (
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap items-center justify-between mb-8 gap-4 no-print">
              <button onClick={() => setView('history')} className="text-slate-500 hover:text-slate-800 font-black flex items-center gap-2 uppercase tracking-widest text-sm">
                <ChevronRight size={18} className="rotate-180" /> Back to History
              </button>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => handleShareFile('image')} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-200 transition-all shadow-sm"><ImageIcon size={18} /> Share Image</button>
                <button onClick={() => handleShareFile('pdf')} className="px-5 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold flex items-center gap-2 hover:bg-slate-200 transition-all shadow-sm"><FileDown size={18} /> Share PDF</button>
                <a href={generateWhatsAppLink(currentInvoice)} target="_blank" className="px-5 py-2.5 bg-[#25D366] text-white rounded-xl font-black flex items-center gap-2 hover:opacity-90 shadow-md transition-all"><MessageCircle size={18} /> Send to WhatsApp</a>
              </div>
            </div>

            <div ref={invoiceRef} className="bg-white p-12 md:p-16 rounded-3xl shadow-2xl border border-slate-200 relative overflow-hidden">
              <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-16 relative z-10">
                <div>
                  <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white font-black text-4xl mb-6 shadow-xl shadow-blue-100">T</div>
                  <h1 className="text-3xl font-black text-slate-900 tracking-tighter">THREM MULTILINKS</h1>
                  <p className="text-blue-600 font-black tracking-[0.2em] uppercase text-xs mb-6">Venture • Cement Depot</p>
                  <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest space-y-2 max-w-xs leading-relaxed">
                    <p>Opposite Cam Abioye Estate, Along Bala Road, Eyenkorin, Ilorin, Kwara State</p>
                    <p className="text-slate-800">+234 916 043 1994, +234 913 044 1381</p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end">
                  <h2 className="text-7xl font-black text-slate-100 mb-6 tracking-tighter uppercase leading-none">Invoice</h2>
                  <div className="space-y-3">
                    <div className="flex justify-end gap-6 text-xs font-black uppercase tracking-widest">
                      <span className="text-slate-400">Ref Number</span>
                      <span className="text-slate-800 font-mono">{currentInvoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-end gap-6 text-xs font-black uppercase tracking-widest">
                      <span className="text-slate-400">Date Issued</span>
                      <span className="text-slate-800">{new Date(currentInvoice.date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mb-16 bg-slate-50 p-8 rounded-3xl border border-slate-100">
                <h3 className="text-slate-400 font-black uppercase tracking-widest text-[10px] mb-3">Bill To Customer</h3>
                <p className="text-3xl font-black text-slate-900 uppercase tracking-tighter">{currentInvoice.customer.name}</p>
                <p className="text-blue-600 font-black text-sm tracking-widest mt-1">{currentInvoice.customer.phone}</p>
                {currentInvoice.customer.address && <p className="text-slate-500 text-xs font-bold uppercase mt-2 tracking-wide leading-relaxed">{currentInvoice.customer.address}</p>}
              </div>

              <div className="mb-12">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-4 border-slate-900">
                      <th className="py-5 text-left font-black text-[10px] uppercase tracking-[0.2em] text-slate-900">Description of Goods</th>
                      <th className="py-5 text-center font-black text-[10px] uppercase tracking-[0.2em] text-slate-900">Qty</th>
                      <th className="py-5 text-right font-black text-[10px] uppercase tracking-[0.2em] text-slate-900">Unit Price</th>
                      <th className="py-5 text-right font-black text-[10px] uppercase tracking-[0.2em] text-slate-900">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentInvoice.items.map((item, idx) => (
                      <tr key={idx} className="group">
                        <td className="py-8 font-black text-slate-900 uppercase text-sm">{item.description}</td>
                        <td className="py-8 text-center font-black text-slate-700">{item.quantity}</td>
                        <td className="py-8 text-right font-bold text-slate-700">{formatCurrency(item.unitPrice)}</td>
                        <td className="py-8 text-right font-black text-slate-900">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end mb-16">
                <div className="w-full md:w-96 space-y-5">
                  <div className="flex justify-between items-center text-slate-500 text-xs font-black uppercase tracking-widest">
                    <span>Subtotal</span>
                    <span>{formatCurrency(currentInvoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-slate-500 text-xs font-black uppercase tracking-widest">
                    <span>Delivery Fee</span>
                    <span>{formatCurrency(currentInvoice.deliveryFee)}</span>
                  </div>
                  <div className="pt-6 border-t-4 border-slate-900 flex justify-between items-center">
                    <span className="font-black uppercase text-sm tracking-[0.3em] text-slate-900">Grand Total</span>
                    <span className="text-4xl font-black text-blue-600 tracking-tighter">{formatCurrency(currentInvoice.totalAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="pt-16 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Terms & Conditions</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase leading-relaxed max-w-xs">
                    Goods sold in good condition are not returnable. This invoice serves as proof of purchase and agreement of delivery terms.
                  </p>
                </div>
                <div className="text-right flex flex-col items-end justify-end">
                   <div className="w-48 border-b-2 border-slate-200 mb-2"></div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Authorized Signature</p>
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