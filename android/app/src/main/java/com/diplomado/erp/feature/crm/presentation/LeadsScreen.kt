package com.diplomado.erp.feature.crm.presentation

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
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.diplomado.erp.core.common.rbac.PermissionChecker
import com.diplomado.erp.core.network.client.RetrofitClient
import com.diplomado.erp.core.network.dto.LeadDto
import com.diplomado.erp.ui.components.*
import com.diplomado.erp.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class LeadsUiState {
    data object Loading : LeadsUiState()
    data class Success(val leads: List<LeadDto>) : LeadsUiState()
    data class Error(val message: String) : LeadsUiState()
}

class LeadsViewModel : ViewModel() {
    private val _uiState = MutableStateFlow<LeadsUiState>(LeadsUiState.Loading)
    val uiState: StateFlow<LeadsUiState> = _uiState.asStateFlow()

    init {
        loadLeads()
    }

    fun loadLeads() {
        viewModelScope.launch {
            _uiState.value = LeadsUiState.Loading
            try {
                val res = RetrofitClient.api.getLeads()
                if (res.isSuccessful && res.body()?.data != null) {
                    _uiState.value = LeadsUiState.Success(res.body()!!.data!!)
                } else {
                    _uiState.value = LeadsUiState.Error("No se pudieron cargar los prospectos de obra.")
                }
            } catch (e: Exception) {
                _uiState.value = LeadsUiState.Error(e.message ?: "Error de red al consultar prospectos.")
            }
        }
    }

    fun createLead(name: String, company: String, email: String, amount: Double, onComplete: (Boolean, String?) -> Unit) {
        viewModelScope.launch {
            try {
                val body = mapOf(
                    "name" to name,
                    "company" to company,
                    "email" to email,
                    "expectedAmount" to amount,
                    "status" to "NEW"
                )
                val res = RetrofitClient.api.createLead(body)
                if (res.isSuccessful) {
                    loadLeads()
                    onComplete(true, null)
                } else {
                    onComplete(false, res.body()?.error?.message ?: "Error al registrar prospecto.")
                }
            } catch (e: Exception) {
                onComplete(false, e.message ?: "Error de conexión.")
            }
        }
    }
}

@Composable
fun LeadsScreen(
    modifier: Modifier = Modifier,
    viewModel: LeadsViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showDialog by remember { mutableStateOf(false) }

    var name by remember { mutableStateOf("") }
    var company by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var amountText by remember { mutableStateOf("850000") }
    var formError by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Box(modifier = modifier.fillMaxSize().padding(16.dp)) {
        when (val state = uiState) {
            is LeadsUiState.Loading -> TTLoading(text = "Cargando prospectos y proyectos comerciales...")
            is LeadsUiState.Error -> {
                TTEmptyState(
                    title = "Error de prospectos",
                    description = state.message,
                    actionLabel = "Reintentar",
                    onAction = { viewModel.loadLeads() }
                )
            }
            is LeadsUiState.Success -> {
                TTDataTable(
                    title = "CRM Prospectos de Obra",
                    subtitle = "${state.leads.size} proyectos en negociación",
                    items = state.leads,
                    onCreateClick = if (PermissionChecker.hasPermission("crm.create")) {
                        {
                            name = ""
                            company = ""
                            email = ""
                            amountText = "850000"
                            formError = null
                            showDialog = true
                        }
                    } else null,
                    createLabel = "Nuevo prospecto",
                    emptyText = "Sin prospectos de obra registrados."
                ) { lead ->
                    TTCard(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = lead.name,
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TecodeTextPrimary
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "Empresa: ${lead.company ?: "Particular"} • Email: ${lead.email ?: "—"}",
                                    fontSize = 12.sp,
                                    color = TecodeTextMuted
                                )
                                if ((lead.expectedAmount ?: 0.0) > 0) {
                                    Text(
                                        text = "Monto estimado: $${String.format("%.2f", lead.expectedAmount)}",
                                        fontSize = 12.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TecodeAccent
                                    )
                                }
                            }
                            TTBadge(status = lead.status, customLabel = lead.status)
                        }
                    }
                }

                // DIALOGO MODAL CREAR NUEVO PROSPECTO DE OBRA
                if (showDialog) {
                    androidx.compose.ui.window.Dialog(onDismissRequest = { if (!isSubmitting) showDialog = false }) {
                        TTCard(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.verticalScroll(rememberScrollState()),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Text(
                                    text = "Nuevo Prospecto de Obra",
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
                                    value = name,
                                    onValueChange = { name = it },
                                    label = "Nombre del Proyecto / Cliente",
                                    placeholder = "Remodelación Plaza Comercial Central"
                                )

                                TTTextField(
                                    value = company,
                                    onValueChange = { company = it },
                                    label = "Empresa Contratante",
                                    placeholder = "Desarrolladora Inmobiliaria del Sur"
                                )

                                TTTextField(
                                    value = email,
                                    onValueChange = { email = it },
                                    label = "Correo de Contacto",
                                    placeholder = "contacto@cliente.com"
                                )

                                TTTextField(
                                    value = amountText,
                                    onValueChange = { amountText = it },
                                    label = "Monto Estimado de Obra ($)",
                                    placeholder = "850000"
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
                                        text = "Guardar Prospecto",
                                        onClick = {
                                            if (name.isBlank()) {
                                                formError = "Ingrese el nombre del proyecto."
                                                return@TTButton
                                            }
                                            val amount = amountText.toDoubleOrNull() ?: 0.0
                                            isSubmitting = true
                                            viewModel.createLead(name, company, email, amount) { success, err ->
                                                isSubmitting = false
                                                if (success) {
                                                    showDialog = false
                                                } else {
                                                    formError = err ?: "Error al guardar el prospecto."
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
