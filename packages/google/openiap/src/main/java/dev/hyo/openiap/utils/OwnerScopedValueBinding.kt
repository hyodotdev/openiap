package dev.hyo.openiap.utils

import java.lang.ref.WeakReference

/**
 * Selects the most recently bound live value without letting one owner clear
 * another owner's binding.
 */
internal class OwnerScopedValueBinding<T : Any>(
    private val onSelectedValueChanged: (T?) -> Unit
) {
    private val valuesByOwner = LinkedHashMap<Any, WeakReference<T>>()

    @Synchronized
    fun set(owner: Any, value: T?) {
        valuesByOwner.remove(owner)
        if (value != null) {
            valuesByOwner[owner] = WeakReference(value)
        }

        var selected: T? = null
        val iterator = valuesByOwner.iterator()
        while (iterator.hasNext()) {
            val valueForOwner = iterator.next().value.get()
            if (valueForOwner == null) {
                iterator.remove()
            } else {
                selected = valueForOwner
            }
        }
        onSelectedValueChanged(selected)
    }

    @Synchronized
    fun clear() {
        valuesByOwner.clear()
        onSelectedValueChanged(null)
    }
}
