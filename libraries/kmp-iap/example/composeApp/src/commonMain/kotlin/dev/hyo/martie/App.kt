package dev.hyo.martie

import androidx.compose.runtime.Composable
import dev.hyo.martie.navigation.AppNavigation
import dev.hyo.martie.theme.AppTheme

@Composable
fun App() {
    AppTheme {
        AppNavigation()
    }
}