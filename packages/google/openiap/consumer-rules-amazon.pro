# The Appstore SDK fills fields of its own com.amazon.* classes by reflection,
# so R8 must keep it whole. These are Amazon's documented rules; keeping the
# whole SDK also keeps code that references optional libraries it doesn't ship.
-dontwarn com.amazon.**
-keep class com.amazon.** { *; }
-keepattributes *Annotation*
