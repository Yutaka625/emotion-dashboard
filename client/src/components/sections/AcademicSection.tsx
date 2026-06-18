/*
 * DESIGN: Neuro-Signal Interface
 * Academic analysis section with Affect Dynamics, Circumplex Model, etc.
 */

import { useState, useMemo } from 'react';
import { Download, Printer } from 'lucide-react';
import type { DashboardData } from '@/lib/types';
import { EMOTION_LABELS_JA, EMOTION_COLORS, NON_NEUTRAL_EMOTIONS } from '@/lib/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, ReferenceLine,
} from 'recharts';
import { rechartsTooltip } from '@/lib/chartTooltip';
import AbsoluteScaleBadge from '@/components/ui/AbsoluteScaleBadge';
import CollapsibleCard from '@/components/ui/CollapsibleCard';
import { useFaceID } from '@/contexts/FaceIDContext';
import { readSessionMeta, hasAnySessionMeta } from '@/lib/sessionMeta';
import { downloadCSV } from '@/lib/csvExport';
import { buildAcademicDynamicsCompare, type AcademicDynamicsRow } from '@/lib/academicDynamics';

interface Props {
  data: DashboardData;
}

const round4 = (v: number) => Math.round(v * 10000) / 10000;

function dynamicsCellProps(entry: AcademicDynamicsRow, patternId: string, color = entry.color) {
  if (entry.kind === 'special') {
    return {
      fill: `url(#${patternId})`,
      stroke: color,
      strokeWidth: 1.5,
    };
  }

  return {
    fill: color,
    stroke: 'none',
    strokeWidth: 0,
  };
}

function SpecialMetricPattern({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} patternUnits="userSpaceOnUse" width={6} height={6} patternTransform="rotate(45)">
        <rect width={6} height={6} fill="oklch(0.24 0.04 255 / 0.78)" />
        <path d="M 0 0 L 0 6" stroke="oklch(0.80 0.02 250 / 0.55)" strokeWidth={2} />
      </pattern>
    </defs>
  );
}

