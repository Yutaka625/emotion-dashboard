/*
 * DESIGN: Neuro-Signal Interface
 * Drag & Drop CSV upload zone with animated signal-style UI
 */

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import FaceScanIcon from '@/components/FaceScanIcon';
import { analyzeCSV } from '@/lib/csvAnalyzer';
import type { DashboardData } from '@/lib/types';

interface DropZoneProps {
  // 第3引数: 生 CSV テキスト（マルチ FaceID 解析用）
  onDataLoaded: (data: DashboardData, filename: string, rawCsvText?: string) => void;
}

export default function DropZone({ onDataLoaded }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('CSVファイル（.csv）のみ対応しています');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress('ファイルを読み込み中...');

    try {
      const text = await file.text();
      setProgress('データを解析中...');

      // Use setTimeout to allow UI to update before heavy computation
      await new Promise(resolve => setTimeout(resolve, 50));

      setProgress('統計を計算中...');
      const data = analyzeCSV(text, file.name);

      setProgress('グラフデータを生成中...');
      await new Promise(resolve => setTimeout(resolve, 50));

      // 生 CSV テキストも渡す（マルチ FaceID 解析に必要）
      onDataLoaded(data, file.name, text);
    } catch (err) {
      setError(err instanceof Error ? err.message : '分析中にエラーが発生しました');
      setIsProcessing(false);
      setProgress('');
    }
  }, [onDataLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ background: 'oklch(0.18 0.04 255)' }}
    >
      {/* Header */}
      <div className="mb-12 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'oklch(0.22 0.04 255)' }}>
              <FaceScanIcon size={24} color="oklch(0.88 0.005 80)" scanColor="oklch(0.62 0.18 160)" />
            </div>
            <div>
              <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.92 0.005 250)', letterSpacing: '-0.02em' }}>
                KSDV
              </div>
              <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.55rem', color: 'oklch(0.68 0.015 255)', letterSpacing: '0.1em' }}>
                Kokoro Sensor Data Visualizer
              </div>
            </div>
        </div>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.9rem', color: 'oklch(0.68 0.015 255)' }}>
          心sensorの感情ログファイルをアップロードして分析を開始
        </p>
      </div>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className="relative cursor-pointer transition-all duration-300"
        style={{
          width: '100%',
          maxWidth: '560px',
          padding: '3rem 2rem',
          borderRadius: '16px',
          border: `2px dashed ${isDragging ? 'oklch(0.70 0.14 195)' : 'oklch(0.32 0.04 255)'}`,
          background: isDragging
            ? 'oklch(0.62 0.18 160 / 0.06)'
            : 'oklch(0.22 0.04 255)',
          boxShadow: isDragging
            ? '0 0 0 4px oklch(0.70 0.14 195 / 0.20), 0 8px 32px oklch(0.10 0.04 255 / 0.4)'
            : '0 2px 12px oklch(0.10 0.04 255 / 0.4)',
          transform: isDragging ? 'scale(1.01)' : 'scale(1)',
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInput}
          style={{ display: 'none' }}
        />

        {isProcessing ? (
          <div className="flex flex-col items-center gap-4">
            {/* Animated signal bars */}
            <div className="flex items-end gap-1 h-12">
              {[3, 6, 9, 7, 5, 8, 4, 6, 9, 5].map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: '6px',
                    height: `${h * 4}px`,
                    borderRadius: '3px',
                    background: 'oklch(0.62 0.18 160)',
                    animation: `signal-bar 0.8s ease-in-out ${i * 0.08}s infinite alternate`,
                    opacity: 0.7 + (i % 3) * 0.1,
                  }}
                />
              ))}
            </div>
            <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '1rem', color: 'oklch(0.88 0.005 250)' }}>
              {progress}
            </div>
            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.7rem', color: 'oklch(0.68 0.015 255)' }}>
              ANALYZING NEURAL SIGNAL DATA...
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300"
              style={{
                background: isDragging ? 'oklch(0.70 0.14 195 / 0.15)' : 'oklch(0.27 0.04 255)',
                border: `1px solid ${isDragging ? 'oklch(0.62 0.18 160 / 0.4)' : 'oklch(0.28 0.04 255)'}`,
              }}
            >
              {isDragging
                ? <FileText size={28} style={{ color: 'oklch(0.70 0.14 195)' }} />
                : <Upload size={28} style={{ color: 'oklch(0.65 0.015 255)' }} />
              }
            </div>

            <div>
              <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '1.1rem', color: 'oklch(0.92 0.005 250)', marginBottom: '0.4rem' }}>
                {isDragging ? 'ここにドロップ' : 'CSVファイルをドラッグ＆ドロップ'}
              </div>
              <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.68 0.015 255)' }}>
                または{' '}
                <span style={{ color: 'oklch(0.70 0.14 195)', fontWeight: 600, textDecoration: 'underline' }}>
                  クリックしてファイルを選択
                </span>
              </div>
            </div>

            <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.65 0.01 250)', letterSpacing: '0.05em' }}>
              .CSV FORMAT · AFFDEX COMPATIBLE
            </div>
          </div>
        )}
      </div>

      {/* ガイドリンク */}
      <a
        href="KSDV_guide.html"
        target="_blank"
        rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        style={{
          marginTop: '20px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          fontFamily: 'Noto Sans JP, sans-serif',
          fontSize: '0.75rem',
          color: 'oklch(0.68 0.015 255)',
          textDecoration: 'none',
          padding: '5px 12px',
          borderRadius: '6px',
          border: '1px solid oklch(0.28 0.04 255)',
          background: 'oklch(0.22 0.04 255)',
          transition: 'color .15s, border-color .15s',
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLAnchorElement).style.color = 'oklch(0.70 0.14 195)';
          (e.currentTarget as HTMLAnchorElement).style.borderColor = 'oklch(0.70 0.14 195 / 0.4)';
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLAnchorElement).style.color = 'oklch(0.68 0.015 255)';
          (e.currentTarget as HTMLAnchorElement).style.borderColor = 'oklch(0.28 0.04 255)';
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        使い方ガイドを見る
      </a>

      {/* Error message */}
      {error && (
        <div
          className="mt-4 flex items-center gap-2 px-4 py-3 rounded-lg"
          style={{
            maxWidth: '560px',
            width: '100%',
            background: 'oklch(0.20 0.06 25)',
            border: '1px solid oklch(0.35 0.10 25)',
          }}
        >
          <AlertCircle size={16} style={{ color: 'oklch(0.62 0.18 25)', flexShrink: 0 }} />
          <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.80 0.12 25)' }}>
            {error}
          </span>
        </div>
      )}


<style>{`
        @keyframes signal-bar {
          from { transform: scaleY(0.4); opacity: 0.5; }
          to { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
