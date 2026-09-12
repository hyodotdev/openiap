# Repeat the independent provider check

The [recorded run](./paywall-provider-run.json) passed 19 current-paywall checks
and 170 existing interoperability checks. It runs IAPKit's HTTP routes, Convex
state, Google notification handler and outbound signer. Store responses and
identity verification are fixtures; no production credentials are used.

## Prepare the exact sources

Install Bun 1.3.13 and Node.js/npm. Download the
[harness patch](./paywall-provider-harness.patch) into a new parent folder, then
run these commands there. The older regression example lives on its review
branch, not the repository's `main` branch.

```sh
printf '%s  %s\n' \
  d693d3e66f0ac66ef7ed86882b8678a07a144864e30817316a60b8fc13c4cbd7 \
  paywall-provider-harness.patch | shasum -a 256 -c -

git clone https://github.com/hyodotdev/openiap.git openiap-provider-check
cd openiap-provider-check
git checkout 4b1316adf41d302783de2761866e5226e1b39a7f
git apply ../paywall-provider-harness.patch
bun install --frozen-lockfile
cd ..

git clone --branch codex/commerce-protocol-review --single-branch https://github.com/hyodotdev/openiap-commerce-protocol-example.git original-example
cd original-example
git checkout f23f663e4220abdd709ab4cb340798d5c468cd4c
npm ci
cd ..

git clone --branch codex/commerce-protocol-from-scratch --single-branch https://github.com/hyodotdev/openiap-commerce-protocol-example.git fresh-example
cd fresh-example
git checkout 6d5e5e9a3d3aaae449679780bf014e469c38d900
npm ci
npm run verify
cd ../openiap-provider-check

bun --conditions=openiap-source packages/kit/scripts/docs/run-commerce-interop.mjs \
  ../original-example ../provider-check-output ../fresh-example
```

Use a new `provider-check-output` directory on each run. The harness provisions
an anonymous local Convex instance and stops its servers afterward. Both example
checkouts above were freshly downloaded and installed for the recorded run.
IAPKit used an existing dependency installation; its executed source hashes and
runtime versions are included in the report.

## Inspect the result

Open `provider-check-output/report.json`. `freshConnection` records the paywall's
actual provider requests, signed event bodies and final experiment report.
Purchase and renewal give Onboarding / A two fictional USD 5.00 observations.
Cancellation keeps access and the USD 10.00 total. Redelivery changes neither.

The Google events contain no transaction references. The consumer uses the
configured account/store/environment/product assignment, leaving IDs absent.
The provider URL, credentials and mapping change; the paywall handler and
receiver source remain unchanged. The separate `checks` array covers the older
provider-switching, store and restart regression matrix.

This verifies fixture-backed interoperability. It does not test native checkout,
public HTTPS delivery, real store identity or purchase migration.
