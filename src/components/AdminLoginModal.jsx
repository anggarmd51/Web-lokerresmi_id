import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

export default function AdminLoginModal({ isOpen, onClose, onSuccess, onLoginSuccess, login }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleLogin = async (e) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      toast.error('Email dan password wajib diisi.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      toast.error('Format email tidak valid.');
      return;
    }

    setLoading(true);

    try {
      if (!login) throw new Error('Fungsi autentikasi tidak tersedia.');

      await login({ email: trimmedEmail, password: trimmedPassword });

      toast.success('Berhasil masuk sebagai Superadmin!');
      if (onSuccess) onSuccess();
      if (onLoginSuccess) onLoginSuccess();
      onClose();
    } catch (err) {
      // Prevent leaking raw database/server stack traces or internal errors to client
      const rawMsg = err?.message || '';
      let safeMsg = 'Kredensial tidak valid atau akun tidak ditemukan.';
      if (err?.code === 'admin_access_denied') {
        safeMsg = 'Akun ini tidak memiliki hak akses admin';
      } else if (rawMsg.toLowerCase().includes('invalid login credentials')) {
        safeMsg = 'Email atau password yang Anda masukkan salah.';
      } else if (rawMsg.toLowerCase().includes('email not confirmed')) {
        safeMsg = 'Email belum dikonfirmasi.';
      } else if (rawMsg.toLowerCase().includes('too many requests')) {
        safeMsg = 'Terlalu banyak percobaan masuk. Silakan tunggu beberapa saat.';
      }
      toast.error(`Gagal login: ${safeMsg}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full p-6 relative text-slate-900 dark:text-slate-100">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-bold text-xl"
        >
          ✕
        </button>
        <h2 className="text-xl font-bold text-navy dark:text-slate-100 mb-4">Login Superadmin</h2>
        
        <form onSubmit={handleLogin} className="space-y-4 text-sm">
          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-200">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-500 rounded-lg text-sm text-slate-900 dark:text-slate-50 bg-white dark:bg-slate-800 placeholder:text-slate-500 dark:placeholder:text-slate-300 focus:ring-2 focus:ring-teal outline-none"
              placeholder="email@domain.com"
            />
          </div>

          <div>
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-200">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-500 rounded-lg text-sm text-slate-900 dark:text-slate-50 bg-white dark:bg-slate-800 placeholder:text-slate-500 dark:placeholder:text-slate-300 focus:ring-2 focus:ring-teal outline-none"
              placeholder="••••••••"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-100 text-sm rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 font-medium"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-navy text-white text-sm rounded-lg hover:opacity-90 font-bold"
            >
              {loading ? 'Memproses...' : 'Masuk Panel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
