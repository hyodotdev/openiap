# Keep Nitro IAP HybridObject and related generated classes so R8 doesn't strip
# them in consumer apps' release builds.
-keep class com.margelo.nitro.iap.** { *; }

# Optional broader safety for Nitro core wrappers if referenced reflectively.
# Uncomment if needed in downstream apps.
# -keep class com.margelo.nitro.modules.** { *; }
