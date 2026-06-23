import fc from "fast-check";
import { parse, format } from "../src/duration/duration";
import { parseReference } from "../src/duration/reference";

describe("parse: equivalence partitions", () => {
  // T-001..T-005: 単一/複合の代表値を同値クラスごとに 1 つずつ。
  it.each([
    { input: "30s", expected: 30 }, // T-001
    { input: "5m", expected: 300 }, // T-002
    { input: "2h", expected: 7200 }, // T-003
    { input: "1h30m", expected: 5400 }, // T-004
    { input: "1h30m15s", expected: 5415 }, // T-005
  ])("parse($input) === $expected", ({ input, expected }) => {
    expect(parse(input)).toBe(expected);
  });
});

describe("parse: boundaries", () => {
  // T-006..T-010, T-019: 繰り上がり境界・ゼロ・上限/超過。
  it.each([
    { input: "0s", expected: 0 }, // T-006 ゼロ正規形
    { input: "59s", expected: 59 }, // T-007 繰り上がり直前
    { input: "60s", expected: 60 }, // T-008 境界(parse は受理)
    { input: "61s", expected: 61 }, // T-009
    { input: `${Number.MAX_SAFE_INTEGER}s`, expected: Number.MAX_SAFE_INTEGER }, // T-010 上限受理
  ])("parse($input) === $expected", ({ input, expected }) => {
    expect(parse(input)).toBe(expected);
  });

  // T-019: MAX_SAFE_INTEGER 超過は桁あふれで throw。
  it("rejects overflow beyond MAX_SAFE_INTEGER", () => {
    expect(() => parse(`${Number.MAX_SAFE_INTEGER + 1}s`)).toThrow();
    expect(() => parse("9999999999999999999h")).toThrow();
  });
});

describe("parse: invalid class", () => {
  // T-011..T-018: 無効クラスの代表入力。各々 throw。
  it.each([
    "", // T-011 空文字
    "1d", // T-012 未知単位
    "1H", // T-013 大文字単位
    "abc", // T-014 非数値
    "hm", // T-014 単位のみ(数値なし)
    "-1h", // T-015 負数
    "1.5h", // T-016 小数
    "30m1h", // T-017 逆順
    "1h1h", // T-018 同単位重複
    "30", // 単位なし数値(用語定義: 単位なしは無効)
    "01h", // 先頭ゼロ
  ])("parse(%j) throws", (input) => {
    expect(() => parse(input)).toThrow();
  });
});

describe("format: boundaries", () => {
  // T-020, T-024, T-025: ゼロ・繰り上げ境界・負数 throw。
  it.each([
    { seconds: 0, expected: "0s" }, // T-020
    { seconds: 59, expected: "59s" }, // T-024
    { seconds: 60, expected: "1m" }, // T-024
    { seconds: 61, expected: "1m1s" }, // T-024
  ])("format($seconds) === $expected", ({ seconds, expected }) => {
    expect(format(seconds)).toBe(expected);
  });

  // T-025: 負数は throw。
  it("format throws on negative", () => {
    expect(() => format(-1)).toThrow();
  });
});

describe("format: normalization", () => {
  // T-021..T-023: 繰り上げ正規化・0 単位省略。
  it.each([
    { seconds: 90, expected: "1m30s" }, // T-021
    { seconds: 3600, expected: "1h" }, // T-022 0 単位省略
    { seconds: 5415, expected: "1h30m15s" }, // T-023
  ])("format($seconds) === $expected", ({ seconds, expected }) => {
    expect(format(seconds)).toBe(expected);
  });
});

describe("property: round-trip", () => {
  // T-026: 任意の非負秒 n で parse(format(n)) === n。
  it("parse(format(n)) === n for all non-negative n", () => {
    fc.assert(
      fc.property(fc.nat({ max: Number.MAX_SAFE_INTEGER }), (n) => {
        expect(parse(format(n))).toBe(n);
      }),
    );
  });
});

describe("property: format idempotent", () => {
  // T-027: format 出力は正規形。parse して再 format しても不変。
  it("format(parse(format(n))) === format(n)", () => {
    fc.assert(
      fc.property(fc.nat({ max: Number.MAX_SAFE_INTEGER }), (n) => {
        const once = format(n);
        expect(format(parse(once))).toBe(once);
      }),
    );
  });
});

describe("differential: parse vs reference", () => {
  // T-028: 本実装 parse と独立な参照実装が任意入力で一致(throw も含めて)。
  const safeParse = (fn: (s: string) => number, s: string) => {
    try {
      return { ok: true, value: fn(s) };
    } catch {
      return { ok: false as const };
    }
  };

  // 正規な duration 文字列を組む生成器(係数を h→m→s 順に任意組合せで連結)。
  const validDuration = fc
    .tuple(
      fc.option(fc.nat({ max: 1_000_000 }), { nil: undefined }),
      fc.option(fc.nat({ max: 1_000_000 }), { nil: undefined }),
      fc.option(fc.nat({ max: 1_000_000 }), { nil: undefined }),
    )
    .map(([h, m, s]) => {
      const parts =
        (h !== undefined ? `${h}h` : "") +
        (m !== undefined ? `${m}m` : "") +
        (s !== undefined ? `${s}s` : "");
      return parts === "" ? "0s" : parts;
    });

  // 数値部の生成器: 通常整数・先頭ゼロ付き・桁あふれ級の巨大値を踏ませる。
  const numberPart = fc.oneof(
    fc.nat({ max: 1000 }).map(String),
    fc.tuple(fc.constant("0"), fc.nat({ max: 999 })).map(([z, n]) => z + n),
    fc.bigInt({ min: 0n, max: 10n ** 19n }).map(String),
  );

  // 断片の生成器: 数値+単位 / 数値のみ(単位なし) / 単位のみ(数値なし)。
  const fragment = fc.oneof(
    fc.tuple(numberPart, fc.constantFrom("h", "m", "s")).map(([n, u]) => n + u),
    numberPart,
    fc.constantFrom("h", "m", "s"),
  );

  // 断片を任意順・任意個数で連結(逆順・重複・欠落・先頭ゼロ・桁あふれ・単位欠落を踏ませる)。
  const shuffledUnits = fc
    .array(fragment, { maxLength: 5 })
    .map((parts) => parts.join(""));

  // 正規文字列・順序崩し・任意文字列を混ぜ、正常/異常の両クラスを踏む。
  const anyInput = fc.oneof(validDuration, shuffledUnits, fc.string());

  it("agrees with reference on arbitrary input", () => {
    fc.assert(
      fc.property(anyInput, (s) => {
        expect(safeParse(parse, s)).toEqual(safeParse(parseReference, s));
      }),
      { numRuns: 2000 },
    );
  });
});
