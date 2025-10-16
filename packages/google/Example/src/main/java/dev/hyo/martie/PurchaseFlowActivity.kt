package dev.hyo.martie

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity

/**
 * Compatibility stub for older builds that launched PurchaseFlowActivity.
 * Redirects to MainActivity and navigates to the purchase flow.
 */
class PurchaseFlowActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val intent = Intent(this, MainActivity::class.java).apply {
            putExtra("openiap_route", "purchase_flow")
            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        startActivity(intent)
        finish()
    }
}

