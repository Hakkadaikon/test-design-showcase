// 非決定的分類器(LLM 相当)の出力を3層で品質保証するバリデータ。
// 入口層・出口層は決定的に検査でき、中央層だけが揺らぐ。揺らぎは性質と合意で抑える。

const LABELS = ["positive", "negative", "neutral"] as const;
const MAX_LEN = 1000;

// 入口層(決定的): 入力検証を純関数で。正常なら trim した文字列を返す。
export function validateInput(text: unknown): string {
  if (typeof text !== "string") throw new Error("input must be a string");
  const trimmed = text.trim();
  if (trimmed === "") throw new Error("input must not be empty");
  if (trimmed.length > MAX_LEN) throw new Error(`input exceeds ${MAX_LEN} chars`);
  return trimmed;
}

// 中央層: 非決定的分類器の型。注入する純粋関数として扱う(モック濫用しない)。
export type Classifier = (text: string) => string;

// 中央層(揺らぎを許すが性質で縛る): 同一入力を samples 回引き多数決。
// 許可集合外のサンプルは合意計算から除外。有効サンプル0なら throw。
export function classifyWithConsensus(
  text: string,
  clf: Classifier,
  samples: number,
): { label: string; agreement: number } {
  if (samples < 1) throw new Error("samples must be >= 1");
  const counts = new Map<string, number>();
  let valid = 0;
  for (let i = 0; i < samples; i++) {
    const out = clf(text);
    if (!(LABELS as readonly string[]).includes(out)) continue; // スキーマ強制: 無効は除外
    counts.set(out, (counts.get(out) ?? 0) + 1);
    valid++;
  }
  if (valid === 0) throw new Error("no valid samples (all schema-violating)");
  // 最頻ラベル。タイは初出順(Map の挿入順)で決定的に選ぶ。
  let label = "";
  let best = 0;
  for (const [k, v] of counts) {
    if (v > best) {
      best = v;
      label = k;
    }
  }
  return { label, agreement: best / valid };
}

// 出口層(決定的): 後段バリデーション。被検査モデル自身に合否を委ねない。
export function assertValidLabel(
  result: { label: string; agreement: number },
  threshold: number,
): { label: string } {
  if (!(LABELS as readonly string[]).includes(result.label))
    throw new Error(`label not allowed: ${result.label}`);
  if (result.agreement < threshold)
    throw new Error(`agreement ${result.agreement} below threshold ${threshold}`);
  return { label: result.label };
}
