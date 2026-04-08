package dev.hyo.martie.utils

import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController

@Composable
fun Modifier.swipeToBack(
    navController: NavController,
    enabled: Boolean = true
): Modifier {
    if (!enabled) return this
    
    val density = LocalDensity.current
    var startX by remember { mutableFloatStateOf(0f) }
    var offsetX by remember { mutableFloatStateOf(0f) }
    val swipeThreshold = with(density) { 100.dp.toPx() }
    val edgeWidth = with(density) { 20.dp.toPx() }
    
    return this.pointerInput(navController) {
        detectHorizontalDragGestures(
            onDragStart = { offset ->
                // Only detect swipes starting from the left edge
                if (offset.x < edgeWidth) {
                    startX = offset.x
                    offsetX = 0f
                }
            },
            onDragEnd = {
                // If swiped more than threshold, navigate back
                if (startX < edgeWidth && offsetX > swipeThreshold) {
                    navController.popBackStack()
                }
                startX = 0f
                offsetX = 0f
            }
        ) { _, dragAmount ->
            // Only track if started from edge
            if (startX < edgeWidth && dragAmount > 0) {
                offsetX += dragAmount
            }
        }
    }
}