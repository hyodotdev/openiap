# The shared Android code holds the Play Billing implementation, which Horizon
# and Amazon builds never run and don't ship Play Billing for.
-dontwarn com.android.billingclient.**
