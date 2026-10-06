package com.diplomado.erp.feature.hr.presentation

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
import com.diplomado.erp.core.network.dto.EmployeeDto
import com.diplomado.erp.ui.components.*
import com.diplomado.erp.ui.theme.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class EmployeesUiState {
    data object Loading : EmployeesUiState()
    data class Success(val employees: List<EmployeeDto>) : EmployeesUiState()
    data class Error(val message: String) : EmployeesUiState()
}

class EmployeesViewModel : ViewModel() {
    private val _uiState = MutableStateFlow<EmployeesUiState>(EmployeesUiState.Loading)
    val uiState: StateFlow<EmployeesUiState> = _uiState.asStateFlow()

    init {
        loadEmployees()
    }

    fun loadEmployees() {
        viewModelScope.launch {
            _uiState.value = EmployeesUiState.Loading
            try {
                val res = RetrofitClient.api.getEmployees()
                if (res.isSuccessful && res.body()?.data != null) {
                    _uiState.value = EmployeesUiState.Success(res.body()!!.data!!)
                } else {
                    _uiState.value = EmployeesUiState.Error("No se pudo cargar el personal de obra.")
                }
            } catch (e: Exception) {
                _uiState.value = EmployeesUiState.Error(e.message ?: "Error de red al consultar personal.")
            }
        }
    }

    fun createEmployee(
        documentId: String,
        firstName: String,
        lastName: String,
        position: String,
        department: String,
        onComplete: (Boolean, String?) -> Unit
    ) {
        viewModelScope.launch {
            try {
                val body = mapOf(
                    "documentId" to documentId,
                    "firstName" to firstName,
                    "lastName" to lastName,
                    "position" to position.ifEmpty { "Operativo de Obra" },
                    "department" to department.ifEmpty { "General" },
                    "status" to "active"
                )
                val res = RetrofitClient.api.createEmployee(body)
                if (res.isSuccessful) {
                    loadEmployees()
                    onComplete(true, null)
                } else {
                    onComplete(false, res.body()?.error?.message ?: "Error al registrar trabajador.")
                }
            } catch (e: Exception) {
                onComplete(false, e.message ?: "Error de conexión.")
            }
        }
    }
}

@Composable
fun EmployeesScreen(
    modifier: Modifier = Modifier,
    viewModel: EmployeesViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showDialog by remember { mutableStateOf(false) }

    var documentId by remember { mutableStateOf("") }
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var position by remember { mutableStateOf("Maestro de Obra") }
    var department by remember { mutableStateOf("Cuadrilla A") }
    var formError by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Box(modifier = modifier.fillMaxSize().padding(16.dp)) {
        when (val state = uiState) {
            is EmployeesUiState.Loading -> TTLoading(text = "Cargando personal y cuadrillas de obra...")
            is EmployeesUiState.Error -> {
                TTEmptyState(
                    title = "Error de personal",
                    description = state.message,
                    actionLabel = "Reintentar",
                    onAction = { viewModel.loadEmployees() }
                )
            }
            is EmployeesUiState.Success -> {
                TTDataTable(
                    title = "RRHH & Cuadrillas de Obra",
                    subtitle = "${state.employees.size} trabajadores registrados",
                    items = state.employees,
                    onCreateClick = if (PermissionChecker.hasPermission("hr.create")) {
                        {
                            documentId = "RFC-${(state.employees.size + 1).toString().padStart(3, '0')}"
                            firstName = ""
                            lastName = ""
                            position = "Maestro de Obra"
                            department = "Cuadrilla A"
                            formError = null
                            showDialog = true
                        }
                    } else null,
                    createLabel = "Nuevo trabajador",
                    emptyText = "Sin personal de obra registrado."
                ) { emp ->
                    TTCard(modifier = Modifier.fillMaxWidth()) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "${emp.firstName} ${emp.lastName}",
                                    fontSize = 16.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TecodeTextPrimary
                                )
                                Spacer(modifier = Modifier.height(2.dp))
                                Text(
                                    text = "Doc: ${emp.documentId} • Puesto: ${emp.position ?: "Operativo"} • Cuadrilla: ${emp.department ?: "General"}",
                                    fontSize = 12.sp,
                                    color = TecodeTextMuted
                                )
                            }
                            TTBadge(status = emp.status)
                        }
                    }
                }

                // DIALOGO MODAL CREAR NUEVO TRABAJADOR / TECNICO
                if (showDialog) {
                    androidx.compose.ui.window.Dialog(onDismissRequest = { if (!isSubmitting) showDialog = false }) {
                        TTCard(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.verticalScroll(rememberScrollState()),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Text(
                                    text = "Nuevo Trabajador de Obra",
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
                                    value = documentId,
                                    onValueChange = { documentId = it },
                                    label = "Documento / RFC / ID",
                                    placeholder = "RFC-001"
                                )

                                TTTextField(
                                    value = firstName,
                                    onValueChange = { firstName = it },
                                    label = "Nombre(s)",
                                    placeholder = "Carlos"
                                )

                                TTTextField(
                                    value = lastName,
                                    onValueChange = { lastName = it },
                                    label = "Apellidos",
                                    placeholder = "González"
                                )

                                TTTextField(
                                    value = position,
                                    onValueChange = { position = it },
                                    label = "Puesto / Especialidad",
                                    placeholder = "Maestro Albañil, Fierrero, Electricista"
                                )

                                TTTextField(
                                    value = department,
                                    onValueChange = { department = it },
                                    label = "Cuadrilla / Departamento",
                                    placeholder = "Cuadrilla Torre A"
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
                                        text = "Guardar Trabajador",
                                        onClick = {
                                            if (documentId.isBlank() || firstName.isBlank()) {
                                                formError = "Ingrese RFC/documento y nombre del trabajador."
                                                return@TTButton
                                            }
                                            isSubmitting = true
                                            viewModel.createEmployee(documentId, firstName, lastName, position, department) { success, err ->
                                                isSubmitting = false
                                                if (success) {
                                                    showDialog = false
                                                } else {
                                                    formError = err ?: "Error al guardar trabajador."
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
