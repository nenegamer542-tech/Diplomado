package com.diplomado.erp.feature.inventory.stock.presentation

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.diplomado.erp.core.common.rbac.PermissionChecker
import com.diplomado.erp.core.network.dto.StockLevelDto
import com.diplomado.erp.ui.components.*
import com.diplomado.erp.ui.theme.*

@Composable
fun StockScreen(
    modifier: Modifier = Modifier,
    viewModel: StockViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var stockToAdjust by remember { mutableStateOf<StockLevelDto?>(null) }

    var newQuantityText by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }
    var formError by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Box(modifier = modifier.fillMaxSize().padding(16.dp)) {
        when (val state = uiState) {
            is StockUiState.Loading -> TTLoading(text = "Cargando existencias en bodegas de obra...")
            is StockUiState.Error -> {
                TTEmptyState(
                    title = "Error de existencias",
                    description = state.message,
                    actionLabel = "Reintentar",
                    onAction = { viewModel.loadStock() }
                )
            }
            is StockUiState.Success -> {
                TTDataTable(
                    title = "Existencias en Bodegas",
                    subtitle = "${state.stockLevels.size} insumos disponibles en obra",
                    items = state.stockLevels,
                    emptyText = "Sin existencias de materiales en bodegas."
                ) { stock ->
                    TTCard(modifier = Modifier.fillMaxWidth()) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = stock.product?.name ?: "Material sin nombre",
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TecodeTextPrimary
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = "SKU: ${stock.product?.sku ?: "—"} • Bodega: ${stock.warehouse?.name ?: "Bodega Central"}",
                                        fontSize = 12.sp,
                                        color = TecodeTextMuted
                                    )
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    Text(
                                        text = "${stock.quantity} ${stock.product?.unit ?: "ud"}",
                                        fontSize = 18.sp,
                                        fontWeight = FontWeight.ExtraBold,
                                        color = TecodeAccent
                                    )
                                    val min = stock.product?.minStock ?: 0.0
                                    if (stock.quantity <= min && min > 0) {
                                        Spacer(modifier = Modifier.height(2.dp))
                                        TTBadge(status = "LOCKED", customLabel = "Stock Bajo")
                                    }
                                }
                            }

                            if (PermissionChecker.hasPermission("inventory.adjustments.create")) {
                                Spacer(modifier = Modifier.height(10.dp))
                                TTButton(
                                    text = "Ajustar Stock Físico",
                                    onClick = {
                                        stockToAdjust = stock
                                        newQuantityText = stock.quantity.toString()
                                        reason = "Conteo físico directo en obra"
                                        formError = null
                                    },
                                    variant = TTButtonVariant.Ghost,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }
                }

                // DIALOGO MODAL AJUSTAR STOCK FISICO
                if (stockToAdjust != null) {
                    androidx.compose.ui.window.Dialog(onDismissRequest = { if (!isSubmitting) stockToAdjust = null }) {
                        TTCard(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.verticalScroll(rememberScrollState()),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Text(
                                    text = "Ajuste Físico de Inventario",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TecodeTextPrimary
                                )

                                Text(
                                    text = "Ajustar recuento de: ${stockToAdjust?.product?.name ?: "Material"}",
                                    fontSize = 12.sp,
                                    color = TecodeAccent
                                )

                                if (formError != null) {
                                    Text(
                                        text = "⚠️ $formError",
                                        fontSize = 12.sp,
                                        color = TecodeError,
                                        fontWeight = FontWeight.Bold
                                    )
                                }

                                TTTextField(
                                    value = newQuantityText,
                                    onValueChange = { newQuantityText = it },
                                    label = "Nuevo Conteo Físico Real",
                                    placeholder = "100"
                                )

                                TTTextField(
                                    value = reason,
                                    onValueChange = { reason = it },
                                    label = "Motivo del Ajuste",
                                    placeholder = "Recuento físico semanal en bodega"
                                )

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    TTButton(
                                        text = "Cancelar",
                                        onClick = { stockToAdjust = null },
                                        variant = TTButtonVariant.Ghost,
                                        modifier = Modifier.weight(1f),
                                        enabled = !isSubmitting
                                    )
                                    TTButton(
                                        text = "Guardar Ajuste",
                                        onClick = {
                                            val newQty = newQuantityText.toDoubleOrNull()
                                            if (newQty == null || newQty < 0) {
                                                formError = "Ingrese un número válido para el stock."
                                                return@TTButton
                                            }
                                            val prodId = stockToAdjust?.product?.id
                                            val wareId = stockToAdjust?.warehouse?.id
                                            if (prodId.isNullOrEmpty() || wareId.isNullOrEmpty()) {
                                                formError = "Datos de material o bodega incompletos."
                                                return@TTButton
                                            }
                                            isSubmitting = true
                                            viewModel.createAdjustment(prodId, wareId, newQty, reason) { success, err ->
                                                isSubmitting = false
                                                if (success) {
                                                    stockToAdjust = null
                                                } else {
                                                    formError = err ?: "Error al guardar ajuste."
                                                }
                                            }
                                        },
                                        variant = TTButtonVariant.Primary,
                                        loading = isSubmitting,
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
