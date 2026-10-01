import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { sortJobsByFeatured } from '../lib/utils';

const isRlsError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return error?.code === '42501' || message.includes('row-level security') || message.includes('permission denied for table');
};

export default function useJobActions({ setJobs }) {
  const updateLocalJobs = (updater) => {
    setJobs((prevJobs) => {
      const nextJobs = typeof updater === 'function' ? updater(prevJobs) : updater;
      return nextJobs;
    });
  };

  const createJob = async (newJob) => {
    try {
      const payload = {
        ...newJob,
        created_at: newJob.created_at || new Date().toISOString(),
        status: 'Menunggu Persetujuan',
        applicantsCount: Number(newJob.applicantsCount || 0),
        featured: Boolean(newJob.featured),
      };

      let insertedJob = payload;

      try {
        const { data, error } = await supabase.from('jobs').insert([payload]).select('*').single();

        if (error) {
          throw error;
        }

        insertedJob = data || payload;
      } catch (error) {
        const fallbackId = Date.now();
        insertedJob = {
          ...payload,
          id: fallbackId,
          created_at: new Date().toISOString(),
        };

        if (isRlsError(error)) {
          toast.error('Izin insert dibatasi oleh policy Supabase. Pastikan admin sudah login dan policy INSERT untuk tabel jobs diizinkan.', { duration: 5000 });
        } else {
          toast.error(`Lowongan disimpan lokal sementara: ${error?.message || 'Gagal mengakses Supabase'}`, { duration: 5000 });
        }
      }

      // Masukkan ke state agar langsung tampil di Manajemen Loker Admin
      updateLocalJobs((prevJobs) => sortJobsByFeatured([insertedJob, ...prevJobs]));
      toast.success('Lowongan berhasil dikirim dan menunggu persetujuan admin.');
      return insertedJob;
    } catch {
      return null;
    }
  };

  const updateJob = async (updatedJob) => {
    try {
      const safePayload = { ...updatedJob };
      delete safePayload.id;

      const { error } = await supabase
        .from('jobs')
        .update(safePayload)
        .eq('id', updatedJob.id);

      if (error) throw error;

      updateLocalJobs((prevJobs) =>
        sortJobsByFeatured(
          prevJobs.map((job) => (job.id === updatedJob.id ? updatedJob : job))
        )
      );

      return true;
    } catch (error) {
      if (isRlsError(error)) {
        toast.error('Akses UPDATE dibatasi oleh RLS Supabase. Pastikan akun admin terautentikasi dan policy UPDATE sudah diizinkan.');
      }
      updateLocalJobs((prevJobs) =>
        sortJobsByFeatured(
          prevJobs.map((job) => (job.id === updatedJob.id ? updatedJob : job))
        )
      );
      return false;
    }
  };

  const updateJobStatus = async (id, newStatus) => {
    try {
      const { error } = await supabase
        .from('jobs')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      updateLocalJobs((prevJobs) =>
        prevJobs.map((job) =>
          job.id === id ? { ...job, status: newStatus } : job
        )
      );

      toast.success(`Status lowongan berhasil diperbarui menjadi ${newStatus}.`);
      return true;
    } catch (error) {
      updateLocalJobs((prevJobs) =>
        prevJobs.map((job) =>
          job.id === id ? { ...job, status: newStatus } : job
        )
      );
      if (isRlsError(error)) {
        toast.error('Status tidak bisa diubah karena policy RLS Supabase memblokir UPDATE. Cek policy admin pada tabel jobs.');
      } else {
        toast.error('Gagal memperbarui status lowongan.');
      }
      return false;
    }
  };

  const toggleFeatured = async (id, currentVal) => {
    const newVal = !currentVal;

    try {
      const { error } = await supabase
        .from('jobs')
        .update({ featured: newVal })
        .eq('id', id);

      if (error) throw error;

      updateLocalJobs((prevJobs) =>
        sortJobsByFeatured(
          prevJobs.map((job) =>
            job.id === id ? { ...job, featured: newVal } : job
          )
        )
      );

      toast.success(`Status Premium lowongan ${newVal ? 'diaktifkan' : 'dinonaktifkan'}.`);
      return true;
    } catch (error) {
      updateLocalJobs((prevJobs) =>
        sortJobsByFeatured(
          prevJobs.map((job) =>
            job.id === id ? { ...job, featured: newVal } : job
          )
        )
      );
      if (isRlsError(error)) {
        toast.error('Premium toggle diblokir oleh RLS Supabase. Pastikan akun admin memiliki izin UPDATE pada tabel jobs.');
      } else {
        toast.error('Gagal mengubah status premium lowongan.');
      }
      return false;
    }
  };

  const deleteJob = async (id) => {
    try {
      const { error } = await supabase.from('jobs').delete().eq('id', id);

      if (error) {
        toast.error('Gagal menghapus data: ' + error.message);
        throw error;
      }

      updateLocalJobs((prevJobs) => prevJobs.filter((job) => job.id !== id));
      toast.success('Lowongan berhasil dihapus permanen dari Supabase.');
      return true;
    } catch {
      return false;
    }
  };

  return {
    createJob,
    updateJob,
    updateJobStatus,
    toggleFeatured,
    deleteJob,
  };
}