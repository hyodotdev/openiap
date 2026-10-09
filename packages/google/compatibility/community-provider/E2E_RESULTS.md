# Common store provider device results

The October 9–10, 2026 stable run executed all **30 supported hardware cells**:
**23 passed purchase, local verification and transaction completion; seven
Horizon purchase cells remain blocked by ordinary paid checkout.** Expo Onside
passed a separate build-only check and is excluded from those totals.

## Executed inputs

| SDK          | Stable version       | Released source        |
| ------------ | -------------------- | ---------------------- |
| Native       | Apple / Google 4.0.0 | `fe944300`, `ca483aab` |
| React Native | 17.0.0               | `db4746b8`             |
| Expo         | 6.0.0                | `9e8938ef`             |
| Flutter      | 11.0.0               | `3a590e45`             |
| Godot        | 4.0.0                | `758ff8c0`             |
| KMP          | 4.0.0                | `7fa60eb4`             |
| MAUI         | 3.0.0                | `c414cca4`             |

Native and framework inputs came from their immutable release tags or public
registries. Public artifact, provenance and consumer checks were verified
separately. Private sample transport/import adjustments are recorded with each
artifact; they changed no shipped SDK source. Vega uses its Kepler runtime
rather than the Google Maven binary.

The devices were a physical iPhone 13 mini, Pixel, Fire tablet, Quest 3 and Vega
device. Purchases used the locally compiled IAPKit server against the
**development** backend. Apple and Amazon returned `READY_TO_CONSUME`; Play
returned `PENDING_ACKNOWLEDGMENT`. Completion followed successful verification.

## Hardware matrix

`PASS` covers purchase, valid verification and completion. `BLOCKED` is not a
purchase pass. Hashes below identify the executed app artifacts, not the public
package archives. Full hashes, input patches and device/backend evidence remain
in the private run manifest.

| App          | Store/device    | Purchase | Server correlation id                  | Artifact SHA-256 |
| ------------ | --------------- | -------- | -------------------------------------- | ---------------- |
| Native       | Apple / iPhone  | PASS     | `4bafd6db-cfd4-45aa-bc83-66f420d3e66e` | `6b560a8c7e11`   |
| Native       | Play / Pixel    | PASS     | `70767957-98dd-444e-8ffa-01b6fe7ce852` | `67941ed4f90a`   |
| Native       | Amazon / Fire   | PASS     | `7e24cdf1-76ee-47b4-a966-39d3016d0e09` | `a20834c3db58`   |
| Native       | Horizon / Quest | BLOCKED  | —                                      | `7643f29fd463`   |
| React Native | Apple / iPhone  | PASS     | `9b2437f2-f810-4bbd-98af-066dbb1cd141` | `134d8de487ea`   |
| React Native | Play / Pixel    | PASS     | `029b4d0a-768b-4210-afa3-1f905a3b6eda` | `16c7c912e524`   |
| React Native | Amazon / Fire   | PASS     | `5bc69a02-f0e4-4d6a-854b-67bd2e5f309f` | `9db523744905`   |
| React Native | Horizon / Quest | BLOCKED  | —                                      | `4664d5b5baca`   |
| React Native | Amazon / VegaOS | PASS     | `7beb397e-7dcc-40a0-8dad-e563656a06aa` | `7328745daf10`   |
| Expo         | Apple / iPhone  | PASS     | `546dfe5f-d141-486e-8b39-e0c85f1088b0` | `27217f9f6511`   |
| Expo         | Play / Pixel    | PASS     | `32d555fa-3aa1-4faa-b24c-f3bceb018548` | `7fb459072d7b`   |
| Expo         | Amazon / Fire   | PASS     | `44dedc78-e15c-4801-82be-90566c1aaff3` | `d7bdaf85bca9`   |
| Expo         | Horizon / Quest | BLOCKED  | —                                      | `7990b395500e`   |
| Expo         | Amazon / VegaOS | PASS     | `6368904d-9e04-4e31-91c3-e71c7003f3ae` | `d864b1ce4a25`   |
| Flutter      | Apple / iPhone  | PASS     | `5fef3787-9822-443b-a927-58fc31eb8714` | `56701a7ddd6f`   |
| Flutter      | Play / Pixel    | PASS     | `d9a97ca4-1d3c-4160-a1c6-d324c3b4d555` | `2804ae2eab7e`   |
| Flutter      | Amazon / Fire   | PASS     | `029872a7-a3f4-4e32-b089-0ea8c75750a8` | `dfcfe958639b`   |
| Flutter      | Horizon / Quest | BLOCKED  | —                                      | `b860523fc23b`   |
| Godot        | Apple / iPhone  | PASS     | `da7f3a1c-6279-4dd0-9b7e-ed51bcf93481` | `cb6840640c17`   |
| Godot        | Play / Pixel    | PASS     | `2dd8fd8d-674c-47c7-8607-0b2fd7894bad` | `32ad6da534f9`   |
| Godot        | Amazon / Fire   | PASS     | `7f0aeff2-16c8-4a56-a2b1-32945154dd64` | `0dcae861e1e3`   |
| Godot        | Horizon / Quest | BLOCKED  | —                                      | `697c1e87cc72`   |
| KMP          | Apple / iPhone  | PASS     | `d7f1b476-c037-4024-ad07-3f387b9d8839` | `8ec59781f174`   |
| KMP          | Play / Pixel    | PASS     | `f16be359-de83-41e9-be24-d0b20d5401b2` | `5dd908c30dc1`   |
| KMP          | Amazon / Fire   | PASS     | `c3311557-8dea-4f4a-afa3-a46e9c2e5ee0` | `cbc9fc12f047`   |
| KMP          | Horizon / Quest | BLOCKED  | —                                      | `99afd60fc67a`   |
| MAUI         | Apple / iPhone  | PASS     | `a60a9df6-1462-405f-a5c9-8608bd9d2517` | `13d785346dd4`   |
| MAUI         | Play / Pixel    | PASS     | `39e804c9-fe6d-445e-9369-79d710ac7d39` | `2aec5fde76b4`   |
| MAUI         | Amazon / Fire   | PASS     | `8af23967-dfd7-41c0-9bb7-2edb382d71da` | `6da8e15a84d6`   |
| MAUI         | Horizon / Quest | BLOCKED  | —                                      | `830d465c6bae`   |

