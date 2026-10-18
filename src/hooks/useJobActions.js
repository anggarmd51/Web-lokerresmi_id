import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { sortJobsByFeatured } from '../lib/utils';

const isRlsError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42501' || message.includes('row-level security') || message.includes('permission denied for table');
};

const showActionError = (error, genericMessage, rlsMessage) => {
  toast.error(isRlsError(error) ? rlsMessage : genericMessage);
};

export default function useJobActions({ setJobs }) {
  const updateLocalJobs = (updater) => {
    setJobs((prevJobs) => typeof updater === 'function' ? updater(prevJobs) : updater);
  };

  const createJob = async (newJob) => {
    if (!newJob || typeof newJob !== 'object') {
      toast.error('Data lowongan tidak valid.');
      return null;
    }
    try {
      const { data, error } = await supabase.from('jobs').insert([{ ...newJob }]).select('*').single();
      if (error) throw error;
      if (!data) throw new Error('Supabase tidak mengembalikan data lowongan.');
      updateLocalJobs((prevJobs) => sortJobsByFeatured([data, ...prevJobs]));
      toast.success('Lowongan berhasil dikirim dan menunggu persetujuan admin.');
      return data;
    } catch (error) {
      showActionError(error, `Gagal menyimpan lowongan: ${error?.message || 'Gagal mengakses Supabase'}`, 'Izin insert dibatasi oleh policy Supabase. Pastikan admin sudah login dan policy INSERT untuk tabel jobs diizinkan.');
      return null;
    }
  };

  const updateJob = async (updatedJob) => {
    if (!updatedJob || updatedJob.id == null) {
      toast.error('Data lowongan tidak valid.');
      return false;
    }
    try {
      const safePayload = { ...updatedJob };
      delete safePayload.id;
      const { data, error } = await supabase.from('jobs').update(safePayload).eq('id', updatedJob.id).select('*').single();
      if (error) throw error;
      if (!data) throw new Error('Lowongan tidak ditemukan atau tidak berubah.');
      updateLocalJobs((prevJobs) => sortJobsByFeatured(prevJobs.map((job) => job.id === data.id ? data : job)));
      return true;
    } catch (error) {
      showActionError(error, `Gagal memperbarui lowongan: ${error?.message || 'data tidak berubah.'}`, 'Akses UPDATE dibatasi oleh RLS Supabase. Pastikan akun admin terautentikasi dan policy UPDATE sudah diizinkan.');
      return false;
    }
  };

  const updateJobStatus = async (id, newStatus) => {
    if (id == null || !newStatus) {
      toast.error('Status lowongan tidak valid.');
      return false;
    }
    try {
      const { data, error } = await supabase.from('jobs').update({ status: newStatus }).eq('id', id).select('id').single();
      if (error) throw error;
      if (!data) throw new Error('Lowongan tidak ditemukan atau status tidak berubah.');
      updateLocalJobs((prevJobs) => prevJobs.map((job) => job.id === id ? { ...job, status: newStatus } : job));
      toast.success(`Status lowongan berhasil diperbarui menjadi ${newStatus}.`);
      return true;
    } catch (error) {
      showActionError(error, 'Gagal memperbarui status lowongan.', 'Status tidak bisa diubah karena policy RLS Supabase memblokir UPDATE. Cek policy admin pada tabel jobs.');
      return false;
    }
  };

  const toggleFeatured = async (id, currentVal) => {
    if (id == null) {
      toast.error('Lowongan tidak valid.');
      return false;
    }
    const newVal = !currentVal;
    try {
      const { data, error } = await supabase.from('jobs').update({ featured: newVal }).eq('id', id).select('id').single();
      if (error) throw error;
      if (!data) throw new Error('Lowongan tidak ditemukan atau status premium tidak berubah.');
      updateLocalJobs((prevJobs) => sortJobsByFeatured(prevJobs.map((job) => job.id === id ? { ...job, featured: newVal } : job)));
      toast.success(`Status Premium lowongan ${newVal ? 'diaktifkan' : 'dinonaktifkan'}.`);
      return true;
    } catch (error) {
      showActionError(error, 'Gagal mengubah status premium lowongan.', 'Premium toggle diblokir oleh RLS Supabase. Pastikan akun admin memiliki izin UPDATE pada tabel jobs.');
      return false;
    }
  };

  const deleteJob = async (id) => {
    try {
      const { data, error } = await supabase.from('jobs').delete().eq('id', id).select('id').single();
      if (error) throw error;
      if (!data) throw new Error('Lowongan tidak ditemukan atau tidak terhapus.');
      updateLocalJobs((prevJobs) => prevJobs.filter((job) => job.id !== id));
      toast.success('Lowongan berhasil dihapus permanen dari Supabase.');
      return true;
    } catch (error) {
      toast.error('Gagal menghapus data: ' + (error?.message || 'operasi gagal.'));
      return false;
    }
  };

  return { createJob, updateJob, updateJobStatus, toggleFeatured, deleteJob };
}
