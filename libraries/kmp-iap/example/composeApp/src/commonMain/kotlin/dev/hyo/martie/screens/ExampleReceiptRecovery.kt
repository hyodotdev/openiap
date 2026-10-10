package dev.hyo.martie.screens

import io.github.hyochan.kmpiap.openiap.Purchase
import io.github.hyochan.kmpiap.openiap.PurchaseState

// Screen-owned receipts survive failed verification and incomplete ownership queries.
internal class ExampleReceiptRecovery(private val recognizes: (Purchase) -> Boolean) {
    private data class ReceiptKey(val storeId: String, val receiptId: String)

    private val pending = linkedMapOf<ReceiptKey, Purchase>()
    private val handled = mutableSetOf<ReceiptKey>()

    private fun key(purchase: Purchase): ReceiptKey? {
        val receiptId = purchase.id.ifBlank { purchase.purchaseToken.orEmpty() }
        return receiptId.takeIf { it.isNotBlank() }?.let {
            ReceiptKey(purchase.storeId, it)
        }
    }

    fun retain(purchase: Purchase): Boolean {
        if (purchase.purchaseState != PurchaseState.Purchased || !recognizes(purchase)) return false
        val key = key(purchase) ?: return false
        if (key in handled && key !in pending) return false
        pending[key] = purchase
        return true
    }

    fun receipts(): List<Purchase> = pending.values.toList()

    fun begin(purchase: Purchase): Boolean {
        if (!retain(purchase)) return false
        return key(purchase)?.let { handled.add(it) } ?: false
    }

    fun completed(purchase: Purchase) {
        key(purchase)?.let { pending.remove(it) }
    }

    fun retryable(purchase: Purchase) {
        key(purchase)?.takeIf { it in pending }?.let { handled.remove(it) }
    }
}
