# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in ${sdk.dir}/tools/proguard/proguard-android.txt

# Keep OpenIAP classes
-keep class dev.hyo.openiap.** { *; }

# Keep Google Play Billing classes
-keep class com.android.billingclient.** { *; }

# Keep Gson classes for JSON serialization
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.** { *; }
-keep class * implements com.google.gson.TypeAdapterFactory
-keep class * implements com.google.gson.JsonSerializer
-keep class * implements com.google.gson.JsonDeserializer

# Keep data classes
-keepclassmembers,allowshrinking,allowobfuscation class * {
    @com.google.gson.annotations.SerializedName <fields>;
}
