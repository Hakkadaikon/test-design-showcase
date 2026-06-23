// order-fsm: 注文の状態機械。履歴に依存する振る舞いなので状態遷移テストが主役。
// 手法割り当ては src/order-fsm/README.md の対応表を参照。

import fc from "fast-check";
import { next, State, Event } from "../src/order-fsm/order";

describe("order state machine: valid transitions (0-switch)", () => {
  // 表どおりの有効遷移だけが状態を進める。created→paid→shipped→delivered と、
  // created/paid からのキャンセル。
  it.each([
    { from: "created", event: "pay", to: "paid" },
    { from: "paid", event: "ship", to: "shipped" },
    { from: "shipped", event: "deliver", to: "delivered" },
    { from: "created", event: "cancel", to: "cancelled" },
    { from: "paid", event: "cancel", to: "cancelled" },
  ] as { from: State; event: Event; to: State }[])(
    "$from --$event--> $to",
    ({ from, event, to }) => {
      expect(next(from, event)).toBe(to);
    },
  );
});

describe("order state machine: invalid transitions", () => {
  // 有効でない (状態, イベント) 対は 15 通りすべて拒否する。
  // 欠陥はここに住む。終端状態(delivered/cancelled)からの全イベント拒否を含む。
  it.each([
    { from: "created", event: "ship" }, // 未支払では出荷不可
    { from: "created", event: "deliver" }, // 未支払では配達不可
    { from: "paid", event: "pay" }, // 二重支払不可
    { from: "paid", event: "deliver" }, // 出荷前に配達不可
    { from: "shipped", event: "pay" }, // 出荷後に支払不可
    { from: "shipped", event: "ship" }, // 二重出荷不可
    { from: "shipped", event: "cancel" }, // 出荷後はキャンセル不可
    { from: "delivered", event: "pay" }, // 終端: 支払不可
    { from: "delivered", event: "ship" }, // 終端: 出荷不可
    { from: "delivered", event: "deliver" }, // 終端: 再配達不可
    { from: "delivered", event: "cancel" }, // 終端: キャンセル不可
    { from: "cancelled", event: "pay" }, // 終端: 支払不可
    { from: "cancelled", event: "ship" }, // 終端: 出荷不可
    { from: "cancelled", event: "deliver" }, // 終端: 配達不可
    { from: "cancelled", event: "cancel" }, // 終端: 再キャンセル不可
  ] as { from: State; event: Event }[])(
    "rejects $from --$event-->",
    ({ from, event }) => {
      expect(() => next(from, event)).toThrow();
    },
  );
});

describe("order state machine: model-based", () => {
  // ランダムなイベント列を生成し、参照モデルと実装 next を操作列で並走させる。
  // 各ステップ後に状態が一致し、不変性質も保たれることを確認する。
  const states: State[] = ["created", "paid", "shipped", "delivered", "cancelled"];
  const terminal = (s: State) => s === "delivered" || s === "cancelled";

  // 参照モデル: 実装とは別に最小で書く oracle。有効遷移なら進め、無効なら状態維持。
  const refTransitions: Record<State, Partial<Record<Event, State>>> = {
    created: { pay: "paid", cancel: "cancelled" },
    paid: { ship: "shipped", cancel: "cancelled" },
    shipped: { deliver: "delivered" },
    delivered: {},
    cancelled: {},
  };
  const refStep = (s: State, e: Event): State => refTransitions[s][e] ?? s;

  // 無効遷移は実装では throw。両者を「拒否=状態維持」に揃えて比較する。
  const implStep = (s: State, e: Event): State => {
    try {
      return next(s, e);
    } catch {
      return s;
    }
  };

  it("model and implementation agree under random event sequences", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom<Event>("pay", "ship", "deliver", "cancel")),
        (events) => {
          let impl: State = "created";
          let ref: State = "created";
          for (const e of events) {
            const before = impl;
            impl = implStep(impl, e);
            ref = refStep(ref, e);
            expect(impl).toBe(ref); // 実装とモデルが一致
            expect(states).toContain(impl); // 結果状態は常に 5 値のいずれか
            if (terminal(before)) {
              expect(impl).toBe(before); // 終端に入ったら状態は変わらない
            }
          }
        },
      ),
    );
  });
});

describe("order: cancellation decision table", () => {
  // キャンセル可否は状態で決まる。created/paid は可、それ以降と終端は不可。
  it.each([
    { state: "created", allowed: true }, // 未処理なのでキャンセル可
    { state: "paid", allowed: true }, // 出荷前ならキャンセル可
    { state: "shipped", allowed: false }, // 出荷後はキャンセル不可
    { state: "delivered", allowed: false }, // 終端なのでキャンセル不可
    { state: "cancelled", allowed: false }, // 既にキャンセル済み
  ] as { state: State; allowed: boolean }[])(
    "cancel on $state allowed=$allowed",
    ({ state, allowed }) => {
      if (allowed) {
        expect(next(state, "cancel")).toBe("cancelled");
      } else {
        expect(() => next(state, "cancel")).toThrow();
      }
    },
  );
});
