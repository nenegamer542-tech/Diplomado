package com.diplomado.erp.feature.inventory.products.presentation

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
import com.diplomado.erp.core.network.dto.ProductDto
import com.diplomado.erp.ui.components.*
import com.diplomado.erp.ui.theme.*

@Composable
fun ProductsScreen(
    modifier: Modifier = Modifier,
    viewModel: ProductsViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val searchQuery by viewModel.searchQuery.collectAsState()
    var showDialog by remember { mutableStateOf(false) }
    var productToDelete by remember { mutableStateOf<ProductDto?>(null) }

    var sku by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var unit by remember { mutableStateOf("Saco") }
    var costPriceText by remember { mutableStateOf("180.00") }
    var salePriceText by remember { mutableStateOf("220.00") }
    var minStockText by remember { mutableStateOf("10") }
    var maxStockText by remember { mutableStateOf("500") }
    var formError by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Box(modifier = modifier.fillMaxSize().padding(16.dp)) {
        when (val state = uiState) {
            is ProductsUiState.Loading -> TTLoading(text = "Cargando catálogo de materiales de construcción...")
            is ProductsUiState.Error -> {
                TTEmptyState(
                    title = "Error de materiales",
                    description = state.message,
                    actionLabel = "Reintentar",
                    onAction = { viewModel.loadProducts() }
                )
            }
            is ProductsUiState.Success -> {
                TTDataTable(
                    title = "Materiales de Construcción",
                    subtitle = "${state.total} insumos registrados",
                    items = state.products,
                    searchQuery = searchQuery,
                    onSearchChange = { viewModel.onSearchChange(it) },
                    onCreateClick = if (PermissionChecker.hasPermission("products.create")) {
                        {
                            sku = "MAT-${(state.total + 1).toString().padStart(3, '0')}"
                            name = ""
                            unit = "Saco"
                            costPriceText = "180.00"
                            salePriceText = "220.00"
                            minStockText = "10"
                            maxStockText = "500"
                            formError = null
                            showDialog = true
                        }
                    } else null,
                    createLabel = "Nuevo material",
                    emptyText = "Sin materiales de construcción registrados."
                ) { material ->
                    TTCard(modifier = Modifier.fillMaxWidth()) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = material.name,
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TecodeTextPrimary
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = "SKU: ${material.sku} • Unidad: ${material.unit ?: "unidad"} • Costo: $${String.format("%.2f", material.costPrice ?: 0.0)}",
                                        fontSize = 12.sp,
                                        color = TecodeTextMuted
                                    )
                                    if ((material.minStock ?: 0.0) > 0) {
                                        Text(
                                            text = "Stock mín: ${material.minStock} | Stock máx: ${material.maxStock ?: "N/A"}",
                                            fontSize = 11.sp,
                                            color = TecodeTextSecondary
                                        )
                                    }
                                }
                                Column(horizontalAlignment = Alignment.End) {
                                    TTBadge(status = material.status)
                                    val mode = material.trackingMode ?: "none"
                                    if (mode != "none" && mode.isNotEmpty()) {
                                        Spacer(modifier = Modifier.height(4.dp))
                                        TTBadge(status = "active", customLabel = "Control ${mode.uppercase()}")
                                    }
                                }
                            }

                            if (PermissionChecker.hasPermission("products.delete") || PermissionChecker.hasPermission("products.update")) {
                                Spacer(modifier = Modifier.height(8.dp))
                                TTButton(
                                    text = "Eliminar Material",
                                    onClick = { productToDelete = material },
                                    variant = TTButtonVariant.Danger,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }
                }

                // DIALOGO MODAL CONFIRMAR ELIMINACION DE MATERIAL
                if (productToDelete != null) {
                    androidx.compose.ui.window.Dialog(onDismissRequest = { if (!isSubmitting) productToDelete = null }) {
                        TTCard(modifier = Modifier.fillMaxWidth()) {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text(
                                    text = "Confirmar Eliminación",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TecodeError
                                )
                                Text(
                                    text = "¿Está seguro de eliminar el material ${productToDelete?.name}?",
                                    fontSize = 13.sp,
                                    color = TecodeTextPrimary
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    TTButton(
                                        text = "Cancelar",
                                        onClick = { productToDelete = null },
                                        variant = TTButtonVariant.Ghost,
                                        modifier = Modifier.weight(1f),
                                        enabled = !isSubmitting
                                    )
                                    TTButton(
                                        text = "Eliminar",
                                        onClick = {
                                            isSubmitting = true
                                            viewModel.deleteProduct(productToDelete!!.id) { _, _ ->
                                                isSubmitting = false
                                                productToDelete = null
                                            }
                                        },
                                        variant = TTButtonVariant.Danger,
                                        loading = isSubmitting,
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                            }
                        }
                    }
                }

                // DIALOGO MODAL CREAR NUEVO MATERIAL DE CONSTRUCCION
                if (showDialog) {
                    androidx.compose.ui.window.Dialog(onDismissRequest = { if (!isSubmitting) showDialog = false }) {
                        TTCard(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.verticalScroll(rememberScrollState()),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Text(
                                    text = "Nuevo Material de Construcción",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TecodeTextPrimary
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
                                    value = sku,
                                    onValueChange = { sku = it },
                                    label = "SKU / Código del Insumo",
                                    placeholder = "MAT-001"
                                )

                                TTTextField(
                                    value = name,
                                    onValueChange = { name = it },
                                    label = "Nombre del Material",
                                    placeholder = "Cemento Gris 50 kg"
                                )

                                TTTextField(
                                    value = unit,
                                    onValueChange = { unit = it },
                                    label = "Unidad de Medida",
                                    placeholder = "Saco, Tonelada, m³, Pieza"
                                )

                                TTTextField(
                                    value = costPriceText,
                                    onValueChange = { costPriceText = it },
                                    label = "Costo Unitario ($)",
                                    placeholder = "180.00"
                                )

                                TTTextField(
                                    value = minStockText,
                                    onValueChange = { minStockText = it },
                                    label = "Stock Mínimo Alerta",
                                    placeholder = "10"
                                )

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    TTButton(
                                        text = "Cancelar",
                                        onClick = { showDialog = false },
                                        variant = TTButtonVariant.Ghost,
                                        modifier = Modifier.weight(1f),
                                        enabled = !isSubmitting
                                    )
                                    TTButton(
                                        text = "Guardar Material",
                                        onClick = {
                                            if (sku.isBlank() || name.isBlank()) {
                                                formError = "Ingrese SKU y nombre del material."
                                                return@TTButton
                                            }
                                            val cost = costPriceText.toDoubleOrNull() ?: 0.0
                                            val sale = salePriceText.toDoubleOrNull() ?: cost
                                            val minS = minStockText.toDoubleOrNull() ?: 0.0
                                            val maxS = maxStockText.toDoubleOrNull() ?: 500.0

                                            isSubmitting = true
                                            viewModel.createProduct(sku, name, unit, cost, sale, minS, maxS) { success, err ->
                                                isSubmitting = false
                                                if (success) {
                                                    showDialog = false
                                                } else {
                                                    formError = err ?: "Error al guardar el material."
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
