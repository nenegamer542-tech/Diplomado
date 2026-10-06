package com.diplomado.erp.feature.projects.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.diplomado.erp.core.common.rbac.PermissionChecker
import com.diplomado.erp.core.network.dto.ProjectDto
import com.diplomado.erp.ui.components.TTBadge
import com.diplomado.erp.ui.components.TTButton
import com.diplomado.erp.ui.components.TTButtonVariant
import com.diplomado.erp.ui.components.TTCard
import com.diplomado.erp.ui.components.TTDataTable
import com.diplomado.erp.ui.components.TTEmptyState
import com.diplomado.erp.ui.components.TTLoading
import com.diplomado.erp.ui.components.TTTextField
import com.diplomado.erp.ui.theme.TecodeAccent
import com.diplomado.erp.ui.theme.TecodeBorder
import com.diplomado.erp.ui.theme.TecodeError
import com.diplomado.erp.ui.theme.TecodeTextMuted
import com.diplomado.erp.ui.theme.TecodeTextPrimary
import com.diplomado.erp.ui.theme.TecodeTextSecondary

@Composable
fun ProjectsScreen(
    onProjectClick: (String) -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ProjectsViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var showCreateDialog by remember { mutableStateOf(false) }
    var projectToDelete by remember { mutableStateOf<ProjectDto?>(null) }

    var code by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var budgetText by remember { mutableStateOf("") }
    var managerName by remember { mutableStateOf("") }
    var formError by remember { mutableStateOf<String?>(null) }
    var isSubmitting by remember { mutableStateOf(false) }

    Box(modifier = modifier.fillMaxSize().padding(16.dp)) {
        when (val state = uiState) {
            is ProjectsUiState.Loading -> {
                TTLoading(text = "Cargando obras de construcción...")
            }
            is ProjectsUiState.Error -> {
                TTEmptyState(
                    title = "Error al consultar obras",
                    description = state.message,
                    actionLabel = "Reintentar",
                    onAction = { viewModel.loadProjects() }
                )
            }
            is ProjectsUiState.Success -> {
                TTDataTable(
                    title = "Mis Obras",
                    subtitle = "${state.projects.size} proyectos registrados",
                    items = state.projects,
                    searchQuery = searchQuery,
                    onSearchChange = {
                        searchQuery = it
                        viewModel.loadProjects(searchQuery.ifEmpty { null })
                    },
                    onCreateClick = if (PermissionChecker.hasPermission("projects.create")) {
                        {
                            code = "OBRA-${(state.projects.size + 1).toString().padStart(3, '0')}"
                            name = ""
                            location = ""
                            budgetText = "1500000"
                            managerName = ""
                            formError = null
                            showCreateDialog = true
                        }
                    } else null,
                    createLabel = "Nueva obra",
                    emptyText = "Sin obras registradas."
                ) { project ->
                    ProjectCard(
                        project = project,
                        onClick = { onProjectClick(project.id) },
                        onDeleteClick = if (PermissionChecker.hasPermission("projects.update")) {
                            { projectToDelete = project }
                        } else null
                    )
                }

                // DIALOGO MODAL CONFIRMAR ELIMINACION / CANCELACION DE OBRA
                if (projectToDelete != null) {
                    androidx.compose.ui.window.Dialog(onDismissRequest = { if (!isSubmitting) projectToDelete = null }) {
                        TTCard(modifier = Modifier.fillMaxWidth()) {
                            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                Text(
                                    text = "Confirmar Cancelación / Eliminación",
                                    fontSize = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TecodeError
                                )
                                Text(
                                    text = "¿Está seguro de cancelar la obra ${projectToDelete?.name}?",
                                    fontSize = 13.sp,
                                    color = TecodeTextPrimary
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    TTButton(
                                        text = "Cancelar",
                                        onClick = { projectToDelete = null },
                                        variant = TTButtonVariant.Ghost,
                                        modifier = Modifier.weight(1f),
                                        enabled = !isSubmitting
                                    )
                                    TTButton(
                                        text = "Eliminar / Cancelar Obra",
                                        onClick = {
                                            isSubmitting = true
                                            viewModel.deleteProject(projectToDelete!!.id) { _, _ ->
                                                isSubmitting = false
                                                projectToDelete = null
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

                // DIALOGO CREAR NUEVA OBRA DE CONSTRUCCION
                if (showCreateDialog) {
                    androidx.compose.ui.window.Dialog(onDismissRequest = { if (!isSubmitting) showCreateDialog = false }) {
                        TTCard(modifier = Modifier.fillMaxWidth()) {
                            Column(
                                modifier = Modifier.verticalScroll(rememberScrollState()),
                                verticalArrangement = Arrangement.spacedBy(12.dp)
                            ) {
                                Text(
                                    text = "Nueva Obra de Construcción",
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
                                    placeholder = "OBRA-003"
                                )

                                TTTextField(
                                    value = name,
                                    onValueChange = { name = it },
                                    label = "Nombre de la Obra",
                                    placeholder = "Construcción Edificio Norte"
                                )

                                TTTextField(
                                    value = location,
                                    onValueChange = { location = it },
                                    label = "Ubicación / Dirección",
                                    placeholder = "Av. Insurgentes Sur 450, CDMX"
                                )

                                TTTextField(
                                    value = budgetText,
                                    onValueChange = { budgetText = it },
                                    label = "Presupuesto Total ($)",
                                    placeholder = "1500000"
                                )

                                TTTextField(
                                    value = managerName,
                                    onValueChange = { managerName = it },
                                    label = "Residente / Responsable",
                                    placeholder = "Ing. Carlos Mendoza"
                                )

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    TTButton(
                                        text = "Cancelar",
                                        onClick = { showCreateDialog = false },
                                        variant = TTButtonVariant.Ghost,
                                        modifier = Modifier.weight(1f),
                                        enabled = !isSubmitting
                                    )
                                    TTButton(
                                        text = "Guardar Obra",
                                        onClick = {
                                            if (code.isBlank() || name.isBlank()) {
                                                formError = "Ingrese código y nombre de obra."
                                                return@TTButton
                                            }
                                            val budget = budgetText.toDoubleOrNull() ?: 0.0
                                            isSubmitting = true
                                            viewModel.createProject(code, name, location, budget, managerName) { success, err ->
                                                isSubmitting = false
                                                if (success) {
                                                    showCreateDialog = false
                                                } else {
                                                    formError = err ?: "Error al registrar la obra."
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

@Composable
fun ProjectCard(
    project: ProjectDto,
    onClick: () -> Unit,
    onDeleteClick: (() -> Unit)? = null
) {
    val progress = if (project.budget > 0) (project.executedAmount / project.budget).coerceIn(0.0, 1.0).toFloat() else 0f
    val percentage = (progress * 100).toInt()

    TTCard(
        modifier = Modifier.clickable { onClick() }
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "${project.code} · ${project.name}",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color = TecodeTextPrimary
                    )
                    if (!project.location.isNullOrEmpty()) {
                        Text(
                            text = "📍 ${project.location}",
                            fontSize = 12.sp,
                            color = TecodeTextMuted
                        )
                    }
                }
                TTBadge(
                    status = project.status,
                    customLabel = project.status.replace("_", " ")
                )
            }

            if (!project.description.isNullOrEmpty()) {
                Text(
                    text = project.description,
                    fontSize = 12.sp,
                    color = TecodeTextSecondary
                )
            }

            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "Ejecutado: $${String.format("%.2f", project.executedAmount)}",
                        fontSize = 11.sp,
                        color = TecodeTextSecondary
                    )
                    Text(
                        text = "Presupuesto: $${String.format("%.2f", project.budget)} ($percentage%)",
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                        color = TecodeAccent
                    )
                }

                LinearProgressIndicator(
                    progress = { progress },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(8.dp)
                        .clip(RoundedCornerShape(4.dp)),
                    color = if (percentage > 90) TecodeError else TecodeAccent,
                    trackColor = TecodeBorder,
                )
            }

            if (!project.managerName.isNullOrEmpty()) {
                Text(
                    text = "👷 Responsable: ${project.managerName}",
                    fontSize = 11.sp,
                    color = TecodeTextMuted
                )
            }

            if (onDeleteClick != null) {
                Spacer(modifier = Modifier.height(6.dp))
                TTButton(
                    text = "Eliminar / Cancelar Obra",
                    onClick = onDeleteClick,
                    variant = TTButtonVariant.Danger,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}
