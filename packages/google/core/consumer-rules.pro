# Keep factories named by manifest metadata, including external packages.
-keep class * implements dev.hyo.openiap.OpenIapProviderFactory { public <init>(); }
-keep public class dev.hyo.openiap.listener.** { *; }
