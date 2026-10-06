package com.diplomado.erp.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.NavType
import androidx.navigation.navArgument
import com.diplomado.erp.core.security.TokenStorage
import com.diplomado.erp.feature.auth.presentation.LoginScreen
import com.diplomado.erp.feature.configuration.presentation.AuditScreen
import com.diplomado.erp.feature.configuration.presentation.MoreScreen
import com.diplomado.erp.feature.crm.presentation.LeadsScreen
import com.diplomado.erp.feature.dashboard.presentation.DashboardScreen
import com.diplomado.erp.feature.finance.presentation.AccountsScreen
import com.diplomado.erp.feature.hr.presentation.EmployeesScreen
import com.diplomado.erp.feature.inventory.movements.presentation.MovementsScreen
import com.diplomado.erp.feature.inventory.products.presentation.ProductsScreen
import com.diplomado.erp.feature.inventory.stock.presentation.StockScreen
import com.diplomado.erp.feature.projects.presentation.ProjectDetailScreen
import com.diplomado.erp.feature.projects.presentation.ProjectsScreen
import com.diplomado.erp.feature.purchases.presentation.PurchaseOrdersScreen
import com.diplomado.erp.feature.sales.presentation.SalesOrdersScreen
import com.diplomado.erp.feature.users.presentation.UsersScreen
import com.diplomado.erp.ui.components.TTBottomBar
import com.diplomado.erp.ui.components.TTTopBar
import com.diplomado.erp.ui.theme.TecodeBackground

@Composable
fun NavGraph(
    modifier: Modifier = Modifier,
    navController: NavHostController = rememberNavController()
) {
    val startDestination = if (TokenStorage.hasValidSession()) {
        NavDestination.Main.route
    } else {
        NavDestination.Login.route
    }

    NavHost(
        navController = navController,
        startDestination = startDestination,
        modifier = modifier
    ) {
        composable(NavDestination.Login.route) {
            LoginScreen(
                onLoginSuccess = {
                    navController.navigate(NavDestination.Main.route) {
                        popUpTo(NavDestination.Login.route) { inclusive = true }
                    }
                }
            )
        }

        composable(NavDestination.Main.route) {
            MainContainer(
                onLogout = {
                    TokenStorage.clear()
                    navController.navigate(NavDestination.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                }
            )
        }
    }
}

@Composable
fun MainContainer(
    onLogout: () -> Unit
) {
    val innerNavController = rememberNavController()
    val navBackStackEntry by innerNavController.currentBackStackEntryAsState()
    val currentRoute = navBackStackEntry?.destination?.route ?: NavDestination.Dashboard.route

    Scaffold(
        topBar = {
            TTTopBar(onLogoutClick = onLogout)
        },
        bottomBar = {
            TTBottomBar(
                currentRoute = currentRoute,
                onNavigate = { route ->
                    innerNavController.navigate(route) {
                        popUpTo(NavDestination.Dashboard.route) { saveState = true }
                        launchSingleTop = true
                        restoreState = true
                    }
                }
            )
        },
        containerColor = TecodeBackground
    ) { innerPadding ->
        NavHost(
            navController = innerNavController,
            startDestination = NavDestination.Dashboard.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(NavDestination.Dashboard.route) {
                DashboardScreen(onNavigate = { route -> innerNavController.navigate(route) })
            }
            composable(NavDestination.Projects.route) {
                ProjectsScreen(
                    onProjectClick = { projectId ->
                        innerNavController.navigate(NavDestination.ProjectDetail.createRoute(projectId))
                    }
                )
            }
            composable(
                route = NavDestination.ProjectDetail.route,
                arguments = listOf(navArgument("projectId") { type = NavType.StringType })
            ) { backStackEntry ->
                val projectId = backStackEntry.arguments?.getString("projectId") ?: ""
                ProjectDetailScreen(
                    projectId = projectId,
                    onBackClick = { innerNavController.popBackStack() }
                )
            }
            composable(NavDestination.Products.route) {
                ProductsScreen()
            }
            composable(NavDestination.Users.route) {
                UsersScreen()
            }
            composable(NavDestination.Stock.route) {
                StockScreen()
            }
            composable(NavDestination.Movements.route) {
                MovementsScreen()
            }
            composable(NavDestination.Purchases.route) {
                PurchaseOrdersScreen()
            }
            composable(NavDestination.Sales.route) {
                SalesOrdersScreen()
            }
            composable(NavDestination.Finance.route) {
                AccountsScreen()
            }
            composable(NavDestination.Leads.route) {
                LeadsScreen()
            }
            composable(NavDestination.Employees.route) {
                EmployeesScreen()
            }
            composable(NavDestination.More.route) {
                MoreScreen(onNavigate = { route -> innerNavController.navigate(route) })
            }
        }
    }
}
