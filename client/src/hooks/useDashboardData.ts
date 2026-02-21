import { useState, useEffect } from 'react';
import type { DashboardData } from '@/lib/types';

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/dashboard_data.json')
      .then(res => {
        if (!res.ok) throw new Error('データの読み込みに失敗しました');
        return res.json();
      })
      .then((json: DashboardData) => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}
