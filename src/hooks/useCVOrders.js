import { useEffect, useState, useCallback, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { trackCVOrderLead } from '../lib/analytics';

export default function useCVOrders({ isAdmin = false } = {}) {
  const [cvOrders, setCvOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const requestVersion = useRef(0);

  const fetchCVOrders = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!isAdmin) {
      setCvOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.from('cv_orders').select('*').order('id', { ascending: false });
      if (version !== requestVersion.current) return;
      setCvOrders(!error && Array.isArray(data) ? data : []);
      if (error) toast.error('Tidak dapat membaca pesanan. Periksa izin admin.');
    } catch {
      if (version === requestVersion.current) {
        setCvOrders([]);
        toast.error('Tidak dapat memuat pesanan.');
      }
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchCVOrders();
    // Batalkan respons lama agar PII tidak muncul kembali setelah logout.
    return () => { requestVersion.current += 1; };
  }, [fetchCVOrders]);

  const createCVOrder = async (orderPayload = {}) => {
    const name = String(orderPayload.name || '').trim();
    const whatsapp = String(orderPayload.whatsapp || '').trim();
    const selectedPackage = String(orderPayload.packageType || orderPayload.package || '').trim();
    if (!name || !whatsapp || !selectedPackage) {
      const message = 'Nama, nomor WhatsApp, dan paket layanan wajib diisi.';
      toast.error(message);
      return { valid: false, message };
    }
    const payload = {
      name,
      whatsapp,
      package: selectedPackage,
      status: 'Menunggu Review',
      date: new Date().toISOString().split('T')[0],
    };
    try {
      // Tanpa SELECT/RETURNING: pengunjung hanya punya hak INSERT.
      const { error } = await supabase.from('cv_orders').insert([payload]);
      if (error) throw error;
      trackCVOrderLead(selectedPackage);
      if (isAdmin) await fetchCVOrders();
      const message = 'Pesanan CV berhasil dikirim! Tim kami akan segera menghubungi WhatsApp Anda.';
      toast.success(message);
      return { valid: true, message };
    } catch {
      const message = 'Pesanan belum dapat dikonfirmasi tersimpan. Periksa koneksi sebelum mencoba lagi.';
      toast.error(message);
      return { valid: false, message };
    }
  };

  const updateCVStatus = async (id, newStatus) => {
    if (!isAdmin) return false;
    try {
      const { data, error } = await supabase.from('cv_orders')
        .update({ status: newStatus }).eq('id', id).select('id').maybeSingle();
      if (error || !data) throw error || new Error('Tidak ada pesanan yang dapat diubah');
      await fetchCVOrders();
      toast.success('Status pesanan berhasil diperbarui.');
      return true;
    } catch {
      toast.error('Status pesanan tidak tersimpan. Periksa izin admin dan koneksi.');
      return false;
    }
  };

  const deleteCVOrder = async (id) => {
    if (!isAdmin) return false;
    try {
      const { data, error } = await supabase.from('cv_orders')
        .delete().eq('id', id).select('id').maybeSingle();
      if (error || !data) throw error || new Error('Tidak ada pesanan yang dapat dihapus');
      await fetchCVOrders();
      toast.success('Pesanan CV berhasil dihapus.');
      return true;
    } catch {
      toast.error('Pesanan tidak dapat dihapus. Periksa izin admin dan koneksi.');
      return false;
    }
  };

  return { cvOrders: isAdmin ? cvOrders : [], loading, fetchCVOrders, createCVOrder, updateCVStatus, deleteCVOrder };
}
