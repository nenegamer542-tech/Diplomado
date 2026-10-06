package com.diplomado.erp.feature.projects.presentation

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
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
import com.diplomado.erp.ui.components.*
import com.diplomado.erp.ui.theme.*

@Composable
fun ProjectDetailScreen(
    projectId: String,
    onBackClick: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ProjectDetailViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(projectId) {
        viewModel.loadProjectDetail(projectId)
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp)
    ) {
        when (val state = uiState) {
            is ProjectDetailUiState.Loading -> {
                TTLoading(text = "Cargando Centro de Control de la Obra...")
            }
            is ProjectDetailUiState.Error -> {
                TTEmptyState(
                    title = "Error de carga",
                    description = state.message,
                    actionLabel = "Reintentar",
                    onAction = { viewModel.loadProjectDetail(projectId) }
                )
            }
            is ProjectDetailUiState.Success -> {
                val project = state.project
                val costCenters = state.costCenters
                val available = (project.budget - project.executedAmount).coerceAtLeast(0.0)
                val progress = if (project.budget > 0) (project.executedAmount / project.budget).coerceIn(0.0, 1.0).toFloat() else 0f
                val percentage = (progress * 100).toInt()

                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    item {
                        TTButton(
                            text = "‹ Volver a Mis Obras",
                            onClick = onBackClick,
                            variant = TTButtonVariant.Ghost
                        )
                    }

                    // CABECERA DE LA OBRA
                    item {
                        TTCard {
                            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    TTBadge(status = "active", customLabel = project.code)
                                    TTBadge(status = project.status, customLabel = project.status.replace("_", " "))
                                }

                                Text(
                                    text = project.name,
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = TecodeTextPrimary
                                )

                                if (!project.location.isNullOrEmpty()) {
                                    Text(
                                        text = "📍 Ubicación: ${project.location}",
                                        fontSize = 13.sp,
                                        color = TecodeTextSecondary
                                    )
                                }

                                if (!project.managerName.isNullOrEmpty()) {
                                    Text(
                                        text = "👷 Residente a cargo: ${project.managerName}",
                                        fontSize = 12.sp,
                                        color = TecodeTextMuted
                                    )
                                }
                            }
                        }
                    }

                    // METRICAS / KPIS DE LA OBRA
                    item {
                        Text(
                            text = "Control Presupuestario de Obra",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = TecodeTextPrimary
                        )
                    }

                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            TTStatCard(
                                label = "Presupuesto Total",
                                value = "$${String.format("%.2f", project.budget)}",
                                trend = "Aprobado",
                                accentColor = TecodeAccent,
                                modifier = Modifier.weight(1f)
                            )
                            TTStatCard(
                                label = "Gastos Ejecutados",
                                value = "$${String.format("%.2f", project.executedAmount)}",
                                trend = "$percentage% gastado",
                                accentColor = TecodeInfo,
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }

                    item {
                        TTStatCard(
                            label = "Disponible para Ejecutar",
                            value = "$${String.format("%.2f", available)}",
                            trend = "Fondo restante",
                            accentColor = if (available > 0) TecodeAccent else TecodeError
                        )
                    }

                    item {
                        TTCard(title = "Avance de Ejecución Financiera") {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                LinearProgressIndicator(
                                    progress = { progress },
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .height(10.dp)
                                        .clip(RoundedCornerShape(5.dp)),
                                    color = if (percentage > 90) TecodeError else TecodeAccent,
                                    trackColor = TecodeBorder,
                                )
                                Text(
                                    text = "Se ha ejecutado el $percentage% del presupuesto total de la obra.",
                                    fontSize = 12.sp,
                                    color = TecodeTextMuted
                                )
                            }
                        }
                    }

                    // CENTROS DE COSTO DE LA OBRA
                    item {
                        Text(
                            text = "Partidas y Centros de Costo (${costCenters.size})",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = TecodeTextPrimary
                        )
                    }

                    if (costCenters.isEmpty()) {
                        item {
                            TTCard {
                                Text(
                                    text = "Sin partidas ni centros de costo registrados para esta obra.",
                                    fontSize = 13.sp,
                                    color = TecodeTextMuted
                                )
                            }
                        }
                    } else {
                        items(costCenters) { cc ->
                            TTCard {
                                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = "${cc.code} · ${cc.name}",
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TecodeTextPrimary
                                        )
                                        TTBadge(status = "active", customLabel = cc.category)
                                    }

                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Text(
                                            text = "Ejecutado: $${String.format("%.2f", cc.executedAmount)}",
                                            fontSize = 12.sp,
                                            color = TecodeTextSecondary
                                        )
                                        Text(
                                            text = "Presupuesto: $${String.format("%.2f", cc.budget)}",
                                            fontSize = 12.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = TecodeAccent
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
}