## Recovery and limits

- **Apple, Play and Fire:** actual checkout cancellation and cold ownership reads
  were exercised. The completed consumable was absent. Samples exposing Refresh
  were checked through that control; a separate Restore call is not implied.
  Amazon App Tester cancellation maps to `PurchaseError`, not `UserCancelled`.
  Godot Play and Fire invoked Restore, but the sample displays no success result
  or count.
- **React Native and Expo viewers:** the released viewer's response to a late
  unfinished purchase event was not exercised. Receipt-viewer corrections are
  prepared outside main; the matrix does not validate them.
- **Horizon:** all seven apps connected, loaded products, reached ordinary
  saved-card checkout, cancelled it and queried ownership. Confirm was not
  pressed. Godot has no captured Restore success result; its final cold owned
  query returned two purchases while the UI remained Connecting/Loading.
  MAUI's warm Refresh returned two, but its additional cold Refresh result was
  not observed. No Horizon receipt verification or completion is claimed.
- **Vega:** the approved official App Tester reinstall cleared the failing
  local tester history. React Native and Expo then purchased, verified and
  completed fresh consumables; cold queries and Refresh retained a separately
  purchased nonconsumable. Expo's supplemental nonconsumable completion callback
  was not captured; its main consumable completion was captured.
- **KMP Play sample:** raw cold History retained the acknowledged nonconsumable,
  but the released Active filter hid it. A separate correction uses the existing
  product-id lists. It compiled for Android Play and iOS arm64 and displayed the
  entitlement in Active, History and Refresh without a new purchase, verification
  or finish call. The correction is prepared outside main pending approval; it
  does not replace the released-artifact row above.
- **Receipt recovery:** native Apple and KMP Apple recovered the same unfinished
  receipt after local-network permission was granted. Expo Play recovered the
  same order after its USB server route was restored. No second purchase was
  counted for those retries. Godot Apple restored the nonconsumable and reported
  restore cancellation through the canonical cancellation path.
- **DEV accounting:** the 16 Android/Vega passing rows each added one distinct
  valid receipt and matching purchase/statistics increments. Subscription counts
  and aggregate values were unchanged; one MAUI Amazon statistics timestamp
  advanced. The seven Apple rows have separate matching receipt and completion
  evidence.
- **Amazon channel and subscriptions:** App Tester and Vega Tester simulate
  purchases. This run does not prove fresh current-source Live App Testing,
  subscription renewal, expiry or revocation. Historical LAT receipt recovery
  remains separate evidence in the
  [previous report](https://github.com/hyodotdev/openiap/blob/1538ab2d3b4f461774da7eeca9d3bd975a04799c/packages/google/compatibility/community-provider/E2E_RESULTS.md).
- **Onside:** the unsigned Expo device build included OnsideKit 0.7.5 and its
  query/callback schemes. No Onside account or runtime purchase was exercised.

## Separate community provider

The [Amazon community example](https://github.com/hyodotdev/openiap-google-amazon-community)
passed its six-check UI flow, verification before completion, cancellation and
cold ownership checks on Fire using stable public inputs. Its final source
`ab0d0f227a09e784b47643ca5d152293baa1a904` passed
[CI 37959191200](https://github.com/hyodotdev/openiap-google-amazon-community/actions/runs/37959191200).
Provider package 0.0.2 is unpublished. These are independent example results,
outside the 30-cell SDK matrix.

Normal full examples were restored. Task-owned diagnostic runners, Metro
processes, device port mappings, temporary key files and the DEV server were
removed or stopped. Unknown apps and pre-existing processes were preserved.
No iPhone Mirroring or production Convex mutation was used.
