import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';

export default function useCVOrders() {
  const [cvOrders, setCvOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchCVOrders = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        .from('cv_orders')
        .select('*')
        .order('id', { ascending: false });

      if (fetchErr) {
        setCvOrders([]);
      } else if (data && Array.isArray(data)) {
        setCvOrders(data);
      } else {
        setCvOrders([]);
      }
    } catch {
      setCvOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCVOrders();
  }, [fetchCVOrders]);

  const validateCVOrder = (values = {}) => {
    const { name, whatsapp, packageType, package: pkg } = values;
    const selectedPackage = packageType || pkg;

    if (!name || !name.trim()) {
      return { valid: false, message: 'Nama lengkap wajib diisi.' };
    }
    if (!whatsapp || !whatsapp.trim()) {
      return { valid: false, message: 'Nomor WhatsApp wajib diisi.' };
    }
    if (!selectedPackage || !selectedPackage.trim()) {
      return { valid: false, message: 'Pilih paket layanan terlebih dahulu.' };
    }

    return {
      valid: true,
      message: 'Pesanan CV berhasil dikirim! Tim kami akan segera menghubungi WhatsApp Anda.',
    };
  };

  const createCVOrder = async (orderPayload = {}) => {
    const validation = validateCVOrder(orderPayload);
    if (!validation.valid) {
      toast.error(validation.message);
      return { valid: false, message: validation.message };
    }

    const payload = {
      name: orderPayload.name.trim(),
      whatsapp: orderPayload.whatsapp.trim(),
      package: orderPayload.packageType || orderPayload.package || 'Paket Profesional (Rp 99.000)',
      status: 'Menunggu Review',
      date: orderPayload.date || new Date().toISOString().split('T')[0],
    };

    try {
      const { data, error: insertErr } = await supabase
        .from('cv_orders')
        .insert([payload])
        .select()
        .single();

      if (insertErr) {
        const localEntry = { ...payload, id: Date.now() };
        setCvOrders((prev) => [localEntry, ...prev]);

        if (insertErr.code === '42501' || insertErr.message?.toLowerCase().includes('permission denied')) {
          toast.error('Pesanan dicatat, namun akses INSERT tabel cv_orders dibatasi oleh RLS Supabase.', { duration: 4000 });
        } else {
          toast.error(`Gagal menyimpan ke cloud: ${insertErr.message}`);
        }
        return { valid: true, order: localEntry, message: validation.message };
      }

      const inserted = data || { ...payload, id: Date.now() };
      setCvOrders((prev) => [inserted, ...prev]);
      toast.success(validation.message);
      return { valid: true, order: inserted, message: validation.message };
    } catch {
      const localEntry = { ...payload, id: Date.now() };
      setCvOrders((prev) => [localEntry, ...prev]);
      toast.success(validation.message);
      return { valid: true, order: localEntry, message: validation.message };
    }
  };

  const updateCVStatus = async (id, newStatus) => {
    setCvOrders((prev) =>
      prev.map((order) => (order.id === id ? { ...order, status: newStatus } : order))
    );

    try {
      const { error: updateErr } = await supabase
        .from('cv_orders')
        .update({ status: newStatus })
        .eq('id', id);

      if (updateErr) {
        if (updateErr.code === '42501' || updateErr.message?.toLowerCase().includes('permission denied')) {
          toast.error('Perubahan status berhasil di UI, namun RLS Supabase menolak UPDATE.', { duration: 4000 });
        } else {
          toast.error(`Gagal memperbarui status di cloud: ${updateErr.message}`);
        }
        return false;
      }

      toast.success(`Status pesanan berhasil diubah menjadi "${newStatus}".`);
      return true;
    } catch {
      toast.error('Terjadi kesalahan saat memperbarui status pesanan.');
      return false;
    }
  };

  const deleteCVOrder = async (id) => {
    try {
      const { error } = await supabase
        .from('cv_orders')
        .delete()
        .eq('id', id);

      if (error) {
        toast.error('Gagal menghapus data: ' + error.message);
        throw error;
      }

      setCvOrders((prev) => prev.filter((order) => order.id !== id));
      toast.success('Pesanan CV berhasil dihapus permanen dari Supabase.');
      return true;
    } catch {
      return false;
    }
  };

  return {
    cvOrders,
    loading,
    fetchCVOrders,
    createCVOrder,
    updateCVStatus,
    deleteCVOrder,
  };
}
