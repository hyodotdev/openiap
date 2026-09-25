# Store resolver fixture

Drives `packages/google/gradle/openiap-store.gradle` — the one rule that
picks the Android store — without an Android SDK, a device, or a network.

Run the suite that uses it:

```bash
cd packages/google && bash scripts/verify-store-resolver.sh
```

`build.gradle` applies the resolver exactly as a framework wrapper does and
prints one line, `FIXTURE store=<id> source=<explicit|variant|device|default>`,
which the script asserts against. `fake-adb` stands in for adb: each case
exports `FAKE_ADB_DEVICES` and the features and manufacturer those serials
report, so Quest, Fire, and ordinary Android devices are all reproducible here.

A case belongs here whenever the rule gains a signal, an alias, or a conflict.
A wrong store cannot be seen on the machine that built it; it surfaces only when
the artifact reaches a device whose store the linked SDK cannot serve.
