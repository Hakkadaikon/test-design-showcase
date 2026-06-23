// expr: 構造網羅 + メタモルフィックの題材。手法割り当ては src/expr/README.md と tasks/expr-extract.md を参照。
import fc from "fast-check";
import { evaluate } from "../src/expr/expr";

describe("expr: structural coverage (C0/C1)", () => {
  // T-001..T-008: 文法の各規則(expr/term/factor)・各演算子・括弧・優先順位・変数・リテラルの分岐を1つずつ通す。
  it.each([
    { src: "1+2", env: undefined, expected: 3 }, // T-001 expr の + 分岐
    { src: "5-3", env: undefined, expected: 2 }, // T-002 expr の - 分岐
    { src: "4*3", env: undefined, expected: 12 }, // T-003 term の * 分岐
    { src: "8/2", env: undefined, expected: 4 }, // T-004 term の / 分岐
    { src: "(1+2)*3", env: undefined, expected: 9 }, // T-005 factor の括弧分岐(優先上書き)
    { src: "1+2*3", env: undefined, expected: 7 }, // T-006 乗算が加算より先(括弧無し)
    { src: "x", env: { x: 5 }, expected: 5 }, // T-007 factor の ident 分岐
    { src: "42", env: undefined, expected: 42 }, // T-008 factor の number 分岐(二項ループ0回)
  ])("evaluate($src) === $expected", ({ src, env, expected }) => {
    expect(evaluate(src, env)).toBe(expected);
  });
});

describe("expr: operator precedence decision table", () => {
  // T-009..T-014: 優先順位と左結合の規則を表の各行で確かめる。期待値は手計算で固定。
  it.each([
    { src: "2-1-1", expected: 0 }, // T-009 減算は左結合 (2-1)-1
    { src: "8/2/2", expected: 2 }, // T-010 除算は左結合 (8/2)/2
    { src: "2+3*4-1", expected: 13 }, // T-011 * が先: 2+12-1
    { src: "2*3+4*5", expected: 26 }, // T-012 6+20
    { src: "(2+3)*4", expected: 20 }, // T-013 括弧で順序逆転
    { src: "10-2*3", expected: 4 }, // T-014 10-6
  ])("evaluate($src) === $expected", ({ src, expected }) => {
    expect(evaluate(src)).toBe(expected);
  });
});

describe("expr: metamorphic relations", () => {
  // T-015..T-018: 出力の絶対正解を用意せず、整数の加算・乗算の代数的関係で縛る。
  // 比較は数値等価(===)で行う。toBe(Object.is)は -0 と +0 を区別し、
  // 0*(-1) のような式が生む負ゼロで関係が偽陽性に落ちるため使わない。
  const int = fc.integer({ min: -1000, max: 1000 });
  const same = (l: number, r: number) => expect(l === r).toBe(true);

  it("a+b == b+a (addition is commutative)", () => {
    // T-015
    fc.assert(
      fc.property(int, int, (a, b) => {
        same(evaluate("x+y", { x: a, y: b }), evaluate("x+y", { x: b, y: a }));
      }),
    );
  });

  it("(a+b)+c == a+(b+c) (addition is associative)", () => {
    // T-016
    fc.assert(
      fc.property(int, int, int, (a, b, c) => {
        const env = { x: a, y: b, z: c };
        same(evaluate("(x+y)+z", env), evaluate("x+(y+z)", env));
      }),
    );
  });

  it("a*b == b*a (multiplication is commutative)", () => {
    // T-017
    fc.assert(
      fc.property(int, int, (a, b) => {
        same(evaluate("x*y", { x: a, y: b }), evaluate("x*y", { x: b, y: a }));
      }),
    );
  });

  it("a*(b+c) == a*b+a*c (multiplication distributes over addition)", () => {
    // T-018
    fc.assert(
      fc.property(int, int, int, (a, b, c) => {
        const env = { x: a, y: b, z: c };
        same(evaluate("x*(y+z)", env), evaluate("x*y+x*z", env));
      }),
    );
  });
});

describe("expr: invalid class & boundaries", () => {
  // T-019..T-027: 無効クラスの代表入力。各々 throw する。
  it.each([
    { src: "x", env: undefined }, // T-019 未定義変数(env 無し)
    { src: "x+1", env: { y: 1 } }, // T-020 env にキーが無い
    { src: "1/0", env: undefined }, // T-021 ゼロ除算
    { src: "", env: undefined }, // T-022 空式
    { src: "   ", env: undefined }, // T-023 空白のみ
    { src: "(1+2", env: undefined }, // T-024 括弧不一致(閉じ欠落)
    { src: "1+2)", env: undefined }, // T-025 括弧不一致(開き欠落)
    { src: "1%2", env: undefined }, // T-026 不正文字
    { src: "1+", env: undefined }, // T-027 オペランド欠落
  ])("evaluate($src) throws", ({ src, env }) => {
    expect(() => evaluate(src, env)).toThrow();
  });

  // T-028: 深いネストでも落ちず正しく評価する(再帰の深さの境界)。
  it("handles deeply nested parentheses", () => {
    expect(evaluate("((((1))))")).toBe(1);
  });

  // T-029: 長い加算列でも落ちず正しく評価する(二項演算ループの反復境界)。
  it("handles a long chain of additions", () => {
    const src = Array(20).fill("1").join("+"); // 1+1+...+1 (20 項)
    expect(evaluate(src)).toBe(20);
  });
});
