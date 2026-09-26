# Stand-ins for an app that calls the whole API, so R8 traces every store path.
-keep class dev.hyo.openiap.OpenIapModule { public *; }
-keep class dev.hyo.openiap.store.OpenIapStore { public *; }
