package dev.hyo.openiap.helpers

import android.content.Context

/**
 * Remembers, once per app install, that a framework library printed its
 * first-purchase notice. For OpenIAP's framework libraries only; not part of the
 * Client Protocol.
 */
object OpenIapFirstPurchaseNotice {
    private const val PREFERENCES = "dev.hyo.openiap"
    private const val SHOWN = "first_purchase_notice_shown"

    /** True on the first call on this install, false on every later one. */
    @JvmStatic
    @Synchronized
    fun claim(context: Context): Boolean {
        val preferences = (context.applicationContext ?: context)
            .getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
        if (preferences.getBoolean(SHOWN, false)) return false
        return preferences.edit().putBoolean(SHOWN, true).commit()
    }
}
