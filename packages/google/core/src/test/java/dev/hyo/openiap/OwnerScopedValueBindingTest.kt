package dev.hyo.openiap.utils

import androidx.lifecycle.Lifecycle
import org.junit.Assert.assertEquals
import org.junit.Test

class OwnerScopedValueBindingTest {
    @Test
    fun `activity binding state follows foreground lifecycle transitions`() {
        assertEquals(true, Lifecycle.Event.ON_START.activityBindingState())
        assertEquals(true, Lifecycle.Event.ON_RESUME.activityBindingState())
        assertEquals(false, Lifecycle.Event.ON_PAUSE.activityBindingState())
        assertEquals(false, Lifecycle.Event.ON_STOP.activityBindingState())
        assertEquals(false, Lifecycle.Event.ON_DESTROY.activityBindingState())
        assertEquals(null, Lifecycle.Event.ON_CREATE.activityBindingState())
    }

    @Test
    fun `clearing one owner restores the newest remaining binding`() {
        val selections = mutableListOf<String?>()
        val bindings = OwnerScopedValueBinding<String>(selections::add)
        val firstOwner = Any()
        val secondOwner = Any()

        bindings.set(firstOwner, "first")
        bindings.set(secondOwner, "second")
        bindings.set(firstOwner, null)
        bindings.set(secondOwner, null)

        assertEquals(listOf("first", "second", "second", null), selections)
    }

    @Test
    fun `rebinding an owner makes it the current selection`() {
        val selections = mutableListOf<String?>()
        val bindings = OwnerScopedValueBinding<String>(selections::add)
        val firstOwner = Any()
        val secondOwner = Any()

        bindings.set(firstOwner, "first")
        bindings.set(secondOwner, "second")
        bindings.set(firstOwner, "first-resumed")
        bindings.set(firstOwner, null)

        assertEquals(
            listOf("first", "second", "first-resumed", "second"),
            selections
        )
    }

    @Test
    fun `clear removes every owner and selected value`() {
        val selections = mutableListOf<String?>()
        val bindings = OwnerScopedValueBinding<String>(selections::add)

        bindings.set(Any(), "first")
        bindings.set(Any(), "second")
        bindings.clear()

        assertEquals(listOf("first", "second", null), selections)
    }
}
