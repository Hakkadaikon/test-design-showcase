# order-fsm — 状態遷移テストの題材(骨組み)

注文の状態機械 `created → paid → shipped → delivered`。
履歴に依存する振る舞いなので、純関数の同値分割ではなく**状態遷移テスト**が主役になる。

## 振る舞いに、なぜこの手法を割り当てるか

| 振る舞い | 手法 | reference |
|---|---|---|
| 各有効遷移(`created --pay--> paid` 等)が表どおり遷移する | 状態遷移テスト(0-switch 全遷移) | blackbox-systematic |
| 各状態で**来てはいけないイベント**(`created --ship-->` 等)を拒否する | 状態遷移テスト(無効遷移) | blackbox-systematic |
| 操作列(イベント列)をランダム生成し、参照モデルと実装の状態が常に一致 | モデルベーステスト(`fc.commands`) | modern-generative |
| 「キャンセル可否」が状態×支払有無の組合せで決まる | デシジョンテーブル | blackbox-systematic |

> 状態爆発する設計(全 interleaving の到達性)はテストで踏み切れない。
> その場合は設計側で網羅的に検査し、見つかった危うい系列を具体的な遷移ケースとしてここへ落とす。

## テストリスト骨組み(次に縦貫きする入口)

- [ ] 有効遷移の全網羅(0-switch): `next(state, event)` の遷移表を `it.each`
- [ ] 無効遷移の全網羅: 各状態 × 起こり得ない全イベント → throw を `it.each`
- [ ] モデルベース: `fc.commands` で put/cancel/ship... の操作列を生成、参照モデルと照合
- [ ] デシジョンテーブル: キャンセル可否(状態 × 支払 × 在庫)を表の各行で

実装(`order.ts`)とテスト(`test/order-fsm.test.ts`)はまだ骨組み。duration の縦貫きが完了モデル。
