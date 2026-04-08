package dev.hyo.martie.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import dev.hyo.martie.screens.*

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object PurchaseFlow : Screen("purchase-flow")
    object SubscriptionFlow : Screen("subscription-flow")
    object AvailablePurchases : Screen("available-purchases")
    object OfferCode : Screen("offer-code")
    object AlternativeBilling : Screen("alternative-billing")
}

@Composable
fun AppNavigation(
    navController: NavHostController = rememberNavController()
) {
    NavHost(
        navController = navController,
        startDestination = Screen.Home.route
    ) {
        composable(Screen.Home.route) {
            HomeScreen(navController)
        }
        composable(Screen.PurchaseFlow.route) {
            PurchaseFlowScreen(navController)
        }
        composable(Screen.SubscriptionFlow.route) {
            SubscriptionFlowScreen(navController)
        }
        composable(Screen.AvailablePurchases.route) {
            AvailablePurchasesScreen(navController)
        }
        composable(Screen.OfferCode.route) {
            OfferCodeScreen(navController)
        }
        composable(Screen.AlternativeBilling.route) {
            AlternativeBillingScreen(navController)
        }
    }
}