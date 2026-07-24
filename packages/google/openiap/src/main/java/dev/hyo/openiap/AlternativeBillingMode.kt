package dev.hyo.openiap

/**
 * Alternative billing mode
 * Supported by both Google Play Billing and Meta Horizon Billing
 */
@Deprecated(
    "Use BillingProgramAndroid with InitConnectionConfig.enableBillingProgramAndroid instead. Scheduled for removal in OpenIAP 3.0."
)
enum class AlternativeBillingMode {
    /** Standard billing (default) - Google Play or Meta Horizon */
    NONE,
    /** Alternative billing with user choice (user selects between platform billing or alternative) */
    USER_CHOICE,
    /** Alternative billing only (no platform billing option) */
    ALTERNATIVE_ONLY
}
