# Tec[ode Design System

## Visión General

El **Tec[ode Design System** es la fuente única de verdad para la interfaz visual y la experiencia de usuario de **Tec[ode ERP**. Diseñado sobre una estética *Dark Theme First* de inspiración tecnológica, gaming empresarial y SaaS premium.

---

## 1. Tokens de Diseño (`src/design-system/tokens/`)

### Colores (`colors.js`)
```javascript
export const COLORS = {
  // Estructura
  background: '#080B14',   // Fondo principal
  surface: '#0D111C',      // Barra superior y paneles
  card: '#111622',         // Tarjetas operativas y tablas
  cardElevated: '#151B28', // Modales y cards destacados
  border: '#252D3D',       // Líneas divisoras y bordes
  borderHover: '#3B475D',
  borderFocus: '#7C3AED',

  // Identidad
  primary: '#7C3AED',       // Morado TECTODE Marca
  primaryLight: '#9333EA',
  primaryDark: '#5B21B6',

  // Acentos & Acciones
  accent: '#B6FF00',        // Lime/Verde TECTODE (CTAs primarios, activos)
  accentHover: '#A2E000',
  info: '#00D9FF',          // Cyan (Métricas, información)

  // Estados Semánticos
  success: '#B6FF00',
  warning: '#F59E0B',
  error: '#EF4444',

  // Tipografía
  textPrimary: '#F8FAFC',
  textSecondary: '#CBD5E1',
  textMuted: '#94A3B8',
  textDark: '#080B14',
};
```

---

## 2. Componentes UI (`src/design-system/components/`)

| Componente | Descripción | Uso Principal |
|---|---|---|
| `TTButton` | Botón interactivo con variantes `primary` (Lime), `brand` (Morado), `secondary`, `ghost` y `danger`. | Formularios, barras de herramientas y modales. |
| `TTInput` | Campo de entrada con bordes TECTODE, estado de foco neón y conmutador de contraseña. | Formularios CRUD y login. |
| `TTSearch` | Buscador compacto con icono y botón de limpiado rápido. | Búsqueda global y filtros de tablas. |
| `TTCard` & `TTStatCard` | Tarjetas contenedoras y tarjetas KPI empresariales. | Dashboard, métricas y reportes. |
| `TTBadge` | Chips de estado con luminosidad semántica (`active`, `APPROVED`, `RELEASED`, `LOCKED`, etc.). | Tablas, tarjetas y listas. |
| `TTAvatar` | Identificador con iniciales o icono del usuario activo. | Cabecera y perfiles. |
| `TTTabs` | Tiras de pestañas secundarias con badges. | Vistas de reportes y filtros. |
| `TTBreadcrumb` | Migas de pan de navegación dinámica. | Cabecera del App Shell. |
| `TTSelect` | Desplegable en modo oscuro con buscador de opciones integrado. | Selectores de catálogos. |
| `TTModal` & `TTConfirmModal` | Ventanas modales y confirmaciones para acciones destructivas/importantes. | Formularios y confirmación de baja/aprobación. |
| `TTTable` | Tabla de datos paginada con acciones, búsqueda y ordenamiento. | Todas las 22 pantallas de listados operacionales. |
| `TTDetailModal` | Visualizador de registros y trazabilidad JSON de auditoría. | Inspección de registros y órdenes. |

---

## 3. Navegación & App Shell (`src/components/Layout.js`)

- **Sidebar de 240px (Colapsable a 72px en Tablet/Desktop)**.
- **Drawer Deslizante en Móvil (<768px)**.
- **Filtrado RBAC**: Muestra únicamente los accesos permitidos según el rol del usuario autenticado (`can(permission)`).

Categorías de Navegación:
1. **INICIO**: Dashboard
2. **OPERACIONES**: Inventario, Compras, Ventas
3. **FINANZAS**: Cuentas, Ingresos, Gastos, Presupuestos, Reportes
4. **NEGOCIO**: CRM, RRHH, Producción
5. **ADMINISTRACIÓN**: Sucursales, Usuarios, Roles, Auditoría
