package com.margelo.nitro.iap

import com.margelo.nitro.core.NullType

// Kotlin null becomes JS undefined; an explicit Nitro null preserves unknown status.
internal fun Boolean?.toNitroNullableBoolean(): Variant_NullType_Boolean =
    this?.let { Variant_NullType_Boolean.Second(it) }
        ?: Variant_NullType_Boolean.First(NullType.NULL)
