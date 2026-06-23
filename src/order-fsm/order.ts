// 注文の状態機械。有効遷移だけが状態を進め、それ以外はすべて拒否する純関数。

export type State = "created" | "paid" | "shipped" | "delivered" | "cancelled";
export type Event = "pay" | "ship" | "deliver" | "cancel";

// 有効遷移表。ここに無い (状態, イベント) 対はすべて拒否。
// delivered / cancelled は終端なのでエントリを持たない。
const transitions: Record<State, Partial<Record<Event, State>>> = {
  created: { pay: "paid", cancel: "cancelled" },
  paid: { ship: "shipped", cancel: "cancelled" },
  shipped: { deliver: "delivered" },
  delivered: {},
  cancelled: {},
};

export function next(state: State, event: Event): State {
  const to = transitions[state][event];
  if (to === undefined) {
    throw new Error(`invalid transition: ${state} --${event}-->`);
  }
  return to;
}
