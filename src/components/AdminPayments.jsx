import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

export const SUPPORTED_CURRENCIES = ['IDR', 'USD', 'SGD', 'MYR', 'EUR', 'AUD', 'GBP', 'JPY'];
export const B2B_PACKAGES = ['Standard', 'Featured Job', 'Paid placement'];
const B2B_COLUMNS = 'id,company,package,status,amount_paid,currency,paid_at,transaction_id,created_at';
const OUTBOX_COLUMNS = 'transaction_id,delivery_status';

export function validatePaymentAmount(value, currency = 'IDR') {
  const text = String(value ?? '').trim();
  if (!/^\d+(?:\.\d+)?$/.test(text)) return false;
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1e12) return false;
  const decimals = (text.split('.')[1] || '').length;
  return currency === 'JPY' ? decimals === 0 : decimals <= 2;
}

const paymentLabel = (order) => order.amount_paid == null ? 'Belum dibayar' : `${order.currency || 'IDR'} ${Number(order.amount_paid).toLocaleString('id-ID')}`;
const dateLabel = (value) => value ? new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const orderKey = (kind, id) => `${kind}:${id}`;

async function sendPurchaseAnalytics(transactionId) {
  if (!transactionId) return { status: 'unknown', message: 'Transaksi belum memiliki ID.' };
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return { status: 'uncertain', message: 'Sesi admin tidak tersedia.' };
    const response = await fetch('/api/purchase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ transaction_id: transactionId }),
    });
    const body = await response.json().catch(() => ({}));
    // API status is authoritative even on 503 (notably pending/missing config).
    return { ...body, status: body?.status || (response.ok ? 'unknown' : 'uncertain') };
  } catch {
    return { status: 'uncertain', message: 'Analitik belum dapat diperiksa.' };
  }
}

const AnalyticsStatus = ({ value, onSend, busy }) => {
  if (!value) return null;
  const statusText = { sent: 'Diterima endpoint GA4', already_processed: 'Sudah diterima endpoint GA4', pending: 'Analitik menunggu diproses', uncertain: 'Status pengiriman tidak pasti (investigasi manual)', unknown: 'Status pengiriman belum diketahui' }[value] || 'Status analitik tidak diketahui';
  const canInvestigate = value === 'pending' || value === 'unknown';
  return <span className="block text-[11px] text-slate-500">{statusText}{canInvestigate && <button type="button" onClick={onSend} disabled={busy} className="ml-2 font-bold text-teal hover:underline disabled:opacity-50">Periksa</button>}</span>;
};

const PaidForm = ({ order, busy, onPaid }) => {
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(order.currency || 'IDR');
  if (order.paid_at) return <div className="text-xs"><div className="font-bold text-emerald-700">Lunas · {paymentLabel(order)}</div><div className="text-slate-500">{dateLabel(order.paid_at)}</div></div>;
  return <form onSubmit={(event) => { event.preventDefault(); onPaid(order, amount, currency); }} className="flex flex-wrap items-end gap-2">
    <label className="text-[11px] font-semibold text-slate-600">Jumlah<input aria-label={`Jumlah pembayaran ${order.id}`} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Jumlah aktual" className="mt-1 block w-28 rounded border border-slate-300 px-2 py-1.5 text-xs" /></label>
    <label className="text-[11px] font-semibold text-slate-600">Mata uang<select aria-label={`Mata uang ${order.id}`} value={currency} onChange={(event) => setCurrency(event.target.value)} className="mt-1 block rounded border border-slate-300 px-2 py-1.5 text-xs">{SUPPORTED_CURRENCIES.map((item) => <option key={item}>{item}</option>)}</select></label>
    <button type="submit" disabled={busy} className="rounded bg-teal px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{busy ? 'Menyimpan…' : 'Tandai Lunas'}</button>
  </form>;
};

