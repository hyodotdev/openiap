package dev.hyo.martie.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// expo-iap color palette
object AppColors {
    val Primary = Color(0xFF007AFF)
    val Success = Color(0xFF28a745)
    val Secondary = Color(0xFF6c757d)
    val Purple = Color(0xFF9c27b0)
    val Background = Color(0xFFF5F5F5)
    val Surface = Color(0xFFF8F9FA)
    val OnSurface = Color(0xFF1C1B1F)
    val Error = Color(0xFFDC3545)
    val Warning = Color(0xFFFFF3CD) // Light yellow warning background

    // Additional UI colors
    val InfoPurple = Color(0xFF6B46C1)
    val InfoBlue = Color(0xFF2196F3)
    val Orange = Color(0xFFFF9800) // Warning/cancellation orange
    val UpgradeBackground = Color(0xFFE3F2FD) // Light blue background for upgrades
    val CancellationBackground = Color(0xFFFFF3E0) // Light orange background for cancellations
    // Note: Use Purple for billing retry status (same semantic color)
    val Border = Color(0xFFE0E0E0) // Light gray border
}

private val LightColorScheme = lightColorScheme(
    primary = AppColors.Primary,
    secondary = AppColors.Secondary,
    tertiary = AppColors.Purple,
    background = AppColors.Background,
    surface = Color.White,
    error = AppColors.Error,
    onPrimary = Color.White,
    onSecondary = Color.White,
    onTertiary = Color.White,
    onBackground = AppColors.OnSurface,
    onSurface = AppColors.OnSurface,
    onError = Color.White
)

@Composable
fun AppTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = Typography(),
        content = content
    )
}