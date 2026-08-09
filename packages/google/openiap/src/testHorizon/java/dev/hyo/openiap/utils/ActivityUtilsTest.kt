package dev.hyo.openiap.utils

import android.app.Activity
import android.content.ContextWrapper
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner

@RunWith(RobolectricTestRunner::class)
class ActivityUtilsTest {
    @Test
    fun `findActivity unwraps nested UI contexts`() {
        val activity = Robolectric.buildActivity(Activity::class.java).create().get()
        val wrapped = ContextWrapper(ContextWrapper(activity))

        assertSame(activity, wrapped.findActivity())
    }

    @Test
    fun `findActivity rejects application context`() {
        assertNull(ApplicationProvider.getApplicationContext<android.content.Context>().findActivity())
    }
}
