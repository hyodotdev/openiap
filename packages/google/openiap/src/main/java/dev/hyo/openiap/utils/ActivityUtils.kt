package dev.hyo.openiap.utils

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import androidx.lifecycle.Lifecycle

/** Finds the Activity carried by a UI context without retaining it. */
internal fun Context.findActivity(): Activity? {
    var current: Context = this
    while (current is ContextWrapper) {
        if (current is Activity) return current
        val base = current.baseContext
        if (base === current) return null
        current = base
    }
    return current as? Activity
}

/** Maps lifecycle transitions to foreground Activity binding changes. */
internal fun Lifecycle.Event.activityBindingState(): Boolean? = when (this) {
    Lifecycle.Event.ON_START,
    Lifecycle.Event.ON_RESUME -> true
    Lifecycle.Event.ON_PAUSE,
    Lifecycle.Event.ON_STOP,
    Lifecycle.Event.ON_DESTROY -> false
    else -> null
}
