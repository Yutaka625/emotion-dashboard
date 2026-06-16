import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  FileText,
  GitCompare,
  LineChart,
  Lock,
  MousePointer2,
  ScanFace,
  Sparkles,
  Upload,
} from 'lucide-react';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const appHref = `${basePath || ''}/`;

const problems = [
  'CSVを見ても、どの瞬間に反応が動いたのか分かりにくい',
  'アンケートや発話だけでは、言葉にならない反応を拾いきれない',
  '複数人・A/B・ベースライン比較を自前で作るのに時間がかかる',
  '研究・PoCのたびに分析手順が属人化し、共有しづらい',
];

const values = [
  {
    title: '反応の瞬間を見つける',
    text: '時系列グラフと変化点検出で、対象者の表情反応が動いたタイミングをすばやく確認できます。',
    icon: LineChart,
  },
  {
    title: '比較して判断する',
    text: 'A/Bセッション、複数FaceID、ベースライン補正を使って、条件差や個人差を見比べられます。',
    icon: GitCompare,
  },
  {
    title: '報告に使える形にする',
    text: '感情統計、UX指標、学術的指標を整理し、検討会・研究・PoCの説明材料にしやすくします。',
    icon: FileText,
  },
];

const capabilities = [
  '10感情の時系列・分布',
  'Engagement / Valence / Attention',
  'アクションユニット分析',
  '感情変化点の検出',
  'UXスコア・フリクション・デライト',
  'A/Bセッション比較',
  'マルチFaceID比較',
  'ベースライン補正',
  'CSVレポート出力',
];

const useCases = [
  {
    label: '学術研究',
    title: '表情反応を、再現性のある分析材料へ',
    text: 'Affect Dynamics、相関、Circumplex Model、CSV出力を使い、研究データの下処理と探索を短縮します。',
  },
  {
    label: '製品開発・UX',
    title: 'つまずきや違和感の瞬間を見つける',
    text: 'タスク中の困惑、フラストレーション、デライトを可視化し、改善箇所の仮説づくりに役立てます。',
  },
  {
    label: 'マーケティング',
    title: '広告・動画・訴求への反応を比較する',
    text: 'メッセージやクリエイティブごとの関与度・感情価を比較し、次の改善案を検討できます。',
  },
  {
    label: 'PoC',
    title: 'まず小さく試し、関係者に見せられる形へ',
    text: '心sensorのログをその場で可視化し、導入価値や追加検証の方向性を共有しやすくします。',
  },
];

const steps = [
  { title: '心sensorで計測', text: '対象者の表情解析ログをCSVで取得します。' },
  { title: 'KSDVにアップロード', text: 'CSVをドラッグ&ドロップするだけで解析を開始します。' },
  { title: '反応を確認', text: '時系列・感情分布・UX指標・比較結果を画面で確認します。' },
  { title: '改善や報告へ', text: '結果をCSVで出力し、研究・開発・マーケティングの検討に使います。' },
];

