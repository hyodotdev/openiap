package io.github.hyochan.kmpiap

import io.github.hyochan.kmpiap.openiap.PurchaseError

class PurchaseException(
    val error: PurchaseError
) : Exception(error.message)
