// expr: 構造網羅 + メタモルフィックの題材。骨組み(テストリストのみ)。
// 手法割り当ては src/expr/README.md の対応表を参照。

describe("expr: structural coverage (C0/C1)", () => {
  // 各演算子・括弧・優先順位の分岐を1つずつ通す。
  it.todo("covers +,-,*,/, parentheses, precedence branches");
});

describe("expr: operator precedence decision table", () => {
  // 加減乗除の優先・結合規則を表の各行で。
  it.todo("evaluates per precedence/associativity table");
});

describe("expr: metamorphic relations", () => {
  // 出力の絶対正解を用意せず、関係で縛る。
  it.todo("a+b == b+a (commutative)");
  it.todo("(a+b)+c == a+(b+c) (associative)");
});

describe("expr: invalid class & boundaries", () => {
  // 未定義変数 / ゼロ除算 / 空式 / 深いネスト。
  it.todo("rejects undefined var, division by zero, empty expr");
});
