import React from 'react';

/**
 * Skeleton loading kartu lowongan pekerjaan
 */
export const JobCardSkeleton = () => (
  <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs dark:bg-slate-800/90 dark:border-slate-700/80">
    <div className="flex items-center justify-between mb-4">
      <div className="h-6 w-24 rounded-full bg-slate-200 dark:bg-slate-700" />
      <div className="h-5 w-16 rounded-full bg-slate-100 dark:bg-slate-700/60" />
    </div>
    <div className="h-5 w-3/4 rounded-lg bg-slate-200 mb-2 dark:bg-slate-700" />
    <div className="h-4 w-1/2 rounded bg-slate-100 mb-4 dark:bg-slate-700/60" />
    <div className="space-y-2 mb-4">
      <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-700/50" />
      <div className="h-3 w-5/6 rounded bg-slate-100 dark:bg-slate-700/50" />
    </div>
    <div className="h-8 w-full rounded-xl bg-slate-100 dark:bg-slate-700/40 mb-3" />
    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-700/60">
      <div className="h-4 w-28 rounded bg-slate-100 dark:bg-slate-700/50" />
      <div className="h-4 w-20 rounded bg-slate-200 dark:bg-slate-700" />
    </div>
  </div>
);

/**
 * Grid skeleton untuk daftar feed lowongan
 */
export const JobFeedSkeleton = ({ count = 6 }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
    {Array.from({ length: count }).map((_, idx) => (
      <JobCardSkeleton key={idx} />
    ))}
  </div>
);

export default JobFeedSkeleton;
