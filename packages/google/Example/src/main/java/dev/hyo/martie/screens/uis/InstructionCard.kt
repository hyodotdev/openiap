package dev.hyo.martie.screens.uis

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dev.hyo.martie.models.AppColors

@Composable
fun InstructionCard() {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(
            containerColor = AppColors.info.copy(alpha = 0.1f)
        )
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    Icons.Default.Info,
                    contentDescription = null,
                    tint = AppColors.info,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    "Testing Instructions",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
            }

            Column(
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                InstructionRow("1", "Configure products in Google Play Console")
                InstructionRow("2", "Upload app to internal testing track")
                InstructionRow("3", "Add test accounts in Play Console")
                InstructionRow("4", "Sign in with test account on device")
                InstructionRow("5", "Enable license testing for the account")
            }
        }
    }
}

@Composable
private fun InstructionRow(
    number: String,
    text: String
) {
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.Top
    ) {
        Surface(
            shape = RoundedCornerShape(4.dp),
            color = AppColors.info.copy(alpha = 0.2f),
            modifier = Modifier.size(20.dp)
        ) {
            Box(
                contentAlignment = Alignment.Center
            ) {
                Text(
                    number,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.info
                )
            }
        }

        Text(
            text,
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.weight(1f)
        )
    }
}

