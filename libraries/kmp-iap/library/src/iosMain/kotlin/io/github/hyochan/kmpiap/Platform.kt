package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.IapPlatform

actual fun getCurrentPlatform(): IapPlatform = IapPlatform.Ios
