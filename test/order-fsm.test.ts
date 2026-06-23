// order-fsm: 状態遷移テストの題材。骨組み(テストリストのみ)。
// duration を縦貫きしたのと同じ手順で、tasks の抽出台帳 → it.each で埋める。
// 手法割り当ては src/order-fsm/README.md の対応表を参照。

describe("order state machine: valid transitions (0-switch)", () => {
  // 遷移表 next(state,event) を it.each で。created→paid→shipped→delivered。
  it.todo("created --pay--> paid / paid --ship--> shipped / shipped --deliver--> delivered");
});

describe("order state machine: invalid transitions", () => {
  // 各状態 × 起こり得ないイベント → throw。欠陥はここに住む。
  it.todo("rejects every (state, impossible-event) pair");
});

describe("order state machine: model-based (fc.commands)", () => {
  // 参照モデルと実装を操作列で並走させ、各操作後に状態一致を照合。
  it.todo("model and implementation agree under random command sequences");
});

describe("order: cancellation decision table", () => {
  // キャンセル可否 = 状態 × 支払有無 × 在庫 の組合せ。表の各行を1ケース。
  it.todo("cancel allowed/denied per decision table rules");
});
