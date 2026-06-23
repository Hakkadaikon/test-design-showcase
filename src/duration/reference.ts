// 差分テスト用の独立な参照実装。本実装(全体マッチ正規表現)とは別アルゴリズム:
// 文字を1つずつ走査し、数値バッファと単位トークンの列に分解してから検証する手書きスキャナ。
// 同じ正規/異常判定を返すこと(本実装をコピペしない)。

const ORDER = ["h", "m", "s"] as const;
type Unit = (typeof ORDER)[number];

export function parseReference(input: string): number {
  const tokens: { value: string; unit: Unit }[] = [];
  let digits = "";
  for (const ch of input) {
    if (ch >= "0" && ch <= "9") {
      digits += ch;
      continue;
    }
    if (ch === "h" || ch === "m" || ch === "s") {
      if (digits === "") throw new Error("missing number before unit");
      tokens.push({ value: digits, unit: ch });
      digits = "";
      continue;
    }
    // 数字でも受理単位でもない文字(大文字 H、d、小数点、符号、英字など)は無効。
    throw new Error(`unexpected char: ${ch}`);
  }
  if (digits !== "") throw new Error("trailing number without unit");
  if (tokens.length === 0) throw new Error("empty");

  // 順序と重複の検証: ORDER 上で単調増加(同単位重複・逆順を弾く)。
  let prev = -1;
  let total = 0n;
  for (const t of tokens) {
    const idx = ORDER.indexOf(t.unit);
    if (idx <= prev) throw new Error("out of order or duplicate unit");
    prev = idx;
    // 先頭ゼロの禁止(本実装の正規表現 (0|[1-9]\d*) と同じ判定)。
    if (t.value.length > 1 && t.value[0] === "0") {
      throw new Error("leading zero");
    }
    const factor = t.unit === "h" ? 3600n : t.unit === "m" ? 60n : 1n;
    total += BigInt(t.value) * factor;
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("overflow");
  return Number(total);
}
