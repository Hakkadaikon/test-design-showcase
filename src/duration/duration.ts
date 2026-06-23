// duration: "1h30m" 等の文字列 ⇔ 秒数 の相互変換。純関数のみ。
// 受理単位は h/m/s のみ、順序は h→m→s 固定、係数は先頭ゼロ無しの非負整数。

// 全体マッチ正規表現: 先頭ゼロ無しの数値 (0 | [1-9]\d*) + 各単位は高々1回、降順固定。
const PARSE_RE = /^(?:(0|[1-9]\d*)h)?(?:(0|[1-9]\d*)m)?(?:(0|[1-9]\d*)s)?$/;

export function parse(input: string): number {
  const m = PARSE_RE.exec(input);
  // 空文字や正規表現不一致(未知単位/大文字/逆順/重複/非数値/負数/小数/先頭ゼロ/単位なし)は無効。
  // 全項欠落("" もここで全 undefined になり 1 項必須に反するため弾く)。
  if (m === null || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) {
    throw new Error(`invalid duration: ${JSON.stringify(input)}`);
  }
  // 桁あふれ検出は BigInt で行う。Number 演算は MAX_SAFE_INTEGER 超で丸めるため境界判定に使えない。
  const total =
    BigInt(m[1] ?? 0) * 3600n + BigInt(m[2] ?? 0) * 60n + BigInt(m[3] ?? 0);
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`duration overflow: ${JSON.stringify(input)}`);
  }
  return Number(total);
}

export function format(seconds: number): string {
  if (seconds < 0 || !Number.isInteger(seconds)) {
    throw new Error(`invalid seconds: ${seconds}`);
  }
  if (seconds === 0) return "0s";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return (h ? `${h}h` : "") + (m ? `${m}m` : "") + (s ? `${s}s` : "");
}
