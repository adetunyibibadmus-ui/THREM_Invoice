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
  CheckCircle2,
  XCircle,
  Clock
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
      <h1 className="font-bold text-slate-800 leading-tight tracking-tight uppercase">THREM MULTILINKS</h1>
      <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase">Venture • Cement Depot</p>
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
  // Fix: Added missing useState hook call for customerAddress state initialization
  const [customerAddress, setCustomerAddress] = useState("");
  const [items, setItems] = useState<Partial<InvoiceItem>[]>([{ id: '1', description: '', quantity: 1, unitPrice: 0 }]);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem('threm_invoices');
    if (saved) {
      try { setInvoices(JSON.parse(saved)); } catch (e) { console.error(e); }
    }
  }, []);

  const saveToHistory = (newInvoice: Invoice) => {
    const updated = [newInvoice, ...invoices];
    setInvoices(updated);
    localStorage.setItem('threm_invoices', JSON.stringify(updated));
  };

  const updateInvoiceStatus = (id: string, newStatus: 'paid' | 'pending' | 'cancelled') => {
    const updated = invoices.map(inv => inv.id === id ? { ...inv, status: newStatus } : inv);
    setInvoices(updated);
    localStorage.setItem('threm_invoices', JSON.stringify(updated));
    if (currentInvoice?.id === id) {
      setCurrentInvoice({ ...currentInvoice, status: newStatus });
    }
  };

  const addItem = () => {
    setItems([...items, { id: Math.random().toString(), description: '', quantity: 1, unitPrice: 0 }]);
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeItem = (id: string) => {
    if (items.length > 1) setItems(items.filter(item => item.id !== id));
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
      // Small timeout to ensure status stamps are fully rendered before capture
      await new Promise(r => setTimeout(r, 200));

      const canvas = await html2canvas(invoiceRef.current, { 
        scale: 2, 
        useCORS: true, 
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc: Document) => {
          // Ensure the watermark is visible in the clone
          const watermark = clonedDoc.querySelector('.watermark-container');
          if (watermark) (watermark as HTMLElement).style.display = 'flex';
        }
      });

      let file: File;
      if (format === 'image') {
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob(resolve, 'image/png'));
        file = new File([blob], `Invoice-${currentInvoice.invoiceNumber}.png`, { type: 'image/png' });
      } else {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jspdf.jsPDF({ orientation: 'portrait', unit: 'px', format: [canvas.width, canvas.height] });
        pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
        const pdfBlob = pdf.output('blob');
        file = new File([pdfBlob], `Invoice-${currentInvoice.invoiceNumber}.pdf`, { type: 'application/pdf' });
      }

      if (navigator.share) {
        await navigator.share({ files: [file], title: `Invoice ${currentInvoice.invoiceNumber}`, text: `Invoice for ${currentInvoice.customer.name}` });
      } else {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.name;
        link.click();
      }
    } catch (err) { alert("Sharing failed. You can still screenshot or use Print."); } finally { setIsFileLoading(false); }
  };

  const applyAiResult = (result: any) => {
    if (!result) return false;
    if (result.customer) {
      if (result.customer.name) setCustomerName(result.customer.name);
      if (result.customer.phone) setCustomerPhone(result.customer.phone);
      if (result.customer.address) setCustomerAddress(result.customer.address);
    }
    if (result.items && Array.isArray(result.items) && result.items.length > 0) {
      setItems(result.items.map((item: any, idx: number) => ({
        id: (idx + 1).toString(),
        description: item.description || '',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0
      })));
    }
    if (result.deliveryFee !== undefined) setDeliveryFee(result.deliveryFee || 0);
    if (result.discountPercent !== undefined) setDiscountPercent(result.discountPercent || 0);
    if (result.notes) setNotes(result.notes);
    return true;
  };

  const handleAiAction = async () => {
    if (!aiPrompt.trim() || isAiLoading) return;
    setIsAiLoading(true);
    try {
      const result = await parseInvoiceInput(aiPrompt);
      if (applyAiResult(result)) setAiPrompt("");
      else alert("AI couldn't find clear order details. Try adding brand and bag count.");
    } catch (e: any) { alert("Smart entry service error. Please try again or type manually."); } finally { setIsAiLoading(false); }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = ['audio/webm', 'audio/mp4', 'audio/wav'].find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm';
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            setIsAiLoading(true);
            try {
              const result = await parseVoiceInput(base64Audio, mimeType);
              if (!applyAiResult(result)) alert("Voice note wasn't clear. Please try again.");
            } catch (e) { alert("Could not process voice entry."); } finally { setIsAiLoading(false); }
          };
          stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) { alert("Microphone access denied."); }
    }
  };

  const totals = calculateTotals();

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 md:pb-0 font-sans">
      {isFileLoading && (
        <div className="fixed inset-0 bg-white/90 backdrop-blur-md z-[100] flex flex-col items-center justify-center">
          <Loader2 className="animate-spin text-blue-600 mb-4" size={56} />
          <p className="font-black text-slate-900 tracking-tighter text-xl">GENERATING DOCUMENT...</p>
        </div>
      )}

      <header className="sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-4 md:px-8 no-print shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Logo />
          <nav className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl">
            <button onClick={() => setView('create')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${view === 'create' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              <Plus size={18} /> NEW ORDER
            </button>
            <button onClick={() => setView('history')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-black transition-all ${view === 'history' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>
              <HistoryIcon size={18} /> RECORDS
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {view === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-white">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-inner"><Sparkles size={20} /></div>
                    <h2 className="text-xl font-black text-slate-800 tracking-tighter uppercase">Smart Entry</h2>
                  </div>
                  <button onClick={toggleRecording} disabled={isAiLoading} className={`p-4 rounded-3xl transition-all shadow-xl active:scale-95 ${isRecording ? 'bg-red-500 text-white recording-pulse' : 'bg-blue-600 text-white hover:bg-blue-700'}`}>
                    {isRecording ? <Square size={24} /> : <Mic size={24} />}
                  </button>
                </div>
                <div className="relative group">
                  <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Type or record order... e.g. 'Alhaji Musa needs 100 bags of BUA at Bala Road, delivery is 20k'" className="w-full p-6 pr-16 bg-slate-50 border-2 border-transparent group-focus-within:border-blue-100 rounded-[1.5rem] transition-all outline-none min-h-[160px] resize-none text-slate-800 font-medium placeholder:text-slate-300 shadow-inner" />
                  <button onClick={handleAiAction} disabled={isAiLoading || !aiPrompt.trim()} className="absolute bottom-6 right-6 bg-blue-600 text-white p-4 rounded-2xl hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95 shadow-lg shadow-blue-200">
                    {isAiLoading ? <Loader2 className="animate-spin" size={24} /> : <Send size={24} />}
                  </button>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-white space-y-12">
                <section className="space-y-6">
                  <div className="flex items-center gap-3 border-b border-slate-50 pb-4"><User className="text-blue-600" size={22} /><h3 className="font-black text-slate-800 tracking-tight uppercase text-sm">Customer Info</h3></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                      <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-800" placeholder="e.g. Alhaji Ibrahim" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Phone Number</label>
                      <input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-800" placeholder="080XXXXXXXX" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Address / Site</label>
                    <input type="text" value={customerAddress} onChange={(e) => setCustomerAddress(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-bold text-slate-800" placeholder="Delivery Address" />
                  </div>
                </section>

                <section className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-50 pb-4">
                    <div className="flex items-center gap-3"><FileText className="text-blue-600" size={22} /><h3 className="font-black text-slate-800 tracking-tight uppercase text-sm">Products</h3></div>
                    <button onClick={addItem} className="text-xs font-black text-blue-600 flex items-center gap-1 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-xl"><Plus size={16} /> ADD MORE</button>
                  </div>
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div key={item.id} className="flex flex-col md:flex-row gap-4 items-end md:items-center bg-slate-50/50 p-6 rounded-3xl border-2 border-slate-50 hover:border-blue-50 transition-all">
                        <div className="flex-1 w-full space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Brand</label>
                          <input type="text" value={item.description} onChange={(e) => updateItem(item.id!, 'description', e.target.value)} className="w-full px-4 py-3 rounded-xl bg-white border border-slate-100 text-slate-800 font-bold outline-none shadow-inner" placeholder="Dangote, BUA, etc." />
                        </div>
                        <div className="w-full md:w-28 space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bags</label>
                          <input type="number" value={item.quantity} onChange={(e) => updateItem(item.id!, 'quantity', parseInt(e.target.value) || 0)} className="w-full px-4 py-3 rounded-xl bg-white border border-slate-100 text-slate-800 font-black outline-none" />
                        </div>
                        <div className="w-full md:w-44 space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Price/Bag</label>
                          <div className="relative"><span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 font-black">₦</span>
                          <input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id!, 'unitPrice', parseInt(e.target.value) || 0)} className="w-full pl-8 pr-4 py-3 rounded-xl bg-white border border-slate-100 text-slate-800 font-black outline-none" /></div>
                        </div>
                        <button onClick={() => removeItem(item.id!)} className="p-3 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl"><Trash2 size={22} /></button>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-50 pb-4"><Truck className="text-blue-600" size={22} /><h3 className="font-black text-slate-800 tracking-tight uppercase text-sm">Adjustments</h3></div>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Delivery / Loading Fee</label>
                        <div className="relative mt-2"><span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 font-black">₦</span>
                        <input type="number" value={deliveryFee} onChange={(e) => setDeliveryFee(parseInt(e.target.value) || 0)} className="w-full pl-10 pr-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-black text-slate-800" /></div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Discount (%)</label>
                        <div className="relative mt-2"><span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-300 font-black">%</span>
                        <input type="number" value={discountPercent} onChange={(e) => setDiscountPercent(parseInt(e.target.value) || 0)} className="w-full px-6 py-4 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all outline-none font-black text-slate-800" placeholder="0" /></div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-6">
                    <div className="flex items-center gap-3 border-b border-slate-50 pb-4"><Tag className="text-blue-600" size={22} /><h3 className="font-black text-slate-800 tracking-tight uppercase text-sm">Notes</h3></div>
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-6 py-4 mt-2 rounded-2xl bg-slate-50 border-2 border-transparent focus:border-blue-500 focus:bg-white transition-all min-h-[140px] outline-none font-medium text-slate-700 shadow-inner" placeholder="Any special remarks..." />
                  </div>
                </section>
              </div>
            </div>

            <div className="lg:col-span-1">
              <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-white sticky top-28">
                <h2 className="text-2xl font-black text-slate-900 mb-8 pb-4 border-b border-slate-50 uppercase">Summary</h2>
                <div className="space-y-6 mb-10">
                  <div className="flex justify-between text-slate-400 font-bold text-[10px] uppercase tracking-widest"><span>Subtotal</span><span className="text-slate-800 font-black">{formatCurrency(totals.subtotal)}</span></div>
                  <div className="flex justify-between text-slate-400 font-bold text-[10px] uppercase tracking-widest"><span>Logistics</span><span className="text-slate-800 font-black">{formatCurrency(deliveryFee)}</span></div>
                  {totals.discountAmount > 0 && (
                    <div className="flex justify-between text-red-500 font-bold text-[10px] uppercase tracking-widest"><span>Discount</span><span>-{formatCurrency(totals.discountAmount)}</span></div>
                  )}
                  <div className="pt-6 border-t-2 border-slate-900 flex justify-between items-center">
                    <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Grand Total</span>
                    <span className="text-4xl font-black text-blue-600 tracking-tighter">{formatCurrency(totals.total)}</span>
                  </div>
                </div>
                <button onClick={handleCreateInvoice} disabled={!customerName || items.some(i => !i.description)} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-5 rounded-[1.5rem] font-black text-lg transition-all flex items-center justify-center gap-3 uppercase shadow-xl shadow-blue-100">
                  <FileText size={24} /> Generate Invoice
                </button>
              </div>
            </div>
          </div>
        )}

        {view === 'history' && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-white overflow-hidden">
            <div className="p-10 border-b border-slate-50 flex items-center justify-between"><h2 className="text-2xl font-black text-slate-900 uppercase">Records History</h2></div>
            {invoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-slate-50">
                    {invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-10 py-8">
                          <div className="font-mono text-xs font-black text-slate-400 group-hover:text-blue-600 uppercase">{inv.invoiceNumber}</div>
                          <div className="text-[10px] text-slate-300 font-black mt-1 uppercase">{new Date(inv.date).toLocaleDateString()}</div>
                        </td>
                        <td className="px-10 py-8">
                          <div className="font-black text-slate-900 uppercase text-lg">{inv.customer.name}</div>
                          <div className="flex items-center gap-2 mt-1">
                            {inv.status === 'paid' && <span className="flex items-center gap-1 text-[9px] font-black uppercase text-green-500"><CheckCircle2 size={10}/> PAID</span>}
                            {inv.status === 'pending' && <span className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-500"><Clock size={10}/> PENDING</span>}
                            {inv.status === 'cancelled' && <span className="flex items-center gap-1 text-[9px] font-black uppercase text-red-400"><XCircle size={10}/> CANCELLED</span>}
                          </div>
                        </td>
                        <td className="px-10 py-8 font-black text-blue-600 text-xl tracking-tighter">{formatCurrency(inv.totalAmount)}</td>
                        <td className="px-10 py-8 text-right">
                          <button onClick={() => { setCurrentInvoice(inv); setView('preview'); }} className="p-4 text-blue-600 bg-blue-50/50 hover:bg-blue-600 hover:text-white rounded-2xl transition-all shadow-sm"><FileText size={24} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-24 text-center text-slate-300 font-black uppercase text-xs">Empty Database</div>
            )}
          </div>
        )}

        {view === 'preview' && currentInvoice && (
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-wrap items-center justify-between mb-10 gap-4 no-print">
              <button onClick={() => setView('history')} className="text-slate-400 hover:text-slate-900 font-black flex items-center gap-2 uppercase tracking-widest text-[10px] transition-colors"><ChevronRight size={18} className="rotate-180" /> RETURN TO LIST</button>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-2xl p-1 shadow-sm">
                  <button onClick={() => updateInvoiceStatus(currentInvoice.id, 'paid')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${currentInvoice.status === 'paid' ? 'bg-green-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>PAID</button>
                  <button onClick={() => updateInvoiceStatus(currentInvoice.id, 'pending')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${currentInvoice.status === 'pending' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}>PENDING</button>
                </div>
                <button onClick={() => handleShareFile('image')} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200"><ImageIcon size={18} /> SAVE IMAGE</button>
                <button onClick={() => handleShareFile('pdf')} className="px-6 py-3 bg-slate-100 text-slate-700 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 hover:bg-slate-200"><FileDown size={18} /> SAVE PDF</button>
                <a href={generateWhatsAppLink(currentInvoice)} target="_blank" className="px-8 py-3 bg-[#25D366] text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-[#25D366]/20"><MessageCircle size={18} /> WHATSAPP</a>
              </div>
            </div>

            <div ref={invoiceRef} className="bg-white p-16 md:p-24 rounded-[3rem] shadow-2xl border border-slate-100 relative overflow-hidden">
              {/* PAID Watermark - Now Centered and Highly Visible in Background */}
              {currentInvoice.status === 'paid' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 watermark-container">
                  <div className="border-[15px] md:border-[25px] border-green-500/15 text-green-500/15 font-black text-[10rem] md:text-[20rem] -rotate-[25deg] uppercase tracking-[0.1em] whitespace-nowrap select-none">
                    PAID
                  </div>
                </div>
              )}
              
              {currentInvoice.status === 'cancelled' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 watermark-container">
                  <div className="border-[15px] md:border-[25px] border-red-500/10 text-red-500/10 font-black text-[8rem] md:text-[15rem] -rotate-[25deg] uppercase tracking-[0.1em] whitespace-nowrap select-none">
                    VOID
                  </div>
                </div>
              )}
              
              <div className="relative z-10">
                <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-20 relative z-10">
                  <div>
                    <div className="w-24 h-24 bg-blue-600 rounded-[2rem] flex items-center justify-center text-white font-black text-5xl mb-8 shadow-2xl shadow-blue-200">T</div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2 uppercase">THREM MULTILINKS</h1>
                    <p className="text-blue-600 font-black tracking-[0.4em] uppercase text-[10px] mb-8">Venture • Cement Depot</p>
                    <div className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] space-y-3 leading-relaxed">
                      <p>Opposite Cam Abioye Estate, Bala Road, Eyenkorin, Ilorin, Kwara State</p>
                      <p className="text-slate-900 font-bold">+234 916 043 1994, +234 913 044 1381</p>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <h2 className="text-8xl font-black text-slate-50 mb-8 uppercase opacity-30 leading-none">INVOICE</h2>
                    <div className="space-y-4">
                      <div className="flex justify-end gap-8 text-[10px] font-black uppercase tracking-widest"><span className="text-slate-300">REF:</span><span className="text-slate-900 font-mono text-lg">{currentInvoice.invoiceNumber}</span></div>
                      <div className="flex justify-end gap-8 text-[10px] font-black uppercase tracking-widest"><span className="text-slate-300">DATE:</span><span className="text-slate-900 text-lg">{new Date(currentInvoice.date).toLocaleDateString()}</span></div>
                    </div>
                  </div>
                </div>

                <div className="mb-20 bg-white/60 backdrop-blur-sm p-10 rounded-[2rem] border border-slate-50 shadow-sm">
                  <h3 className="text-slate-300 font-black uppercase tracking-widest text-[10px] mb-4">BILL TO</h3>
                  <p className="text-4xl font-black text-slate-900 uppercase tracking-tighter">{currentInvoice.customer.name}</p>
                  <p className="text-blue-600 font-black text-sm tracking-[0.2em] mt-2">{currentInvoice.customer.phone}</p>
                  {currentInvoice.customer.address && <p className="text-slate-400 text-xs font-black uppercase mt-4 tracking-widest leading-relaxed">{currentInvoice.customer.address}</p>}
                </div>

                <div className="mb-16">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b-[6px] border-slate-900">
                        <th className="py-6 text-left font-black text-[10px] uppercase tracking-[0.3em] text-slate-900">Items</th>
                        <th className="py-6 text-center font-black text-[10px] uppercase tracking-[0.3em] text-slate-900">Qty</th>
                        <th className="py-6 text-right font-black text-[10px] uppercase tracking-[0.3em] text-slate-900">Price</th>
                        <th className="py-6 text-right font-black text-[10px] uppercase tracking-[0.3em] text-slate-900">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentInvoice.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-10 font-black text-slate-900 uppercase text-lg tracking-tight">{item.description}</td>
                          <td className="py-10 text-center font-black text-slate-600 text-lg">{item.quantity}</td>
                          <td className="py-10 text-right font-bold text-slate-600 text-lg">{formatCurrency(item.unitPrice)}</td>
                          <td className="py-10 text-right font-black text-slate-900 text-xl tracking-tighter">{formatCurrency(item.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end mb-24">
                  <div className="w-full md:w-[400px] space-y-6 bg-white/40 p-6 rounded-2xl">
                    <div className="flex justify-between items-center text-slate-400 text-[10px] font-black uppercase tracking-widest"><span>Subtotal</span><span>{formatCurrency(currentInvoice.subtotal)}</span></div>
                    <div className="flex justify-between items-center text-slate-400 text-[10px] font-black uppercase tracking-widest"><span>Logistics</span><span>{formatCurrency(currentInvoice.deliveryFee)}</span></div>
                    {currentInvoice.discountAmount > 0 && (
                      <div className="flex justify-between items-center text-red-400 text-[10px] font-black uppercase tracking-widest"><span>Discount</span><span>-{formatCurrency(currentInvoice.discountAmount)}</span></div>
                    )}
                    <div className="pt-8 border-t-[6px] border-slate-900 flex justify-between items-center">
                      <span className="font-black uppercase text-xs tracking-widest text-slate-900">Grand Total</span>
                      <span className="text-5xl font-black text-blue-600 tracking-tighter">{formatCurrency(currentInvoice.totalAmount)}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-20 border-t-2 border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-20">
                  <div className="space-y-6 text-slate-300">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em]">Policy</p>
                    <p className="text-[10px] font-black uppercase leading-relaxed max-w-sm tracking-widest">NO REFUND FOR CEMENT SOLD IN GOOD CONDITION. THANK YOU FOR CHOOSING THREM.</p>
                  </div>
                  <div className="text-right flex flex-col items-end justify-end">
                    <div className="w-64 border-b-4 border-slate-100 mb-4"></div>
                    <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Sign & Stamp</p>
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
