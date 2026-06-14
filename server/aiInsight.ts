/**
 * server/aiInsight.ts
 * AIインサイト機能の共有ハンドラ（プロバイダ非依存）。
 *
 * 開発時（Vite devミドルウェア）と本番（Express）の両方から呼ばれる。
 * LLMプロバイダは「アダプタ」で切り替える:
 *   - 既定: Google Gemini（GEMINI_API_KEY）
 *   - 代替: Anthropic Claude（ANTHROPIC_API_KEY）
 * 環境変数 KSDV_AI_PROVIDER（'gemini' | 'anthropic'）で選択（未指定なら 'gemini'）。
 *
 * 受け取るのは client/src/lib/buildAiPayload.ts が作る「集計ペイロード」のみ。
 * 生フレームや顔座標は最初から含まれない設計。ここではさらに送信サイズ上限で防御する。
 * ネイティブ fetch を使い、追加依存は持たない（Node18+ 前提）。
 */

/** 送信ペイロードの上限（集計のみなので十分小さい想定。生データ混入の保険も兼ねる）。 */
const MAX_PAYLOAD_BYTES = 256 * 1024; // 256KB

/** 応答テキストから期待するトークン量の上限 */
const MAX_OUTPUT_TOKENS = 2000;

export interface AiHandlerResult {
  status: number;
  body: Record<string, unknown>;
}

/** 環境変数アクセス用の型（process.env でも loadEnv 結果でも受けられる）。 */
export type EnvMap = Record<string, string | undefined>;

// ─────────────────────────────────────────────────────────────
// プロバイダ・アダプタ
// ─────────────────────────────────────────────────────────────

interface ProviderCallArgs {
  system: string;
  userContent: string;
  model: string;
  apiKey: string;
}

interface ProviderCallResult {
  ok: boolean;
  /** ok=false のときに利用者へ返すHTTPステータス（502/503 等） */
  status: number;
  /** モデルの生成テキスト（ok=true のとき） */
  text: string;
  /** サーバログにのみ残すエラー詳細（利用者には返さない） */
  errorDetail?: string;
}

interface ProviderConfig {
  /** 表示用のプロバイダ名 */
  label: string;
  /** APIキーを格納する環境変数名 */
  envKey: string;
  /** 既定モデル */
  defaultModel: string;
  /** 許可するモデル（payload.model はこの集合でのみ受け付ける） */
  allowedModels: Set<string>;
  /** 実際にAPIを叩く */
  call(args: ProviderCallArgs): Promise<ProviderCallResult>;
}

/** Google Gemini アダプタ（既定）。 */
const geminiProvider: ProviderConfig = {
  label: 'Google Gemini',
  envKey: 'GEMINI_API_KEY',
  defaultModel: 'gemini-2.5-flash',
  allowedModels: new Set(['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash']),
  async call({ system, userContent, model, apiKey }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts: [{ text: userContent }] }],
          generationConfig: {
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            // Gemini はネイティブにJSON強制できる（解析の堅牢性が上がる）
            responseMimeType: 'application/json',
            temperature: 0.4,
          },
        }),
      });
    } catch (e) {
      return { ok: false, status: 502, text: '', errorDetail: `fetch failed: ${String(e)}` };
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, status: 502, text: '', errorDetail: `HTTP ${res.status} ${detail.slice(0, 500)}` };
    }
    const json: any = await res.json().catch(() => null);
    const text: string =
      json?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
    return { ok: true, status: 200, text };
  },
};

/** Anthropic Claude アダプタ（代替）。 */
const anthropicProvider: ProviderConfig = {
  label: 'Anthropic Claude',
  envKey: 'ANTHROPIC_API_KEY',
  defaultModel: 'claude-sonnet-4-6',
  allowedModels: new Set(['claude-sonnet-4-6', 'claude-opus-4-8']),
  async call({ system, userContent, model, apiKey }) {
    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system,
          messages: [{ role: 'user', content: userContent }],
        }),
      });
    } catch (e) {
      return { ok: false, status: 502, text: '', errorDetail: `fetch failed: ${String(e)}` };
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, status: 502, text: '', errorDetail: `HTTP ${res.status} ${detail.slice(0, 500)}` };
    }
    const json: any = await res.json().catch(() => null);
    const text: string =
      json?.content?.map((c: any) => (c?.type === 'text' ? c.text : '')).join('') ?? '';
    return { ok: true, status: 200, text };
  },
};

const PROVIDERS: Record<string, ProviderConfig> = {
  gemini: geminiProvider,
  anthropic: anthropicProvider,
};

/** env からアクティブなプロバイダを解決する（未指定/不正なら gemini）。 */
function resolveProvider(env: EnvMap): { name: string; config: ProviderConfig } {
  const raw = (env.KSDV_AI_PROVIDER ?? 'gemini').toLowerCase().trim();
  const config = PROVIDERS[raw] ?? PROVIDERS.gemini;
  const name = PROVIDERS[raw] ? raw : 'gemini';
  return { name, config };
}

// ─────────────────────────────────────────────────────────────
// プロバイダ非依存のロジック
// ─────────────────────────────────────────────────────────────

/** ペルソナ別のフレーミング指示（読み手に合わせたトーン）。 */
const PERSONA_GUIDE: Record<string, string> = {
  researcher:
    '読み手は研究者・リサーチャー。再現性・効果量・前提条件を重視し、学術的に慎重な表現を用いる。',
  ux: '読み手はUXリサーチャー。タスク中の摩擦・離脱・デライトの所在と、次の検証アクションに繋がる示唆を重視する。',
  marketer:
    '読み手はマーケター。感情反応の強弱とその根拠を、施策判断（残す/削る/訴求変更）に繋がる形で示す。ただしKPIの保証はしない。',
};