export default function AdminPayments({ cvOrders = [], onRefreshCV }) {
  const [b2bOrders, setB2bOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [analytics, setAnalytics] = useState({});
  const [company, setCompany] = useState('');
  const [packageName, setPackageName] = useState(B2B_PACKAGES[0]);
  const requestVersion = useRef(0);
  const busyKeys = useRef(new Set());

  const beginBusy = useCallback((key) => {
    if (busyKeys.current.has(key)) return false;
    busyKeys.current.add(key); setBusyId(key); return true;
  }, []);
  const endBusy = useCallback((key) => { busyKeys.current.delete(key); setBusyId((current) => current === key ? null : current); }, []);

  const loadDeliveryStatuses = useCallback(async (orders) => {
    const transactionIds = [...new Set(orders.filter((order) => order.paid_at && order.transaction_id).map((order) => order.transaction_id))];
    if (!transactionIds.length) return;
    try {
      const { data, error } = await supabase.from('purchase_outbox').select('transaction_id,delivery_status').in('transaction_id', transactionIds).limit(200);
      if (error) throw error;
      const byTransaction = Object.fromEntries((data || []).map((item) => [item.transaction_id, item.delivery_status]));
      setAnalytics((current) => {
        const next = { ...current };
        orders.forEach((order) => { if (order.paid_at && order.transaction_id) next[orderKey(order.__kind, order.id)] = byTransaction[order.transaction_id] || 'unknown'; });
        return next;
      });
    } catch { /* Outbox is an audit read; payment display remains usable when unavailable. */ }
  }, []);

  const loadB2B = useCallback(async () => {
    const version = ++requestVersion.current; setLoading(true);
    try {
      const { data, error } = await supabase.from('b2b_orders').select(B2B_COLUMNS).order('created_at', { ascending: false }).limit(100);
      if (version !== requestVersion.current) return;
      if (error) throw error;
      const orders = (Array.isArray(data) ? data : []).map((order) => ({ ...order, __kind: 'b2b' }));
      setB2bOrders(orders); await loadDeliveryStatuses([...cvOrders.map((order) => ({ ...order, __kind: 'cv' })), ...orders]);
    } catch { if (version === requestVersion.current) { setB2bOrders([]); toast.error('Pesanan B2B belum dapat dimuat.'); } }
    finally { if (version === requestVersion.current) setLoading(false); }
  }, [cvOrders, loadDeliveryStatuses]);

  useEffect(() => { loadB2B(); return () => { requestVersion.current += 1; setB2bOrders([]); }; }, [loadB2B]);
  useEffect(() => { loadDeliveryStatuses(cvOrders.map((order) => ({ ...order, __kind: 'cv' }))); }, [cvOrders, loadDeliveryStatuses]);

  const markPaid = async (order, amount, currency) => {
    const key = orderKey(order.__kind, order.id);
    if (order.paid_at || !validatePaymentAmount(amount, currency)) { if (!order.paid_at) toast.error(currency === 'JPY' ? 'Masukkan jumlah JPY bulat yang valid (maksimal 1 triliun).' : 'Masukkan jumlah positif yang valid (maksimal 2 desimal dan 1 triliun).'); return; }
    if (!beginBusy(key)) return;
    let saved = false;
    try {
      const { data, error } = await supabase.from(order.__kind === 'cv' ? 'cv_orders' : 'b2b_orders').update({ status: 'Lunas', amount_paid: Number(amount), currency }).eq('id', order.id).select('id,transaction_id,paid_at').single();
      if (error || !data) throw error || new Error('not saved');
      saved = true;
      toast.success('Pembayaran tersimpan sebagai Lunas.');
      // Trigger delivery only after the trusted database transition succeeds.
      // Refresh/render never sends a purchase, and an uncertain attempt is not retried.
      const result = await sendPurchaseAnalytics(data.transaction_id);
      setAnalytics((current) => ({ ...current, [key]: result.status }));
      if (result.status === 'sent') toast.success('Diterima endpoint GA4 (HTTP 2xx; bukan bukti reporting).');
      else if (result.status !== 'already_processed') toast('Pembayaran tersimpan; pengiriman analitik menunggu konfigurasi atau pemeriksaan.');
      if (order.__kind === 'cv') await onRefreshCV?.(); else await loadB2B();
    } catch { toast.error(saved ? 'Pembayaran tersimpan; segarkan untuk memeriksa status analitik.' : 'Pembayaran belum tersimpan. Periksa izin admin dan koneksi.'); }
    finally { endBusy(key); }
  };

  const resend = async (order) => {
    const key = orderKey(order.__kind, order.id);
    if (!beginBusy(key)) return;
    try {
      const result = await sendPurchaseAnalytics(order.transaction_id);
      setAnalytics((current) => ({ ...current, [key]: result.status }));
      if (result.status === 'sent') toast.success('Diterima endpoint GA4 (HTTP 2xx; bukan bukti reporting).');
      else if (result.status === 'already_processed') toast.success('Sudah diterima endpoint GA4.');
      else toast('Status endpoint belum terkonfirmasi; tidak ada retry otomatis.');
    } finally { endBusy(key); }
  };

  const createB2B = async (event) => {
    event.preventDefault(); const key = 'new-b2b'; const cleanCompany = company.trim();
    if (!cleanCompany) { toast.error('Nama perusahaan wajib diisi.'); return; }
    if (!beginBusy(key)) return;
    try { const { error } = await supabase.from('b2b_orders').insert({ company: cleanCompany, package: packageName, status: 'Menunggu Pembayaran' }); if (error) throw error; setCompany(''); toast.success('Pesanan B2B dibuat sebagai Menunggu Pembayaran.'); await loadB2B(); }
    catch { toast.error('Pesanan B2B belum dapat dibuat.'); } finally { endBusy(key); }
  };

  const renderRow = (order, kind) => { const item = { ...order, __kind: kind }; const key = orderKey(kind, order.id); return <tr key={key} className="border-t align-top"><td className="p-3 font-semibold">{order.name || order.company}<div className="text-[11px] font-normal text-slate-500">{order.package}</div><div className="text-[11px] font-normal text-slate-500">transaction_id: {order.transaction_id || '—'}</div></td><td className="p-3">{order.status}</td><td className="p-3">{order.paid_at ? <><div className="font-bold text-emerald-700">Lunas</div><div>{paymentLabel(order)}</div><div className="text-[11px] text-slate-500">{dateLabel(order.paid_at)}</div></> : <PaidForm order={item} busy={busyId === key} onPaid={markPaid} />}<AnalyticsStatus value={analytics[key]} busy={busyId === key} onSend={() => resend(item)} /></td></tr>; };

  return <section aria-label="Pembayaran CV dan B2B" className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-navy">Pembayaran CV &amp; B2B</h2><p className="text-xs text-slate-500">Catat nominal aktual saja. Pembayaran Lunas tidak dapat diubah atau dibayar ulang.</p></div><button type="button" onClick={() => { onRefreshCV?.(); loadB2B(); }} disabled={loading} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold disabled:opacity-50">{loading ? 'Memuat…' : 'Segarkan Data'}</button></div>
    <form onSubmit={createB2B} className="rounded-xl border border-slate-200 bg-white p-4"><h3 className="font-bold text-sm">Buat Pesanan B2B</h3><p className="mb-3 text-xs text-slate-500">Pesanan baru selalu dibuat belum dibayar; tidak ada nominal otomatis.</p><div className="flex flex-wrap items-end gap-3"><label className="text-xs font-semibold">Perusahaan<input value={company} onChange={(e) => setCompany(e.target.value)} className="mt-1 block rounded border border-slate-300 px-2 py-2 text-sm" required /></label><label className="text-xs font-semibold">Paket<select value={packageName} onChange={(e) => setPackageName(e.target.value)} className="mt-1 block rounded border border-slate-300 px-2 py-2 text-sm">{B2B_PACKAGES.map((item) => <option key={item}>{item}</option>)}</select></label><button type="submit" disabled={busyId === 'new-b2b'} className="rounded bg-teal px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{busyId === 'new-b2b' ? 'Menyimpan…' : 'Buat Pesanan'}</button></div></form>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-left text-xs"><caption className="p-4 text-left text-sm font-bold">Pesanan CV</caption><thead className="bg-slate-100"><tr><th className="p-3">Klien / Paket</th><th className="p-3">Status</th><th className="p-3">Pembayaran</th></tr></thead><tbody>{cvOrders.length ? cvOrders.map((order) => renderRow(order, 'cv')) : <tr><td colSpan="3" className="p-5 text-center text-slate-500">Belum ada pesanan CV.</td></tr>}</tbody></table></div>
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="min-w-full text-left text-xs"><caption className="p-4 text-left text-sm font-bold">Pesanan B2B (maksimal 100 terbaru)</caption><thead className="bg-slate-100"><tr><th className="p-3">Perusahaan / Paket</th><th className="p-3">Status</th><th className="p-3">Pembayaran</th></tr></thead><tbody>{b2bOrders.length ? b2bOrders.map((order) => renderRow(order, 'b2b')) : <tr><td colSpan="3" className="p-5 text-center text-slate-500">Belum ada pesanan B2B.</td></tr>}</tbody></table></div>
  </section>;
}
