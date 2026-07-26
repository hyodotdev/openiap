package dev.hyo.martie.screens

import platform.CoreFoundation.CFAbsoluteTimeGetCurrent

private const val CF_ABSOLUTE_TIME_UNIX_EPOCH_OFFSET_SECONDS = 978_307_200.0

internal actual fun currentTimeMillis(): Long =
    ((CFAbsoluteTimeGetCurrent() + CF_ABSOLUTE_TIME_UNIX_EPOCH_OFFSET_SECONDS) * 1000).toLong()
