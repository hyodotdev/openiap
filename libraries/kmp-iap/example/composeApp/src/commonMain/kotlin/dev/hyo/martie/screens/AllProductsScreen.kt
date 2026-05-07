package dev.hyo.martie.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import dev.hyo.martie.theme.AppColors
import dev.hyo.martie.utils.swipeToBack
import io.github.hyochan.kmpiap.KmpIAP
import io.github.hyochan.kmpiap.fetchProducts
import io.github.hyochan.kmpiap.openiap.Product
import io.github.hyochan.kmpiap.openiap.ProductQueryType
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AllProductsScreen(navController: NavController) {
    val scope = rememberCoroutineScope()
    val kmpIAP = remember { KmpIAP() }
    var products by remember { mutableStateOf<List<Product>>(emptyList()) }
    var loading by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }

    fun loadProducts() {
        scope.launch {
            loading = true
            message = null
            try {
                kmpIAP.initConnection()
                products = kmpIAP.fetchProducts {
                    skus = AllProductIds
                    type = ProductQueryType.All
                }
                message = if (products.isEmpty()) "No products returned." else null
            } catch (e: Exception) {
                message = "Failed to load products: ${e.message}"
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) {
        loadProducts()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("All Products") },
                navigationIcon = {
                    IconButton(onClick = { navController.popBackStack() }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
                    }
                }
            )
        },
        modifier = Modifier.swipeToBack(navController)
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(AppColors.Background)
                .padding(paddingValues)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Button(
                onClick = { loadProducts() },
                enabled = !loading,
                modifier = Modifier.fillMaxWidth()
            ) {
                Text(if (loading) "Loading..." else "Reload Products")
            }

            if (loading) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator()
                }
            }

            message?.let {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Text(
                        text = it,
                        modifier = Modifier.padding(16.dp),
                        color = AppColors.Secondary
                    )
                }
            }

            products.forEach { product ->
                AllProductCard(product)
            }
        }
    }
}

@Composable
private fun AllProductCard(product: Product) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        shape = RoundedCornerShape(12.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                text = product.displayName ?: product.title,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                color = AppColors.OnSurface
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(text = product.description, color = AppColors.Secondary)
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "ID: ${product.id}",
                fontFamily = FontFamily.Monospace,
                fontSize = 12.sp,
                color = AppColors.Secondary
            )
            Text(
                text = "Type: ${product.type.rawValue} / ${product.displayPrice}",
                fontWeight = FontWeight.Medium,
                color = AppColors.Primary
            )
        }
    }
}