/**
 * 誠実ガードレールを内蔵したシステムプロンプトを組み立てる。
 * KSDVの設計メモ（ゼロ過多分布・擬似反復・ベースライン前提）に反する過大主張を禁じる。
 * プロバイダに依存しない（Gemini/Claude 共通）。
 */
function buildSystemPrompt(persona: string, lang: string): string {
  const langLine =
    lang === 'en' ? 'Write the entire output in English.' : '出力は日本語で書く。';
  const personaLine = PERSONA_GUIDE[persona] ?? PERSONA_GUIDE.researcher;

  return [
    'あなたは表情感情分析ダッシュボード「KSDV」の解析アシスタントです。',
    '入力は1セッションぶんの「集計済み指標」（生の顔座標・映像は含まれません）です。',
    'この集計データだけを根拠に、専門的だが平易な所見を述べてください。',
    '',
    '【厳守する誠実ルール】',
    '1. 因果を断定しない（「Aが原因でBになった」とは書かない。相関・傾向に留める）。',
    '2. 感情スコアはゼロ過多分布（大半が低値で時々スパイク）。平均だけで語らず、変動(SD/MSSD)やスパイク(変化点)も併せて解釈する。',
    '3. フレーム単位の統計は強く自己相関し擬似反復に当たる。有意性を強調せず、提示された n_eff（実効サンプルサイズ）を必ず引用し、フレーム数=独立標本ではない旨を添える。',
    '4. これは1セッションの記述的観察であり、被験者集団への一般化や母集団推論はできないと明示する。',
    '5. データに無い数値を創作しない。不確実なものは confidence を low にする。',
    '',
    `【読み手】${personaLine}`,
    langLine,
    '',
    '【出力形式】次のJSONのみを返す（前後に文章やコードフェンスを付けない）:',
    '{',
    '  "summary": "全体を3〜5文で要約",',
    '  "findings": [',
    '    {"title":"短い見出し","detail":"2〜4文の説明","confidence":"low|medium|high","caveats":["注意点"]}',
    '  ],',
    '  "suggestions": ["次に取りうる検証・施策のヒント（断定でなく提案）"],',
    '  "limitations": ["この解析の限界（擬似反復・1セッション記述・ゼロ過多など該当するもの）"]',
    '}',
    'findings は3〜6件。各 caveats は0〜2件。',
  ].join('\n');
}

/**
 * モデル応答テキストから JSON を取り出す。素のJSON想定だが、
 * 万一コードフェンスや前後文が付いても最初の { 〜 最後の } を拾って耐える。
 */
function extractJson(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fallthrough */
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * AIインサイトの本処理。
 * @param rawBody リクエストボディ（オブジェクト or 文字列）
 * @param env     環境変数マップ（process.env もしくは Vite の loadEnv 結果）。
 *                プロバイダ選択（KSDV_AI_PROVIDER）と各APIキーをここから読む。
 */
export async function handleAiInsight(
  rawBody: unknown,
  env: EnvMap,
): Promise<AiHandlerResult> {
  const { name: providerName, config: provider } = resolveProvider(env);
  const apiKey = env[provider.envKey];

  if (!apiKey) {
    return {
      status: 503,
      body: {
        error: `AI機能が未設定です（サーバに ${provider.envKey} がありません）。`,
      },
    };
  }

  // ボディの正規化とサイズ防御
  let payload: any;
  try {
    const asText = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody ?? {});
    if (Buffer.byteLength(asText, 'utf-8') > MAX_PAYLOAD_BYTES) {
      return { status: 413, body: { error: '送信データが大きすぎます。' } };
    }
    payload = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
  } catch {
    return { status: 400, body: { error: 'リクエストの形式が不正です。' } };
  }

  if (!payload || payload.schema !== 'ksdv.ai-insight.payload.v1') {
    return { status: 400, body: { error: 'ペイロードのスキーマが不正です。' } };
  }

  const persona = String(payload.persona ?? 'researcher');
  const lang = payload.lang === 'en' ? 'en' : 'ja';
  // モデルはアクティブなプロバイダの許可リストでのみ受け付ける（他社モデル名は既定にフォールバック）
  const model = provider.allowedModels.has(payload.model) ? payload.model : provider.defaultModel;

  const system = buildSystemPrompt(persona, lang);
  // ユーザーメッセージには集計ペイロードのみを渡す（人物特定情報は含まれない）
  const userContent = '次の集計データを解析してください:\n' + JSON.stringify(payload, null, 0);

  const result = await provider.call({ system, userContent, model, apiKey });

  if (!result.ok) {
    // APIキーや課金エラー等。詳細はサーバログにのみ残し、利用者にはステータスのみ返す。
    console.error(`[ai-insight] ${providerName} error`, result.errorDetail ?? '');
    return {
      status: result.status,
      body: { error: `AI解析に失敗しました（${providerName}）。時間をおいて再試行してください。` },
    };
  }

  const parsed = extractJson(result.text);
  if (!parsed) {
    return { status: 502, body: { error: 'AIの応答を解釈できませんでした。再試行してください。' } };
  }

  return {
    status: 200,
    body: {
      provider: providerName,
      model,
      persona,
      lang,
      generated_at: new Date().toISOString(),
      insight: parsed,
    },
  };
}
