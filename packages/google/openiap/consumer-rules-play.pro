# OpenIapModule reaches newer Play Billing APIs by reflection so it still runs
# when an app pins an older billing version; R8 must keep their public names.
-keep public class com.android.billingclient.api.** { public *; }
