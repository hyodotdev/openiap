# Repeat the independent provider check

The [recorded run](./paywall-provider-run.json) passed 19 current-paywall checks
and 170 existing interoperability checks. It runs IAPKit's HTTP routes, Convex
state, Google notification handler and outbound signer. Store responses and
identity verification are fixtures; no production credentials are used.

## Prepare the exact sources

Install Bun 1.3.13 and Node.js/npm, then run these commands in a new parent
folder. The harness now ships in the repository, so there is no patch to apply.
The older regression example lives on its review branch, not the repository's
`main` branch.

```sh
git clone https://github.com/hyodotdev/openiap.git openiap-provider-check
cd openiap-provider-check
git checkout 4233231abdba7c032cb334598f70eec3f9b71afa
bun install --frozen-lockfile
cd ..

git clone --branch codex/commerce-protocol-review --single-branch https://github.com/hyodotdev/openiap-commerce-protocol-example.git original-example
cd original-example
git checkout f23f663e4220abdd709ab4cb340798d5c468cd4c
npm ci
cd ..

git clone --branch codex/commerce-protocol-from-scratch --single-branch https://github.com/hyodotdev/openiap-commerce-protocol-example.git fresh-example
cd fresh-example
git checkout b41facb1bf648d6c0aeea80745371dcc25482f8c
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
