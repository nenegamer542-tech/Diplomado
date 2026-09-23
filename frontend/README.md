# Frontend (Expo · React Native + React Native Web)

Un solo codebase para web, iOS y Android. Esqueleto de FASE 2: login, sesión y home con permisos reales del backend.

## Arranque

```powershell
# desde la raíz del proyecto (el backend debe estar corriendo)
copy ..\.env.example .env     # si no lo hiciste en la raíz
npm install
npm run web                   # → http://localhost:19006
```

La variable `EXPO_PUBLIC_API_URL` (en `.env`, ver `.env.example`) apunta a `http://localhost:4000/api/v1`.

## Estructura

```
frontend/
├── index.js              # registro único (web/móvil)
├── App.js                # AuthProvider + selector login/home
├── app.json · babel.config.js
└── src/
    ├── api/client.js     # fetch con token, refresh automático (1 intento) y errores del backend
    ├── auth/AuthContext.js  # login/logout/session
    ├── screens/LoginScreen.js
    └── screens/HomeScreen.js  # empresa, rol, módulos y permisos
```

## Notas

- Sin navegación todavía (un solo cambio de pantalla por sesión); `@react-navigation` llega con los módulos de la FASE 3.
- Los tokens viven en memoria: al recargar se pierde la sesión (TODO: AsyncStorage).
- Los estilos usan `StyleSheet` de React Native: válidos en web y móvil sin cambios.
- El home ya degrada por permisos (`products.read`, `sales.orders.read`…): sirve de prueba viva del RBAC.
