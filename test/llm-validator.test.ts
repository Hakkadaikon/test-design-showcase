// llm-validator: 非決定的出力の階層化品質設計の題材。骨組み(テストリストのみ)。
// 手法割り当ては src/llm-validator/README.md の3層対応表を参照。

describe("llm-validator: entry layer (input validation)", () => {
  // 決定的に検査できる。同値分割・境界値で不正入力を網羅的に拒否。
  it.todo("rejects schema-violating and boundary inputs");
});

describe("llm-validator: core layer (properties + consensus)", () => {
  // 揺らぎは単発の正解でなく性質と合意で抑える。
  it.todo("output always conforms to schema / invariants (fc.property over samples)");
  it.todo("N samples reach majority consensus above threshold");
});

describe("llm-validator: exit layer (post-validation)", () => {
  // 判定を外部化し、最終出力が制約を満たすことを決定的に保証。
  it.todo("post-validator catches constraint violations deterministically");
});
