package dev.hyo.martie.screens.uis

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.hyo.martie.models.AppColors
import dev.hyo.openiap.store.PurchaseResultStatus

@Composable
fun PurchaseResultCard(
    message: String,
    status: PurchaseResultStatus,
    onDismiss: () -> Unit,
    code: String? = null
) {
    val (background, contentColor, icon) = when (status) {
        PurchaseResultStatus.Success -> Triple(AppColors.success.copy(alpha = 0.1f), AppColors.success, Icons.Default.CheckCircle)
        PurchaseResultStatus.Info -> Triple(AppColors.info.copy(alpha = 0.1f), AppColors.info, Icons.Default.Info)
        PurchaseResultStatus.Error -> Triple(AppColors.danger.copy(alpha = 0.1f), AppColors.danger, Icons.Default.ErrorOutline)
    }
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = background
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.weight(1f),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(icon, contentDescription = null, tint = contentColor, modifier = Modifier.size(24.dp))
                Column {
                    if (code != null && (status == PurchaseResultStatus.Error || status == PurchaseResultStatus.Info)) {
                        Text(
                            "Code: $code",
                            style = MaterialTheme.typography.bodySmall,
                            color = contentColor.copy(alpha = 0.8f)
                        )
                    }
                    Text(
                        message,
                        style = MaterialTheme.typography.bodyMedium,
                        color = contentColor
                    )
                }
            }
            IconButton(onClick = onDismiss) {
                Icon(
                    Icons.Default.Close,
                    contentDescription = "Dismiss",
                    tint = AppColors.textSecondary
                )
            }
        }
    }
}
