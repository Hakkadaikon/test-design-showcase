// expr: 整数・変数・四則演算・括弧の式評価器。再帰下降で評価しながら下る。
// 文法(優先順位順): expr = term (("+"|"-") term)*; term = factor (("*"|"/") factor)*; factor = number | ident | "(" expr ")"
// 空白は無視。除算は通常の数値除算。異常系(空式・未定義変数・ゼロ除算・構文エラー)は throw。

export function evaluate(src: string, env: Record<string, number> = {}): number {
  let i = 0; // 現在位置

  const skipWs = () => {
    while (i < src.length && (src[i] === " " || src[i] === "\t")) i++;
  };
  // 次の非空白文字を覗く(終端なら undefined)。
  const peek = (): string | undefined => {
    skipWs();
    return src[i];
  };

  const parseExpr = (): number => {
    let acc = parseTerm();
    for (let op = peek(); op === "+" || op === "-"; op = peek()) {
      i++;
      const rhs = parseTerm();
      acc = op === "+" ? acc + rhs : acc - rhs;
    }
    return acc;
  };

  const parseTerm = (): number => {
    let acc = parseFactor();
    for (let op = peek(); op === "*" || op === "/"; op = peek()) {
      i++;
      const rhs = parseFactor();
      if (op === "/" && rhs === 0) throw new Error("division by zero");
      acc = op === "*" ? acc * rhs : acc / rhs;
    }
    return acc;
  };

  const parseFactor = (): number => {
    const c = peek();
    if (c === undefined) throw new Error("unexpected end of input");
    if (c === "(") {
      i++;
      const inner = parseExpr();
      if (peek() !== ")") throw new Error("missing closing parenthesis");
      i++;
      return inner;
    }
    if (c >= "0" && c <= "9") {
      let num = "";
      while (i < src.length && src[i]! >= "0" && src[i]! <= "9") num += src[i++];
      return Number(num);
    }
    if (/[a-zA-Z]/.test(c)) {
      let name = "";
      while (i < src.length && /[a-zA-Z]/.test(src[i]!)) name += src[i++];
      const value = env[name];
      if (value === undefined) throw new Error(`undefined variable: ${name}`);
      return value;
    }
    throw new Error(`unexpected character: ${JSON.stringify(c)}`);
  };

  const result = parseExpr();
  // 余り(閉じ括弧の超過・不正文字)が残っていれば構文エラー。
  if (peek() !== undefined) throw new Error(`unexpected trailing input: ${JSON.stringify(src.slice(i))}`);
  return result;
}
