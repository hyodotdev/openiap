# Independent Apple provider fixture

This in-memory store imports only the public `OpenIAP` product. It preserves
opaque transaction ids, receipts and `storeId` through the facade and full
Objective-C completion selector. It has no store billing SDK or real purchases.
The build plugin freezes the native and Client Protocol versions from the
fixture's pinned dependency metadata into its binary.

Run from the repository root:

```bash
OPENIAP_PROVIDER_REPORT=/tmp/apple-provider-report.json \
  swift test --package-path packages/apple/compatibility/community-provider
swift run --package-path packages/apple/compatibility/community-provider/consumer \
  -c release FixtureConsumer
```

The tests consume the public `OpenIapConformance` product. They check every
declared behavior, missing-event rejection, deferred-payment errors, billing
grace entitlement, listener removal, canonical restore and redemption dispatch,
and full completion payloads. The Release consumer links with `-ObjC` and
`-dead_strip`, discovers `CommunityFixtureFactory` through Info.plist metadata,
and completes a purchase without directly referencing the factory class.

For a real provider, declare the versions used to build the binary, use the
store's production mappers and sandbox triggers, and upload the passing JSON
report from CI. Follow the [common provider guide](https://openiap.dev/docs/guides/store-providers)
for app selection and optional registration. No artifact is published by these
commands.