export default function AcademicSection({ data }: Props) {
  const { affect_dynamics, correlation_matrix, circumplex_summary, emotion_prevalence, special_stats, engagement_correlations, emotion_stats, meta } = data;
  const [_exporting, setExporting] = useState(false);
  const [cpDeltaThreshold, setCpDeltaThreshold] = useState(0);
  const [cpSortKey, setCpSortKey] = useState<'time' | 'delta'>('delta');
  const [cpSortDir, setCpSortDir] = useState<'asc' | 'desc'>('desc');
  // マルチFaceID のノイズ除外情報（CSV へ再現性のため記録する）
  const { isMultiFace, quality, minFraction, minSeconds, faceFrameCount } = useFaceID();

  // ---- CSV レポート出力 ----
  const exportReportCSV = () => {
    setExporting(true);
    const rows: string[] = [];
    const q = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;

    // セクション1: メタ情報
    rows.push('## SESSION META');
    rows.push('項目,値');
    rows.push(`ファイル名,${q(meta.filename)}`);
    rows.push(`総フレーム数,${meta.total_frames}`);
    rows.push(`録画時間(秒),${meta.duration_seconds.toFixed(2)}`);
    rows.push(`平均FPS,${meta.fps_avg.toFixed(2)}`);
    rows.push(`顔検出率(%),${meta.face_detection_rate.toFixed(1)}`);
    rows.push(`感情検出率(%),${meta.emotion_detection_rate.toFixed(1)}`);
    rows.push('');

    // セクション1b: 実験計画メタデータ（入力がある場合のみ・再現性のため）
    const sessionMeta = readSessionMeta(meta.filename);
    if (hasAnySessionMeta(sessionMeta)) {
      rows.push(`## SESSION METADATA (schema_version=${sessionMeta.schema_version})`);
      rows.push('グループ,項目,値');
      const metaRows: [string, string, string | undefined][] = [
        ['subject', '被験者ID', sessionMeta.subject.subject_id],
        ['subject', '年齢', sessionMeta.subject.age],
        ['subject', '性別', sessionMeta.subject.sex],
        ['subject', '利き手', sessionMeta.subject.handedness],
        ['design', '群', sessionMeta.design.group],
        ['design', '条件', sessionMeta.design.condition],
        ['design', '刺激・タスク', sessionMeta.design.stimulus],
        ['design', '測定回', sessionMeta.design.session_number],
        ['environment', '照明', sessionMeta.environment.lighting],
        ['environment', '場所', sessionMeta.environment.location],
        ['environment', 'デバイス・カメラ', sessionMeta.environment.device],
        ['environment', 'カメラ距離', sessionMeta.environment.camera_distance],
        ['notes', 'プロトコル要約', sessionMeta.notes.protocol],
        ['notes', '備考', sessionMeta.notes.free_notes],
      ];
      for (const [group, label, value] of metaRows) {
        if (value != null && String(value).trim() !== '') {
          rows.push(`${group},${q(label)},${q(value)}`);
        }
      }
      rows.push('');
    }

    // セクション2: 感情統計
    rows.push('## EMOTION STATISTICS');
    rows.push('感情,n,mean,std,min,max,median,Q25,Q75');
    for (const e of NON_NEUTRAL_EMOTIONS) {
      const s = emotion_stats[e];
      if (!s) continue;
      rows.push(`${EMOTION_LABELS_JA[e] || e},${s.n},${s.mean},${s.std},${s.min},${s.max},${s.median},${s.q25},${s.q75}`);
    }
    rows.push('');

    // セクション2b: 特殊指標統計
    rows.push('## SPECIAL METRICS STATISTICS');
    rows.push('指標,n,mean,std,min,max,median,Q25,Q75');
    for (const key of ['engagement', 'valence', 'attention']) {
      const s = (data.special_stats || {})[key] || (data.emotion_stats || {})[key];
      if (!s) continue;
      rows.push(`${key},${s.n},${s.mean},${s.std},${s.min},${s.max},${s.median},${s.q25},${s.q75}`);
    }
    rows.push('');

    // セクション3: Affect Dynamics
    rows.push('## AFFECT DYNAMICS');
    rows.push('対象,variability_SD,instability_MSSD,inertia_AR1,range,mean_absolute_change');
    for (const key of [...NON_NEUTRAL_EMOTIONS, 'engagement', 'valence']) {
      const d = affect_dynamics[key];
      if (!d) continue;
      rows.push(`${EMOTION_LABELS_JA[key] || key},${d.variability_sd},${d.instability_mssd},${d.inertia_ar1},${d.range},${d.mean_absolute_change}`);
    }
    rows.push('');

    // セクション4: 相関行列
    rows.push('## CORRELATION MATRIX');
    rows.push(['', ...correlation_matrix.labels.map(l => EMOTION_LABELS_JA[l] || l)].join(','));
    correlation_matrix.labels.forEach((label, i) => {
      const rowLabel = EMOTION_LABELS_JA[label] || label;
      rows.push([rowLabel, ...correlation_matrix.data[i].map(v => v.toFixed(4))].join(','));
    });
    rows.push('');

    // セクション5: Circumplex象限
    rows.push('## CIRCUMPLEX MODEL (Russell 1980)');
    rows.push('象限,フレーム数');
    rows.push(`高覚醒×高Valence,${circumplex_summary.high_arousal_positive}`);
    rows.push(`高覚醒×低Valence,${circumplex_summary.high_arousal_negative}`);
    rows.push(`低覚醒×高Valence,${circumplex_summary.low_arousal_positive}`);
    rows.push(`低覚醒×低Valence,${circumplex_summary.low_arousal_negative}`);
    rows.push('');

    // セクション6: 変化点
    if (data.change_points && data.change_points.length > 0) {
      rows.push('## CHANGE POINTS');
      rows.push('時刻(秒),時刻(分:秒),感情,変化量,方向');
      for (const cp of data.change_points) {
        const mm = Math.floor(cp.time / 60).toString().padStart(2, '0');
        const ss = Math.floor(cp.time % 60).toString().padStart(2, '0');
        rows.push(`${cp.time},${mm}:${ss},${EMOTION_LABELS_JA[cp.emotion] || cp.emotion},${cp.delta},${cp.direction}`);
      }
      rows.push('');
    }

    // セクション7: FaceID ノイズ除外（マルチフェイス or 除外ありの場合のみ。再現性のため基準と内訳を記録）
    if (isMultiFace || quality.minor.length > 0) {
      rows.push('## FACE FILTERING');
      rows.push('項目,値');
      rows.push(`判定基準,${q(`総フレームの${(minFraction * 100).toFixed(0)}%未満 または ${minSeconds}秒未満を除外`)}`);
      rows.push(`総フレーム数,${quality.totalFrames}`);
      rows.push(`解析対象(kept)数,${quality.kept.length}`);
      rows.push(`除外(minor)数,${quality.minor.length}`);
      rows.push('');
      rows.push('区分,FaceID,フレーム数');
      for (const id of quality.kept) rows.push(`kept,${q(id)},${faceFrameCount(id)}`);
      for (const m of quality.minor) rows.push(`excluded,${q(m.id)},${m.frames}`);
      rows.push('');
    }

    downloadCSV(`ksdv_report_${meta.filename.replace(/\.[^.]+$/, '')}.csv`, rows.join('\n'));
    setExporting(false);
  };

  // 変化点フィルタ・ソート
  const filteredChangePoints = useMemo(() => {
    const pts = (data.change_points || []).filter(cp => Math.abs(cp.delta) >= cpDeltaThreshold);
    return [...pts].sort((a, b) => {
      const va = cpSortKey === 'time' ? a.time : Math.abs(a.delta);
      const vb = cpSortKey === 'time' ? b.time : Math.abs(b.delta);
      return cpSortDir === 'asc' ? va - vb : vb - va;
    });
  }, [data.change_points, cpDeltaThreshold, cpSortKey, cpSortDir]);

  const cpMaxDelta = useMemo(() =>
    Math.max(0, ...((data.change_points || []).map(cp => Math.abs(cp.delta)))),
    [data.change_points]
  );

  // Affect Dynamics comparison
  const dynamicsCompare = buildAcademicDynamicsCompare({ affect_dynamics });

  // Correlation heatmap data
  const corrLabels = correlation_matrix.labels;
  const corrData = correlation_matrix.data;

  // Inertia vs Variability scatter
  const inertiaVarData = dynamicsCompare.map(d => ({
    name: d.name,
    variability: d.sd,
    inertia: d.ar1,
    color: d.color,
    kind: d.kind,
  }));

  // ============================================================
  // 学術的所見の動的生成
  // 旧コードは「Fearの変動性が最も高い」等をハードコードしており、
  // 読み込んだデータと無関係（＝任意データで誤情報）だった。
  // 以下は実データから所見を導出し、文章・断定をデータに追従させる。
  // ============================================================

  // 変動性(SD)が最も高い指標／慣性(AR1)が最も高い＝最も持続しやすい指標
  const topVariability = [...dynamicsCompare].sort((a, b) => b.sd - a.sd)[0];
  const topInertia = [...dynamicsCompare].sort((a, b) => b.ar1 - a.ar1)[0];
  const topInstability = [...dynamicsCompare].sort((a, b) => b.mssd - a.mssd)[0];
  // 2番目に変動性が高い指標（変動性の一文で補足に使う。無ければ undefined）
  const secondVariability = [...dynamicsCompare].sort((a, b) => b.sd - a.sd)[1];

  // Engagement と最も強く相関する非ニュートラル感情（|r| 最大）
  const engEmotionCorr = NON_NEUTRAL_EMOTIONS
    .map(e => ({ key: e, name: EMOTION_LABELS_JA[e] || e, r: engagement_correlations[e] ?? 0 }))
    .sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0];
  const corrSign = engEmotionCorr.r >= 0 ? '正' : '負';
  const corrCoMove = engEmotionCorr.r >= 0 ? '増加' : '減少';
  // FACS AU の具体説明は表情筋が対応する fear / surprise のときだけ付す（他感情では誤りになるため）
  const facsNote = (engEmotionCorr.key === 'fear' || engEmotionCorr.key === 'surprise')
    ? 'これはFACSにおけるAU1（内眉挙上）・AU2（外眉挙上）・AU5（目を見開く）の活性化パターンと関連します。'
    : '';

  // Valence の慣性・平均（実値で水準を表現）
  const valAr1 = affect_dynamics.valence?.inertia_ar1 ?? 0;
  const valMean = special_stats.valence?.mean ?? 0;
  const valInertiaLevel = valAr1 >= 0.7 ? '非常に高く' : valAr1 >= 0.4 ? '比較的高く' : valAr1 >= 0 ? '中程度で' : '負（揺り戻し傾向）であり';

  // Circumplex で最多の象限（4象限の合計を母数にして割合を出す。旧コードのマジックナンバー 3371 を排除）
  const quadrantList = [
    { key: 'high_arousal_positive', label: '高覚醒×高Valence', desc: '活性化・興奮', value: circumplex_summary.high_arousal_positive },
    { key: 'high_arousal_negative', label: '高覚醒×低Valence', desc: '怒り・不安', value: circumplex_summary.high_arousal_negative },
    { key: 'low_arousal_positive', label: '低覚醒×高Valence', desc: '穏やかな満足・リラックス', value: circumplex_summary.low_arousal_positive },
    { key: 'low_arousal_negative', label: '低覚醒×低Valence', desc: '疲労・抑うつ', value: circumplex_summary.low_arousal_negative },
  ];
  const circumTotal = Math.max(1, quadrantList.reduce((s, q) => s + q.value, 0));
  const topQuadrant = [...quadrantList].sort((a, b) => b.value - a.value)[0];
  const topQuadrantPct = ((topQuadrant.value / circumTotal) * 100).toFixed(1);

  // 変動性の一文（グラフ直上の説明）をデータ駆動で生成
  const variabilityLead =
    `高い変動性は感情の揺れ幅が大きいことを示します。`
    + `本セッションでは${topVariability.name}の変動性が最も高く（SD: ${topVariability.sd.toFixed(4)}）`
    + (secondVariability ? `、次いで${secondVariability.name}が高い変動性を示しています。` : `。`);

  // 不安定性（√MSSD）の一文（グラフ直上の説明）をデータ駆動で生成
  const instabilityLead =
    `高い不安定性は、隣り合う瞬間どうしでスコアが急に変わりやすい（突発的な変化が多い）ことを示します。`
    + `本セッションでは${topInstability.name}が最も不安定でした（√MSSD: ${topInstability.mssd.toFixed(4)}）。`;

  // 解釈カード4枚の本文をデータ駆動で生成
  const interpretationCards = [
    {
      heading: '1. 感情の安定性と慣性',
      content: `Affect Dynamicsの分析から、本セッションでは「${topInertia.name}」が最も高い慣性（AR1: ${topInertia.ar1.toFixed(4)}）を示しており、一度この状態に入ると持続しやすいことが示唆されます。一方、${topVariability.name}は最も高い変動性（SD: ${topVariability.sd.toFixed(4)}）を示し、瞬間的な変化が頻繁に発生していました。なお AR1 はフレーム単位（ラグ1＝次フレーム）で算出し fps が高いほど高めに出るため、絶対値での断定は避け、同一条件のセッション間・被験者間の相対比較として解釈してください。`,
      color: 'oklch(0.62 0.18 160)',
    },
    {
      heading: '2. Valenceの安定性',
      content: `Valenceの慣性（AR1: ${valAr1.toFixed(4)}）は${valInertiaLevel}、感情価が一度設定されると${valAr1 >= 0.4 ? '長時間維持される傾向があります' : '比較的変化しやすい状態でした'}。平均値${valMean.toFixed(2)}のValence水準が${valMean >= 50 ? 'ポジティブ寄り' : valMean >= 0 ? '中立付近' : 'ネガティブ寄り'}で推移しました。`,
      color: 'oklch(0.62 0.18 25)',
    },
    {
      heading: `3. Engagementと${engEmotionCorr.name}の相関の解釈`,
      content: `Engagementと${engEmotionCorr.name}の${corrSign}相関（r = ${engEmotionCorr.r.toFixed(4)}）は、高覚醒状態において${engEmotionCorr.name}に関連する表情筋活動が${corrCoMove}する傾向を示します。${facsNote}`,
      color: 'oklch(0.55 0.18 300)',
    },
    {
      heading: '4. Circumplex Modelによる感情状態の分類',
      content: `Russell（1980）の円環モデルに基づく分析では、${topQuadrant.value.toLocaleString()}フレーム（${topQuadrantPct}%）が「${topQuadrant.label}」象限に最も多く分類されました。これは「${topQuadrant.desc}」に対応し、本セッションの主要な感情状態を特徴づけています。`,
      color: 'oklch(0.72 0.12 80)',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="section-label mb-1">ACADEMIC ANALYSIS</div>
          <h2 style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.5rem', color: 'oklch(0.88 0.005 250)' }}>
            学術的分析
          </h2>
          <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.85rem', color: 'oklch(0.68 0.015 255)', marginTop: '0.25rem' }}>
            Affect Dynamics・Circumplex Model・相関分析など学術研究の視点からの多角的分析
          </p>
          {/* ベースライン補正ON時: このタブの指標は絶対値（補正対象外）であることを明示 */}
          <div className="mt-2"><AbsoluteScaleBadge /></div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={exportReportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all"
            style={{ background: 'oklch(0.25 0.06 160)', border: '1px solid oklch(0.40 0.12 160)', color: 'oklch(0.80 0.18 160)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}
            title="全統計をCSVでダウンロード"
          >
            <Download size={13} />
            CSV出力
          </button>
          <button
            onClick={() => {
              // 印刷直前に document.title をセッション名へ変更し、
              // PDF保存時のデフォルトファイル名を分かりやすくする。
              // 印刷後（afterprint）に元のタイトルへ戻す。
              const originalTitle = document.title;
              const baseName = (meta.filename || 'session').replace(/\.[^.]+$/, ''); // 拡張子を除去
              document.title = `学術的分析_${baseName}`;
              const restore = () => {
                document.title = originalTitle;
                window.removeEventListener('afterprint', restore);
              };
              window.addEventListener('afterprint', restore);
              window.print();
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all"
            style={{ background: 'oklch(0.22 0.04 255)', border: '1px solid oklch(0.32 0.04 255)', color: 'oklch(0.65 0.015 255)', fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem' }}
            title="ブラウザの印刷 → PDFとして保存"
          >
            <Printer size={13} />
            印刷/PDF
          </button>
        </div>
      </div>

      {/* Theoretical Framework */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: 'Affect Dynamics',
            author: 'Kuppens et al. (2010)',
            desc: '感情の変動性（SD）・不安定性（MSSD）・慣性（AR1）を用いて感情の動的特性を定量化する枠組み。変動性は全体の揺れ幅、不安定性は隣接フレーム間の急変、慣性は状態の持続性を示す。',
            color: 'oklch(0.62 0.18 160)',
          },
          {
            title: 'Circumplex Model of Affect',
            author: 'Russell (1980)',
            desc: '感情を覚醒度（Arousal）と感情価（Valence）の2次元空間で表現するモデル。EngagementをArousalの代理指標として使用し、感情状態を4象限に分類。',
            color: 'oklch(0.62 0.18 25)',
          },
          {
            title: 'Facial Action Coding System',
            author: 'Ekman & Friesen (1978)',
            desc: 'アクションユニット（AU）を用いて顔の筋肉動作を体系的に記述するシステム。本データのアクションユニット列はFACSに基づく表情筋活動の定量化。',
            color: 'oklch(0.55 0.18 300)',
          },
        ].map((f, i) => (
          <div key={i} className="p-4 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', border: `1px solid ${f.color}30` }}>
            <div className="flex items-start gap-2 mb-2">
              <div className="w-1 h-full min-h-12 rounded-full flex-shrink-0" style={{ background: f.color }} />
              <div>
                <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 700, fontSize: '0.85rem', color: 'oklch(0.88 0.005 250)' }}>
                  {f.title}
                </div>
                <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: f.color, marginTop: '2px' }}>
                  {f.author}
                </div>
              </div>
            </div>
            <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.75rem', color: 'oklch(0.68 0.015 250)', lineHeight: 1.6 }}>
              {f.desc}
            </p>
          </div>
        ))}
      </div>

      {/* Affect Dynamics - Variability */}
      <CollapsibleCard
        label="AFFECT DYNAMICS — VARIABILITY"
        title="感情変動性（Standard Deviation）"
        tier="pro"
        info="各指標の標準偏差（SD）。値が大きいほど、その感情・指標が時間とともに大きく揺れ動いたことを示します。"
        storageKey="ksdv.collapse.academic.variability"
      >
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
          {variabilityLead}
          {' '}SDはセッション全体でどれだけ広い範囲に散らばったかを見る指標で、変化の順序や急変の有無は直接見ません。
          Engagement / Valence は感情そのものではないため、斜線パターンで区別しています。
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dynamicsCompare} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <SpecialMetricPattern id="variability-special-metric-pattern" />
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', fill: 'oklch(0.68 0.015 255)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
            <Tooltip
              formatter={(v: number) => [v.toFixed(4), 'SD（変動性）']}
              {...rechartsTooltip}
            />
            <Bar dataKey="sd" radius={[4, 4, 0, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
              {dynamicsCompare.map((entry, i) => (
                <Cell key={i} {...dynamicsCellProps(entry, 'variability-special-metric-pattern')} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CollapsibleCard>

      {/* Affect Dynamics - Inertia */}
      <CollapsibleCard
        label="AFFECT DYNAMICS — INERTIA (AR1)"
        title="感情慣性（1次自己相関係数）"
        tier="pro"
        info="1つ前のフレームとの自己相関（AR1）。1に近いほど状態が持続しやすく、負の値は振動（揺り戻し）を示します。算出は『1フレーム＝ラグ1』のフレーム単位で、フレームレート(fps)が高いほど値は高めに出ます。絶対値の大小ではなく、同一fps・同一条件のセッション間／被験者間の相対比較で解釈してください（不安定性MSSD・変動性SDも同じくフレーム単位の指標です）。"
        storageKey="ksdv.collapse.academic.inertia"
      >
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.68 0.015 255)', marginBottom: '0.5rem' }}>
          高い慣性（AR1が1に近い）は感情状態が持続しやすいことを示します。負の値は振動パターンを示します。
        </p>
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.72rem', color: 'oklch(0.66 0.12 70)', marginBottom: '1rem', lineHeight: 1.7 }}>
          ⚠ 算出は「1フレーム＝ラグ1」のフレーム単位です。フレームレート(fps)が高いほど隣接フレームが似るため AR1 は高めに出ます。
          <strong>絶対値の大小で断定せず</strong>、同一fps・同一条件での<strong>セッション間／被験者間の相対比較</strong>として解釈してください。
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dynamicsCompare} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <SpecialMetricPattern id="inertia-special-metric-pattern" />
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', fill: 'oklch(0.68 0.015 255)' }} />
            <YAxis domain={[-1, 1]} tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
            <Tooltip
              formatter={(v: number) => [v.toFixed(4), 'AR1（慣性）']}
              {...rechartsTooltip}
            />
            <ReferenceLine y={0} stroke="oklch(0.68 0.015 255)" strokeDasharray="4 4" />
            <Bar dataKey="ar1" radius={[4, 4, 0, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
              {dynamicsCompare.map((entry, i) => (
                <Cell
                  key={i}
                  {...dynamicsCellProps(
                    entry,
                    'inertia-special-metric-pattern',
                    entry.ar1 >= 0 ? 'oklch(0.62 0.18 160)' : 'oklch(0.62 0.18 25)',
                  )}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CollapsibleCard>

      {/* Affect Dynamics - Instability（旧「感情動態指標の比較」を移設。SD重複を解消し√MSSD単独に） */}
      <CollapsibleCard
        label="AFFECT DYNAMICS — INSTABILITY (√MSSD)"
        title="感情の不安定性（√MSSD）"
        tier="pro"
        info="連続するフレーム間の差の二乗平均の平方根（√MSSD）。隣り合う瞬間どうしでスコアが急変しやすいほど大きくなります。静的なばらつきを表す変動性（SD）とは別の観点で、上の2カード（変動性SD・慣性AR1）と並べて感情動態を比較できます。算出は『隣接フレーム差』のフレーム単位で、変動性SD・慣性AR1と同様にfps依存のため同一条件での相対比較で解釈してください。"
        storageKey="ksdv.collapse.academic.instability"
      >
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
          {instabilityLead}
          {' '}√MSSDは隣接フレーム差を見るため、同じ揺れ幅でも「ゆっくり変わる」場合は低く、「短時間で上下する」場合は高く出ます。
          Engagement / Valence は感情そのものではないため、斜線パターンで区別しています。
        </p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={dynamicsCompare} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <SpecialMetricPattern id="instability-special-metric-pattern" />
            <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.22 0.04 255)" vertical={false} />
            <XAxis dataKey="name" tick={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', fill: 'oklch(0.68 0.015 255)' }} />
            <YAxis tick={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', fill: 'oklch(0.68 0.015 255)' }} />
            <Tooltip
              formatter={(v: number) => [v.toFixed(4), '√MSSD（不安定性）']}
              {...rechartsTooltip}
            />
            <Bar dataKey="mssd" radius={[4, 4, 0, 0]} activeBar={{ fill: 'oklch(0.55 0.04 255 / 0.6)', stroke: 'none' }}>
              {dynamicsCompare.map((entry, i) => (
                <Cell key={i} {...dynamicsCellProps(entry, 'instability-special-metric-pattern')} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CollapsibleCard>

      {/* Correlation Heatmap */}
      <CollapsibleCard
        label="CORRELATION MATRIX"
        title="感情指標間の相関行列"
        tier="pro"
        info="2つの指標が一緒に増減する度合い（ピアソン相関係数 −1〜+1）。+1に近いほど同調、−1に近いほど逆方向に動きます。"
        storageKey="ksdv.collapse.academic.correlation"
      >
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1rem' }}>
          色の濃さは相関の強さを示します。緑：正の相関、赤：負の相関。
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs">
            <thead>
              <tr>
                <th className="w-16 pb-1" />
                {corrLabels.map(label => (
                  <th key={label} className="pb-1 px-0.5 text-center" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.6rem', color: EMOTION_COLORS[label] || 'oklch(0.68 0.015 255)', minWidth: '44px', writingMode: 'vertical-rl', height: '60px' }}>
                    {EMOTION_LABELS_JA[label] || label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corrLabels.map((rowLabel, ri) => (
                <tr key={rowLabel}>
                  <td className="py-0.5 pr-2" style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.62rem', color: EMOTION_COLORS[rowLabel] || 'oklch(0.68 0.015 255)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {EMOTION_LABELS_JA[rowLabel] || rowLabel}
                  </td>
                  {corrLabels.map((colLabel, ci) => {
                    const val = corrData[ri]?.[ci] || 0;
                    const isDiag = ri === ci;
                    const intensity = Math.abs(val);
                    const isPos = val >= 0;
                    return (
                      <td key={colLabel} className="py-0.5 px-0.5" title={`${EMOTION_LABELS_JA[rowLabel] || rowLabel} × ${EMOTION_LABELS_JA[colLabel] || colLabel}: ${val.toFixed(3)}`}>
                        <div
                          className="w-10 h-7 rounded flex items-center justify-center"
                          style={{
                            background: isDiag
                              ? 'oklch(0.75 0.01 250)'
                              : isPos
                                ? `oklch(0.62 0.18 160 / ${Math.min(0.9, intensity * 1.2)})`
                                : `oklch(0.62 0.18 25 / ${Math.min(0.9, intensity * 1.2)})`,
                          }}
                        >
                          <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.55rem', color: intensity > 0.4 ? 'white' : 'oklch(0.75 0.008 250)', fontWeight: 600 }}>
                            {isDiag ? '1.0' : val.toFixed(2)}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CollapsibleCard>

      {/* Circumplex Model Visualization */}
      <CollapsibleCard
        label="CIRCUMPLEX MODEL — QUADRANT ANALYSIS"
        title="感情の円環モデル象限分析（Russell, 1980）"
        tier="pro"
        info="覚醒度（縦）×感情価（横）の2軸で感情を4象限に分類し、各象限に該当したフレーム数と割合を示します。"
        storageKey="ksdv.collapse.academic.circumplex"
      >
        <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.68 0.015 255)', marginBottom: '1.5rem' }}>
          X軸：Valence（感情価）、Y軸：Engagement（覚醒度代理）。各象限のフレーム数と割合を示します。
        </p>
        <div className="relative" style={{ height: '280px' }}>
          {/* Quadrant grid */}
          <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0">
            {[
              { label: '高覚醒×高Valence', value: circumplex_summary.high_arousal_positive, desc: '活性化・興奮', color: 'oklch(0.62 0.18 160)', position: 'top-right' },
              { label: '高覚醒×低Valence', value: circumplex_summary.high_arousal_negative, desc: '怒り・不安', color: 'oklch(0.62 0.18 25)', position: 'top-left' },
              { label: '低覚醒×高Valence', value: circumplex_summary.low_arousal_positive, desc: 'リラックス・満足', color: 'oklch(0.72 0.12 80)', position: 'bottom-right' },
              { label: '低覚醒×低Valence', value: circumplex_summary.low_arousal_negative, desc: '疲労・抑うつ', color: 'oklch(0.55 0.12 250)', position: 'bottom-left' },
            ].map((q, i) => {
              const total = circumplex_summary.high_arousal_positive + circumplex_summary.high_arousal_negative + circumplex_summary.low_arousal_positive + circumplex_summary.low_arousal_negative;
              const pct = total > 0 ? (q.value / total * 100).toFixed(1) : '0';
              return (
                <div key={i} className="flex flex-col items-center justify-center p-4 rounded-lg m-1" style={{ background: `${q.color}10`, border: `1px solid ${q.color}30` }}>
                  <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 800, fontSize: '1.8rem', color: q.color, lineHeight: 1 }}>
                    {q.value.toLocaleString()}
                  </div>
                  <div style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: q.color, marginTop: '2px' }}>
                    {pct}%
                  </div>
                  <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.75rem', color: 'oklch(0.88 0.005 250)', marginTop: '4px', textAlign: 'center' }}>
                    {q.label}
                  </div>
                  <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.68rem', color: 'oklch(0.68 0.015 255)', textAlign: 'center' }}>
                    {q.desc}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Axis labels */}
          <div className="absolute left-1/2 top-1 -translate-x-1/2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.68 0.015 255)' }}>
            ↑ 高覚醒 (High Arousal)
          </div>
          <div className="absolute left-1/2 bottom-1 -translate-x-1/2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.68 0.015 255)' }}>
            ↓ 低覚醒 (Low Arousal)
          </div>
          <div className="absolute top-1/2 left-1 -translate-y-1/2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.68 0.015 255)', writingMode: 'vertical-rl' }}>
            ← 低Valence
          </div>
          <div className="absolute top-1/2 right-1 -translate-y-1/2" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.6rem', color: 'oklch(0.68 0.015 255)', writingMode: 'vertical-rl' }}>
            高Valence →
          </div>
        </div>
      </CollapsibleCard>

      {/* Change Points Table */}
      {data.change_points && data.change_points.length > 0 && (
        <CollapsibleCard
          label="CHANGE POINTS — TIMELINE"
          title="感情変化点の一覧"
          tier="pro"
          info="セッション中に急激な感情変化が起きた時点を一覧表示します。delta値は前後フレームの差分です。列ヘッダーをクリックするとソートできます。"
          storageKey="ksdv.collapse.academic.changepoints"
        >
          {/* フィルタ */}
          <div className="flex items-center gap-3 mb-3">
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.55 0.015 255)' }}>
              |delta| 閾値:
            </span>
            <input
              type="range"
              min={0}
              max={cpMaxDelta}
              step={round4(cpMaxDelta / 100) || 0.001}
              value={cpDeltaThreshold}
              onChange={e => setCpDeltaThreshold(parseFloat(e.target.value))}
              className="flex-1 max-w-48"
              style={{ accentColor: 'oklch(0.62 0.18 160)' }}
            />
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.65rem', color: 'oklch(0.75 0.008 250)', minWidth: '3.5rem' }}>
              ≥ {cpDeltaThreshold.toFixed(3)}
            </span>
            <span style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.62rem', color: 'oklch(0.45 0.015 255)' }}>
              {filteredChangePoints.length} / {data.change_points.length} 件
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '2px solid oklch(0.28 0.04 255)' }}>
                  {[
                    { key: 'time', label: '時刻 (秒)' },
                    { key: 'time', label: '時刻 (分:秒)' },
                    { key: null, label: '感情' },
                    { key: 'delta', label: 'delta' },
                    { key: null, label: '方向' },
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="text-left pb-2 pr-4"
                      style={{
                        fontFamily: 'Roboto Mono, monospace',
                        fontSize: '0.65rem',
                        color: h.key && h.key === cpSortKey ? 'oklch(0.80 0.18 160)' : 'oklch(0.68 0.015 255)',
                        letterSpacing: '0.05em',
                        cursor: h.key ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}
                      onClick={() => {
                        if (!h.key) return;
                        if (cpSortKey === h.key) {
                          setCpSortDir(d => d === 'asc' ? 'desc' : 'asc');
                        } else {
                          setCpSortKey(h.key as 'time' | 'delta');
                          setCpSortDir('desc');
                        }
                      }}
                    >
                      {h.label}
                      {h.key === cpSortKey && <span className="ml-1">{cpSortDir === 'desc' ? '▼' : '▲'}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredChangePoints.map((cp, i) => {
                  const mm = Math.floor(cp.time / 60).toString().padStart(2, '0');
                  const ss = Math.floor(cp.time % 60).toString().padStart(2, '0');
                  const isRise = cp.direction === 'rise';
                  return (
                    <tr key={i} className="row-hover" style={{ borderBottom: '1px solid oklch(0.20 0.04 255)' }}>
                      <td className="py-1.5 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'oklch(0.55 0.015 255)' }}>
                        {cp.time.toFixed(2)}
                      </td>
                      <td className="py-1.5 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: 'oklch(0.55 0.015 255)' }}>
                        {mm}:{ss}
                      </td>
                      <td className="py-1.5 pr-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: EMOTION_COLORS[cp.emotion] || 'oklch(0.68 0.015 255)' }} />
                          <span style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.88 0.005 250)' }}>
                            {EMOTION_LABELS_JA[cp.emotion] || cp.emotion}
                          </span>
                        </div>
                      </td>
                      <td className="py-1.5 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.72rem', color: isRise ? 'oklch(0.72 0.18 160)' : 'oklch(0.62 0.18 25)' }}>
                        {cp.delta > 0 ? '+' : ''}{cp.delta.toFixed(4)}
                      </td>
                      <td className="py-1.5 pr-4" style={{ fontFamily: 'Roboto Mono, monospace', fontSize: '0.8rem', color: isRise ? 'oklch(0.72 0.18 160)' : 'oklch(0.62 0.18 25)' }}>
                        {isRise ? '↑' : '↓'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleCard>
      )}

      {/* Academic Interpretation */}
      <CollapsibleCard
        label="ACADEMIC INTERPRETATION"
        title="学術的解釈と考察"
        tier="pro"
        info="上記の各分析結果を統合し、本セッションの感情ダイナミクスを文章で考察したものです。"
        storageKey="ksdv.collapse.academic.interpretation"
      >
        <div className="space-y-4">
          {interpretationCards.map((item, i) => (
            <div key={i} className="p-4 rounded-lg" style={{ background: 'oklch(0.22 0.04 255)', borderLeft: `3px solid ${item.color}` }}>
              <div style={{ fontFamily: 'Noto Sans JP, sans-serif', fontWeight: 600, fontSize: '0.85rem', color: 'oklch(0.88 0.005 250)', marginBottom: '6px' }}>
                {item.heading}
              </div>
              <p style={{ fontFamily: 'Noto Sans JP, sans-serif', fontSize: '0.78rem', color: 'oklch(0.56 0.015 250)', lineHeight: 1.7 }}>
                {item.content}
              </p>
            </div>
          ))}
        </div>
      </CollapsibleCard>
    </div>
  );
}
