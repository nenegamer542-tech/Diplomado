package com.diplomado.erp.feature.sales.presentation

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
import com.diplomado.erp.ui.components.TTBadge
import com.diplomado.erp.ui.components.TTButton
import com.diplomado.erp.ui.components.TTButtonVariant
import com.diplomado.erp.ui.components.TTCard
import com.diplomado.erp.ui.components.TTDataTable
import com.diplomado.erp.ui.components.TTEmptyState
import com.diplomado.erp.ui.components.TTLoading
import com.diplomado.erp.ui.components.TTTextField
import com.diplomado.erp.ui.theme.TecodeError
import com.diplomado.erp.ui.theme.TecodeTextMuted
import com.diplomado.erp.ui.theme.TecodeTextPrimary

@Composable
fun SalesOrdersScreen(
    modifier: Modifier = Modifier,
    viewModel: SalesOrdersViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showDialog by remember { mutableStateOf(false) }

    var notes by remember { mutableStateOf("") }
    var formError by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Box(modifier = modifier.fillMaxSize().padding(16.dp)) {
        when (val state = uiState) {
            is SalesOrdersUiState.Loading -> TTLoading(text = "Cargando estimaciones y contratos de obra...")
            is SalesOrdersUiState.Error -> {
                TTEmptyState(
                    title = "Error de contratos",
                    description = state.message,
                    actionLabel = "Reintentar",
                    onAction = { viewModel.loadOrders() }
                )
            }
            is SalesOrdersUiState.Success -> {
                TTDataTable(
                    title = "Contratos y Estimaciones",
                    subtitle = "${state.orders.size} estimaciones registradas",
                    items = state.orders,
                    onCreateClick = if (PermissionChecker.hasPermission("sales.orders.create")) {
                        {
                            notes = ""
                            formError = null
                            showDialog = true
                        }
                    } else null,
                    createLabel = "Nueva estimación",
                    emptyText = "Sin estimaciones ni contratos registrados."
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
                                        text = "Cliente Contratante: ${order.customer?.name ?: "Desarrolladora"} • Total: $${String.format("%.2f", order.total)}",
                                        fontSize = 13.sp,
                                        color = TecodeTextMuted
                                    )
                                }
                                TTBadge(status = order.status)
                            }

                            if (order.status == "DRAFT" && PermissionChecker.hasPermission("sales.orders.approve")) {
                                Spacer(modifier = Modifier.height(12.dp))
                                TTButton(
                                    text = "Aprobar Estimación",
                                    onClick = { viewModel.approveOrder(order.id) },
                                    variant = TTButtonVariant.Primary,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }
                }

                // DIALOGO MODAL CREAR NUEVA ESTIMACION DE OBRA
                if (showDialog) {
                    androidx.compose.ui.window.Dialog(onDismissRequest = { if (!isSubmitting) showDialog = false }) {
                        TTCard(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.verticalScroll(rememberScrollState()),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Text(
                                    text = "Nueva Estimación de Obra",
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
                                    label = "Descripción / Concepto de Estimación",
                                    placeholder = "Estimación No. 1 - Avance Cimentación Lote B"
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
                                        text = "Guardar Estimación",
                                        onClick = {
                                            isSubmitting = true
                                            viewModel.createOrder(notes) { success, err ->
                                                isSubmitting = false
                                                if (success) {
                                                    showDialog = false
                                                } else {
                                                    formError = err ?: "Error al registrar la estimación."
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
