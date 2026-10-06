package com.diplomado.erp.feature.purchases.presentation

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
import com.diplomado.erp.ui.components.*
import com.diplomado.erp.ui.theme.*

@Composable
fun PurchaseOrdersScreen(
    modifier: Modifier = Modifier,
    viewModel: PurchaseOrdersViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showDialog by remember { mutableStateOf(false) }

    var notes by remember { mutableStateOf("") }
    var formError by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Box(modifier = modifier.fillMaxSize().padding(16.dp)) {
        when (val state = uiState) {
            is PurchaseOrdersUiState.Loading -> TTLoading(text = "Cargando órdenes de compra para obra...")
            is PurchaseOrdersUiState.Error -> {
                TTEmptyState(
                    title = "Error de compras",
                    description = state.message,
                    actionLabel = "Reintentar",
                    onAction = { viewModel.loadOrders() }
                )
            }
            is PurchaseOrdersUiState.Success -> {
                TTDataTable(
                    title = "Compras para Obra",
                    subtitle = "${state.orders.size} solicitudes registradas",
                    items = state.orders,
                    onCreateClick = if (PermissionChecker.hasPermission("purchases.create")) {
                        {
                            notes = ""
                            formError = null
                            showDialog = true
                        }
                    } else null,
                    createLabel = "Nueva compra",
                    emptyText = "Sin órdenes de compra para obra registradas."
                ) { order ->
                    TTCard(modifier = Modifier.fillMaxWidth()) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "Folio: ${order.code}",
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TecodeTextPrimary
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = "Proveedor: ${order.supplier?.name ?: "Proveedor de Insumos"} • Total: $${String.format("%.2f", order.total)}",
                                        fontSize = 13.sp,
                                        color = TecodeTextMuted
                                    )
                                }
                                TTBadge(status = order.status)
                            }

                            if (order.status == "DRAFT" && PermissionChecker.hasPermission("purchases.approve")) {
                                Spacer(modifier = Modifier.height(12.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    TTButton(
                                        text = "Rechazar",
                                        onClick = { viewModel.rejectOrder(order.id, "Rechazado desde App") },
                                        variant = TTButtonVariant.Danger,
                                        modifier = Modifier.weight(1f)
                                    )
                                    TTButton(
                                        text = "Aprobar y Recibir",
                                        onClick = { viewModel.approveOrder(order.id) },
                                        variant = TTButtonVariant.Primary,
                                        modifier = Modifier.weight(1f)
                                    )
                                }
                            }
                        }
                    }
                }

                // DIALOGO CREAR NUEVA SOLICITUD DE COMPRA
                if (showDialog) {
                    androidx.compose.ui.window.Dialog(onDismissRequest = { if (!isSubmitting) showDialog = false }) {
                        TTCard(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.verticalScroll(rememberScrollState()),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Text(
                                    text = "Nueva Orden de Compra",
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
                                    value = notes,
                                    onValueChange = { notes = it },
                                    label = "Justificación / Notas de la Compra",
                                    placeholder = "Compra urgente de 50 sacos de cemento para colado"
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
                                        text = "Guardar Compra",
                                        onClick = {
                                            isSubmitting = true
                                            viewModel.createOrder(notes) { success, err ->
                                                isSubmitting = false
                                                if (success) {
                                                    showDialog = false
                                                } else {
                                                    formError = err ?: "Error al registrar la compra."
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
