package com.diplomado.erp.feature.users.presentation

import androidx.compose.foundation.clickable
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
import com.diplomado.erp.core.network.dto.UserDto
import com.diplomado.erp.core.security.TokenStorage
import com.diplomado.erp.ui.components.*
import com.diplomado.erp.ui.theme.*

@Composable
fun UsersScreen(
    modifier: Modifier = Modifier,
    viewModel: UsersViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showDialog by remember { mutableStateOf(false) }
    var userToDelete by remember { mutableStateOf<UserDto?>(null) }

    var name by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var selectedRoleId by remember { mutableStateOf("") }
    var formError by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Box(modifier = modifier.fillMaxSize().padding(16.dp)) {
        when (val state = uiState) {
            is UsersUiState.Loading -> TTLoading(text = "Cargando usuarios...")
            is UsersUiState.Error -> {
                TTEmptyState(
                    title = "Error de usuarios",
                    description = state.message,
                    actionLabel = "Reintentar",
                    onAction = { viewModel.loadUsers() }
                )
            }
            is UsersUiState.Success -> {
                // Ordenar roles prioritarios para el sector construcción
                val roleOrder = listOf("administrador", "gerente", "supervisor", "trabajador", "almacen", "compras", "finanzas", "rrhh", "produccion", "auditor", "consulta")
                val sortedRoles = state.roles.sortedBy { role ->
                    val index = roleOrder.indexOf(role.code)
                    if (index >= 0) index else 99
                }

                val defaultRole = sortedRoles.firstOrNull()
                if (selectedRoleId.isEmpty() && defaultRole != null) {
                    selectedRoleId = defaultRole.id
                }

                TTDataTable(
                    title = "Usuarios",
                    subtitle = "${state.users.size} registrados",
                    items = state.users,
                    onCreateClick = if (PermissionChecker.hasPermission("users.create")) {
                        {
                            name = ""
                            lastName = ""
                            email = ""
                            password = ""
                            formError = null
                            showDialog = true
                        }
                    } else null,
                    createLabel = "Nuevo usuario",
                    emptyText = "Sin usuarios registrados."
                ) { user ->
                    TTCard(modifier = Modifier.fillMaxWidth()) {
                        Column {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = "${user.name} ${user.lastName ?: ""}".trim(),
                                        fontSize = 16.sp,
                                        fontWeight = FontWeight.Bold,
                                        color = TecodeTextPrimary
                                    )
                                    Spacer(modifier = Modifier.height(2.dp))
                                    Text(
                                        text = "📧 ${user.email}",
                                        fontSize = 12.sp,
                                        color = TecodeTextMuted
                                    )
                                }
                                TTBadge(status = user.status)
                            }

                            if (PermissionChecker.hasPermission("users.delete") && user.email != TokenStorage.getUserEmail()) {
                                Spacer(modifier = Modifier.height(8.dp))
                                TTButton(
                                    text = "Eliminar Usuario",
                                    onClick = { userToDelete = user },
                                    variant = TTButtonVariant.Danger,
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }
                }

                // DIALOGO CONFIRMAR ELIMINACION
                if (userToDelete != null) {
                    androidx.compose.ui.window.Dialog(onDismissRequest = { if (!isSubmitting) userToDelete = null }) {
                        TTCard(modifier = Modifier.fillMaxWidth()) {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text(
                                    text = "Confirmar Eliminación",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TecodeError
                                )
                                Text(
                                    text = "¿Está seguro de eliminar al usuario ${userToDelete?.email}?",
                                    fontSize = 13.sp,
                                    color = TecodeTextPrimary
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    TTButton(
                                        text = "Cancelar",
                                        onClick = { userToDelete = null },
                                        variant = TTButtonVariant.Ghost,
                                        modifier = Modifier.weight(1f),
                                        enabled = !isSubmitting
                                    )
                                    TTButton(
                                        text = "Eliminar",
                                        onClick = {
                                            isSubmitting = true
                                            viewModel.deleteUser(userToDelete!!.id) { _, _ ->
                                                isSubmitting = false
                                                userToDelete = null
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

                // DIALOGO CREAR NUEVO USUARIO
                if (showDialog) {
                    androidx.compose.ui.window.Dialog(onDismissRequest = { if (!isSubmitting) showDialog = false }) {
                        TTCard(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.verticalScroll(rememberScrollState()),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Text(
                                    text = "Nuevo Usuario",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TecodeTextPrimary
                                )

                                Text(
                                    text = "Asigne los datos del usuario. La contraseña que escriba le llegará por correo de bienvenida vía Resend.",
                                    fontSize = 12.sp,
                                    color = TecodeTextMuted
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
                                    label = "Nombre",
                                    placeholder = "Juan"
                                )

                                TTTextField(
                                    value = lastName,
                                    onValueChange = { lastName = it },
                                    label = "Apellidos",
                                    placeholder = "Pérez"
                                )

                                TTTextField(
                                    value = email,
                                    onValueChange = { email = it },
                                    label = "Correo Electrónico",
                                    placeholder = "usuario@correo.com"
                                )

                                TTTextField(
                                    value = password,
                                    onValueChange = { password = it },
                                    label = "Contraseña de Acceso para este Usuario",
                                    placeholder = "Escriba la contraseña (mínimo 8 caracteres)",
                                    isPassword = true
                                )

                                // SELECCION DE ROL
                                Text(
                                    text = "Seleccionar Rol Asignado:",
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TecodeTextPrimary
                                )

                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    sortedRoles.forEach { role ->
                                        val isSelected = selectedRoleId == role.id
                                        TTCard(
                                            modifier = Modifier
                                                .fillMaxWidth()
                                                .clickable { selectedRoleId = role.id }
                                        ) {
                                            Row(
                                                modifier = Modifier.fillMaxWidth(),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(
                                                    text = role.label,
                                                    fontSize = 13.sp,
                                                    fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                                    color = if (isSelected) TecodeAccent else TecodeTextPrimary
                                                )
                                                if (isSelected) {
                                                    TTBadge(status = "active", customLabel = "Seleccionado")
                                                }
                                            }
                                        }
                                    }
                                }

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
                                        text = "Guardar Usuario",
                                        onClick = {
                                            if (name.isBlank() || email.isBlank() || password.isBlank()) {
                                                formError = "Ingrese nombre, correo y contraseña de acceso."
                                                return@TTButton
                                            }
                                            if (password.length < 8) {
                                                formError = "La contraseña debe tener al menos 8 caracteres."
                                                return@TTButton
                                            }
                                            if (selectedRoleId.isBlank()) {
                                                formError = "Seleccione un rol asignado."
                                                return@TTButton
                                            }
                                            isSubmitting = true
                                            viewModel.createUser(name, lastName, email, password, selectedRoleId) { success, err ->
                                                isSubmitting = false
                                                if (success) {
                                                    showDialog = false
                                                } else {
                                                    formError = err ?: "Error al registrar usuario."
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