function HeroPreview() {
  return (
    <div className="landing-preview" aria-label="KSDV dashboard preview">
      <div className="landing-preview__top">
        <div>
          <span>KSDV ANALYSIS</span>
          <strong>emotion-log_2026.csv</strong>
        </div>
        <div className="landing-preview__status">Browser-side</div>
      </div>
      <div className="landing-preview__chart">
        <svg viewBox="0 0 520 190" role="img" aria-label="Emotion timeline chart preview">
          <defs>
            <linearGradient id="timelineFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.70 0.14 195 / 0.34)" />
              <stop offset="100%" stopColor="oklch(0.70 0.14 195 / 0.02)" />
            </linearGradient>
          </defs>
          {[35, 70, 105, 140, 175].map(y => (
            <line key={y} x1="24" x2="500" y1={y} y2={y} stroke="oklch(0.34 0.04 255)" strokeWidth="1" />
          ))}
          <path
            d="M28 145 C72 120 90 82 135 96 C168 106 172 58 215 66 C252 73 254 132 299 118 C342 104 349 42 392 58 C430 72 444 126 498 92"
            fill="none"
            stroke="oklch(0.70 0.14 195)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M28 145 C72 120 90 82 135 96 C168 106 172 58 215 66 C252 73 254 132 299 118 C342 104 349 42 392 58 C430 72 444 126 498 92 L498 176 L28 176 Z"
            fill="url(#timelineFill)"
          />
          <path
            d="M28 112 C75 124 98 136 136 118 C178 98 199 146 239 126 C286 102 308 112 340 93 C384 68 420 112 498 76"
            fill="none"
            stroke="oklch(0.78 0.14 82)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray="8 8"
          />
          <line x1="392" x2="392" y1="26" y2="176" stroke="oklch(0.72 0.16 140)" strokeWidth="2" strokeDasharray="4 7" />
          <circle cx="392" cy="58" r="6" fill="oklch(0.72 0.16 140)" />
        </svg>
      </div>
      <div className="landing-preview__metrics">
        {[
          ['Engagement', '72.4'],
          ['Valence', '+18.6'],
          ['Change Points', '20'],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-header">
        <a className="landing-brand" href={appHref} aria-label="KSDV app home">
          <ScanFace size={26} />
          <span>
            <strong>KSDV</strong>
            <small>Kokoro Sensor Data Visualizer</small>
          </span>
        </a>
        <nav aria-label="Landing page navigation">
          <a href="#value">提供価値</a>
          <a href="#capabilities">できること</a>
          <a href="#usecases">用途</a>
          <a className="landing-header__cta" href={appHref}>使ってみる</a>
        </nav>
      </header>

      <section className="landing-hero">
        <div className="landing-hero__copy">
          <h1>心sensorの感情ログを、すぐに読める分析ダッシュボードへ</h1>
          <p>
            KSDVは、心sensorの表情解析CSVをアップロードするだけで、対象者の反応を
            時系列・感情分布・UX指標・A/B比較で可視化できるWebアプリです。
          </p>
          <div className="landing-actions">
            <a className="landing-button landing-button--primary" href={appHref}>
              KSDVを使ってみる <ArrowRight size={18} />
            </a>
            <a className="landing-button landing-button--secondary" href={appHref}>
              サンプルで見る
            </a>
          </div>
          <p className="landing-note">心sensor契約者は2026年12月末まで無償で利用できます。</p>
        </div>
        <HeroPreview />
      </section>

      <section className="landing-section landing-problems">
        <div className="landing-section__intro">
          <h2>感情ログ、取得したあと活用できていますか？</h2>
          <p>表情解析のログは価値のあるデータです。ただ、CSVのままでは現場の判断材料に変えるまでが大変です。</p>
        </div>
        <div className="landing-problem-list">
          {problems.map(problem => (
            <div key={problem} className="landing-problem-item">
              <MousePointer2 size={18} />
              <span>{problem}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="value" className="landing-section">
        <div className="landing-section__intro">
          <h2>反応を見つけ、比較し、次の判断につなげる</h2>
          <p>KSDVは、感情を断定するためのツールではありません。心sensorの表情ログを、研究・評価・改善の補助指標として扱いやすくします。</p>
        </div>
        <div className="landing-value-grid">
          {values.map(({ title, text, icon: Icon }) => (
            <article key={title} className="landing-value-card">
              <Icon size={26} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="capabilities" className="landing-section landing-capabilities">
        <div className="landing-section__intro">
          <h2>CSVをアップロードするだけで、ここまで見える</h2>
          <p>研究者・UXリサーチャー・マーケターがよく確認する観点を、ひとつのダッシュボードにまとめています。</p>
        </div>
        <div className="landing-capability-grid">
          {capabilities.map(item => (
            <div key={item} className="landing-capability">
              <CheckCircle2 size={17} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="usecases" className="landing-section">
        <div className="landing-section__intro">
          <h2>学術研究からPoCまで、反応データを使える形に</h2>
          <p>対象者の表情反応を、プロジェクトの目的に合わせて読み解くための入口になります。</p>
        </div>
        <div className="landing-usecase-grid">
          {useCases.map(useCase => (
            <article key={useCase.label} className="landing-usecase">
              <span>{useCase.label}</span>
              <h3>{useCase.title}</h3>
              <p>{useCase.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-workflow">
        <div className="landing-section__intro">
          <h2>使い方はシンプルです</h2>
          <p>専用の分析環境を作らなくても、心sensorのCSVからすぐに可視化を始められます。</p>
        </div>
        <div className="landing-steps">
          {steps.map((step, index) => (
            <article key={step.title} className="landing-step">
              <strong>{index + 1}</strong>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-trust">
        <div>
          <Lock size={30} />
          <h2>データはブラウザ内で処理</h2>
          <p>
            KSDVは、アップロードされたCSVをブラウザ側で解析します。サーバーに感情ログを送信せず、
            研究・評価の補助指標として扱いやすい形に整理します。
          </p>
        </div>
        <div className="landing-trust__items">
          <span><Database size={17} /> サーバー送信なし</span>
          <span><Upload size={17} /> CSVをその場で解析</span>
          <span><BarChart3 size={17} /> 結果を画面とCSVで確認</span>
        </div>
      </section>

      <section className="landing-final">
        <Sparkles size={34} />
        <h2>まずは、手元のCSVで試してみてください。</h2>
        <p>
          2026年12月末までは、心sensor契約者は無償で利用できます。
          2027年以降は一部機能の有償化を予定していますが、無償で使える部分も残る予定です。
        </p>
        <div className="landing-actions">
          <a className="landing-button landing-button--primary" href={appHref}>
            KSDVを使ってみる <ArrowRight size={18} />
          </a>
          <a className="landing-button landing-button--secondary" href={appHref}>
            サンプルで見る
          </a>
        </div>
      </section>
    </main>
  );
}
