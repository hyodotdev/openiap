package dev.hyo.martie

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import dev.hyo.martie.navigation.AppNavigation
import dev.hyo.martie.screens.ExamplePurchaseFlow
import dev.hyo.martie.theme.AppTheme

@Composable
fun App() {
    LaunchedEffect(Unit) { ExamplePurchaseFlow.start() }
    AppTheme {
        AppNavigation()
    }
}
