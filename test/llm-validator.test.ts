// llm-validator: 非決定的出力の階層化品質設計の題材。
// LLM 本体はフェイク(注入された純粋関数 Classifier)で差し替える。実 API は呼ばない。
// 手法割り当ては src/llm-validator/README.md の3層対応表 / tasks/llm-validator-extract.md を参照。
import fc from "fast-check";
import {
  validateInput,
  classifyWithConsensus,
  assertValidLabel,
  type Classifier,
} from "../src/llm-validator/validator";

const LABELS = ["positive", "negative", "neutral"] as const;

describe("llm-validator: entry layer (input validation)", () => {
  // 決定的に検査できる層。同値分割・境界値で不正入力を網羅的に弾く。

  // T-001..002: 正常入力はそのまま / trim される。
  it.each([
    { input: "hello", expected: "hello" }, // T-001
    { input: " hi ", expected: "hi" }, // T-002 正規化(trim)
  ])("validateInput(%j) === expected", ({ input, expected }) => {
    expect(validateInput(input)).toBe(expected);
  });

  // T-003..007: 無効クラス(空・空白・非文字列)は throw。
  it.each([
    { name: "empty string (T-003)", input: "" },
    { name: "whitespace only (T-004)", input: "   " },
    { name: "number (T-005)", input: 123 },
    { name: "null (T-006)", input: null },
    { name: "undefined (T-007)", input: undefined },
  ])("validateInput rejects $name", ({ input }) => {
    expect(() => validateInput(input)).toThrow();
  });

  // T-008..009: 長さ境界。1000字 OK / 1001字 NG。
  it("accepts exactly 1000 chars (boundary OK, T-008)", () => {
    const s = "a".repeat(1000);
    expect(validateInput(s)).toBe(s);
  });
  it("rejects 1001 chars (boundary NG, T-009)", () => {
    expect(() => validateInput("a".repeat(1001))).toThrow();
  });
});

describe("llm-validator: core layer (properties)", () => {
  // 揺らぎは単発の正解でなく性質で抑える。フェイク分類器を fast-check で揺らがせる。

  // 許可ラベルからランダムに返すフェイク分類器を生成する arbitrary。
  const okClassifier = fc
    .array(fc.constantFrom(...LABELS), { minLength: 1, maxLength: 20 })
    .map((seq): Classifier => {
      let i = 0;
      return () => seq[i++ % seq.length]!;
    });

  // スキーマ外ラベルを混ぜるフェイク(有効ラベルも最低1つ混ぜ、有効0 throw を避ける)。
  const noisyClassifier = fc
    .array(fc.oneof(fc.constantFrom(...LABELS), fc.constant("angry"), fc.constant("")), {
      minLength: 1,
      maxLength: 20,
    })
    .map((seq): Classifier => {
      // 先頭に有効ラベルを置き、samples>=1 で必ず有効サンプルが1つ以上出るようにする。
      const withValid = ["positive", ...seq];
      let i = 0;
      return () => withValid[i++ % withValid.length]!;
    });

  // T-010..011: 許可ラベルだけ返すフェイクで INV-1/INV-2。
  it("output label is always in the allowed set and 0<=agreement<=1 (T-010,T-011)", () => {
    fc.assert(
      fc.property(okClassifier, fc.integer({ min: 1, max: 15 }), (clf, samples) => {
        const r = classifyWithConsensus("x", clf, samples);
        expect(LABELS).toContain(r.label);
        expect(r.agreement).toBeGreaterThanOrEqual(0);
        expect(r.agreement).toBeLessThanOrEqual(1);
      }),
    );
  });

  // T-012: スキーマ外を混ぜても出力 label は許可集合内(無効は除外される)。
  it("label stays in allowed set even when schema-violating samples are mixed (T-012)", () => {
    fc.assert(
      fc.property(noisyClassifier, fc.integer({ min: 1, max: 15 }), (clf, samples) => {
        const r = classifyWithConsensus("x", clf, samples);
        expect(LABELS).toContain(r.label);
        expect(r.agreement).toBeGreaterThanOrEqual(0);
        expect(r.agreement).toBeLessThanOrEqual(1);
      }),
    );
  });
});

describe("llm-validator: core layer (consensus)", () => {
  // 揺らぎを固定して合意ロジックを決定的に検査する。

  // T-013: 常に同じラベル → 合意率 1。
  it("constant classifier yields agreement===1 (T-013)", () => {
    const r = classifyWithConsensus("x", () => "positive", 7);
    expect(r.label).toBe("positive");
    expect(r.agreement).toBe(1);
  });

  // T-014: positive 3 / negative 2 の決定的な列 → 最頻 positive, agreement 3/5。
  it("majority label is selected with correct agreement (T-014)", () => {
    const seq = ["positive", "negative", "positive", "negative", "positive"];
    let i = 0;
    const r = classifyWithConsensus("x", () => seq[i++]!, 5);
    expect(r.label).toBe("positive");
    expect(r.agreement).toBeCloseTo(3 / 5);
  });

  // T-015: 全サンプルがスキーマ外 → 有効サンプル0で throw。
  it("throws when all samples are schema-violating (T-015)", () => {
    expect(() => classifyWithConsensus("x", () => "angry", 5)).toThrow();
  });
});

describe("llm-validator: exit layer (post-validation)", () => {
  // 判定を決定論的検証器で外部化。被検査モデル自身に合否を委ねない。

  // T-016,T-017: 許可ラベル かつ agreement>=threshold は通る(境界ちょうど含む)。
  it.each([
    { label: "positive", agreement: 0.9, threshold: 0.8 }, // T-016
    { label: "neutral", agreement: 0.7, threshold: 0.7 }, // T-017 境界ちょうど OK
  ])("passes label=$label agreement=$agreement >= $threshold", ({ label, agreement, threshold }) => {
    expect(assertValidLabel({ label, agreement }, threshold)).toEqual({ label });
  });

  // T-018,T-019: 閾値割れ / 許可外ラベル は throw。
  it.each([
    { name: "below threshold (T-018)", label: "positive", agreement: 0.69, threshold: 0.7 },
    { name: "label not in allowed set (T-019)", label: "angry", agreement: 1, threshold: 0.5 },
  ])("throws on $name", ({ label, agreement, threshold }) => {
    expect(() => assertValidLabel({ label, agreement }, threshold)).toThrow();
  });
});
