package com.diplomado.erp.feature.finance.presentation

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
fun AccountsScreen(
    modifier: Modifier = Modifier,
    viewModel: AccountsViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showDialog by remember { mutableStateOf(false) }

    var code by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("cash") }
    var formError by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Box(modifier = modifier.fillMaxSize().padding(16.dp)) {
        when (val state = uiState) {
            is AccountsUiState.Loading -> TTLoading(text = "Cargando cajas chicas y cuentas de tesorería...")
            is AccountsUiState.Error -> {
                TTEmptyState(
                    title = "Error de finanzas de obra",
                    description = state.message,
                    actionLabel = "Reintentar",
                    onAction = { viewModel.loadAccounts() }
                )
            }
            is AccountsUiState.Success -> {
                TTDataTable(
                    title = "Finanzas & Cajas Chicas",
                    subtitle = "${state.accounts.size} cuentas de tesorería y fondos de obra",
                    items = state.accounts,
                    onCreateClick = if (PermissionChecker.hasPermission("finance.accounts.create")) {
                        {
                            code = "CAJA-${(state.accounts.size + 1).toString().padStart(2, '0')}"
                            name = ""
                            type = "cash"
                            formError = null
                            showDialog = true
                        }
                    } else null,
                    createLabel = "Nueva caja chica",
                    emptyText = "Sin cuentas ni cajas chicas registradas."
                ) { account ->
                    TTCard(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = account.name,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TecodeTextPrimary
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "Código: ${account.code} • Tipo: ${account.type.uppercase()} • ${account.currency}",
                                    fontSize = 12.sp,
                                    color = TecodeTextMuted
                                )
                            }
                            Column(horizontalAlignment = Alignment.End) {
                                Text(
                                    text = "$${String.format("%.2f", account.balance)}",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = TecodeAccent
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                TTBadge(status = account.status)
                            }
                        }
                    }
                }

                // DIALOGO MODAL CREAR NUEVA CAJA CHICA / CUENTA
                if (showDialog) {
                    androidx.compose.ui.window.Dialog(onDismissRequest = { if (!isSubmitting) showDialog = false }) {
                        TTCard(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.verticalScroll(rememberScrollState()),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Text(
                                    text = "Nueva Caja Chica / Cuenta",
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
                                    value = code,
                                    onValueChange = { code = it },
                                    label = "Código / Folio",
                                    placeholder = "CAJA-01"
                                )

                                TTTextField(
                                    value = name,
                                    onValueChange = { name = it },
                                    label = "Nombre de la Caja / Fondo",
                                    placeholder = "Caja Chica Obra Torre A"
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
                                        text = "Guardar Cuenta",
                                        onClick = {
                                            if (code.isBlank() || name.isBlank()) {
                                                formError = "Ingrese código y nombre de la caja chica."
                                                return@TTButton
                                            }
                                            isSubmitting = true
                                            viewModel.createAccount(code, name, type) { success, err ->
                                                isSubmitting = false
                                                if (success) {
                                                    showDialog = false
                                                } else {
                                                    formError = err ?: "Error al crear la cuenta."
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
