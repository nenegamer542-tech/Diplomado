package com.diplomado.erp.feature.configuration.presentation

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ReceiptLong
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.diplomado.erp.core.common.rbac.PermissionChecker
import com.diplomado.erp.ui.components.TTCard
import com.diplomado.erp.ui.theme.TecodeAccent
import com.diplomado.erp.ui.theme.TecodeTextMuted
import com.diplomado.erp.ui.theme.TecodeTextPrimary

data class ModuleMenuItem(
    val title: String,
    val subtitle: String,
    val route: String,
    val icon: ImageVector,
    val permission: String?
)

@Composable
fun MoreScreen(
    onNavigate: (String) -> Unit,
    modifier: Modifier = Modifier
) {
    val allModules = listOf(
        ModuleMenuItem("Mis Obras", "Centros de costo y presupuestos", "projects", Icons.Default.Apartment, "projects.read"),
        ModuleMenuItem("Materiales", "Insumos, unidades y precios", "products", Icons.Default.Category, "products.read"),
        ModuleMenuItem("Existencias", "Bodegas y stock bajo", "stock", Icons.Default.BarChart, "inventory.read"),
        ModuleMenuItem("Kardex Insumos", "Movimientos de inventario", "movements", Icons.AutoMirrored.Filled.ReceiptLong, "inventory.read"),
        ModuleMenuItem("Compras", "Órdenes de compra a proveedores", "purchases", Icons.Default.ShoppingCart, "purchases.read"),
        ModuleMenuItem("Estimaciones", "Contratos e ingresos de obra", "sales", Icons.Default.LocalOffer, "sales.orders.read"),
        ModuleMenuItem("Finanzas", "Cajas chicas y cuentas bancarias", "finance", Icons.Default.AccountBalance, "finance.accounts.read"),
        ModuleMenuItem("Usuarios", "Gestión de personal y roles", "users", Icons.Default.Group, "users.read"),
        ModuleMenuItem("CRM Prospectos", "Embudo comercial de obras", "leads", Icons.Default.Handshake, "crm.read"),
        ModuleMenuItem("Cuadrillas RRHH", "Plantilla obrera y técnicos", "employees", Icons.Default.Engineering, "hr.read"),
        ModuleMenuItem("Trazabilidad", "Bitácora inmutable de auditoría", "audit", Icons.Default.VerifiedUser, "audit.read")
    )

    val permittedModules = allModules.filter { item ->
        item.permission == null || PermissionChecker.hasPermission(item.permission)
    }

    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Column {
            Text(
                text = "Módulos de la Plataforma",
                fontSize = 22.sp,
                fontWeight = FontWeight.ExtraBold,
                color = TecodeTextPrimary
            )
            Text(
                text = "Acceso completo a todos los sistemas de Tec[ode ERP Constructor",
                fontSize = 12.sp,
                color = TecodeTextMuted
            )
        }

        LazyVerticalGrid(
            columns = GridCells.Fixed(2),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            modifier = Modifier.fillMaxSize()
        ) {
            items(permittedModules) { module ->
                TTCard(
                    modifier = Modifier.clickable { onNavigate(module.route) }
                ) {
                    Column(
                        verticalArrangement = Arrangement.spacedBy(8.dp),
                        horizontalAlignment = Alignment.Start
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(8.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = module.icon,
                                contentDescription = module.title,
                                tint = TecodeAccent,
                                modifier = Modifier.size(24.dp)
                            )
                        }

                        Text(
                            text = module.title,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = TecodeTextPrimary
                        )

                        Text(
                            text = module.subtitle,
                            fontSize = 11.sp,
                            color = TecodeTextMuted,
                            lineHeight = 14.sp
                        )
                    }
                }
            }
        }
    }
}
