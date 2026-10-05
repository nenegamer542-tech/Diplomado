'use strict';

const https = require('https');
const env = require('../config/env');
const logger = require('../config/logger');

/**
 * Servicio de envío de correos electrónicos vía Resend API.
 * Integra la plantilla HTML corporativa de Tec[ode ERP Constructor.
 */

function getWelcomeHtml({ name, email, password, companyName, roleName }) {
  const loginUrl = 'https://tectode-erp.pages.dev';
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Bienvenido a Tec[ode ERP Constructor</title>
</head>
<body style="margin: 0; padding: 0; background-color: #080B14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #F3F4F6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #080B14; padding: 40px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" max-width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #111622; border: 1px solid #252D3D; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">

          <!-- Encabezado con Logo Tec[ode -->
          <tr>
            <td style="background-color: #0D111C; padding: 28px 32px; border-bottom: 1px solid #252D3D; text-align: left;">
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background-color: #7C3AED; padding: 8px 12px; border-radius: 10px; font-weight: 900; color: #080B14; font-size: 18px; font-family: monospace;">
                    T &lt;&gt;
                  </td>
                  <td style="padding-left: 14px;">
                    <span style="font-size: 22px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px;">Tec<span style="color: #B6FF00;">[</span>ode</span>
                    <br>
                    <span style="font-size: 10px; font-weight: 800; color: #B6FF00; letter-spacing: 1.2px; text-transform: uppercase;">ERP CONSTRUCTOR</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Cuerpo Principal -->
          <tr>
            <td style="padding: 36px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #FFFFFF; line-height: 1.3;">
                ¡Bienvenido a bordo, ${name || 'Colaborador'}! 🏗️
              </h1>

              <p style="margin: 0 0 20px 0; font-size: 15px; color: #9CA3AF; line-height: 1.6;">
                Tu cuenta ha sido creada exitosamente en la plataforma <strong style="color: #FFFFFF;">Tec[ode ERP Constructor</strong>. A partir de ahora podrás gestionar obras, materiales, compras, finanzas y presupuestos en tiempo real.
              </p>

              <!-- Tarjeta de Detalles de la Cuenta -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #151B28; border: 1px solid #252D3D; border-radius: 12px; margin: 24px 0; padding: 20px;">
                <tr>
                  <td>
                    <div style="font-size: 12px; font-weight: 700; color: #B6FF00; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 12px;">
                      DATOS DE ACCESO
                    </div>
                    <p style="margin: 4px 0; font-size: 14px; color: #E5E7EB;">
                      <strong style="color: #9CA3AF;">Correo Electrónico:</strong> ${email}
                    </p>
                    <p style="margin: 4px 0; font-size: 14px; color: #E5E7EB;">
                      <strong style="color: #9CA3AF;">Contraseña de Acceso:</strong> <span style="color: #B6FF00; font-family: monospace; font-weight: bold; font-size: 16px;">${password || 'Password123!'}</span>
                    </p>
                    ${companyName ? `<p style="margin: 4px 0; font-size: 14px; color: #E5E7EB;"><strong style="color: #9CA3AF;">Empresa Constructora:</strong> ${companyName}</p>` : ''}
                    ${roleName ? `<p style="margin: 4px 0; font-size: 14px; color: #E5E7EB;"><strong style="color: #9CA3AF;">Rol Asignado:</strong> ${roleName}</p>` : ''}
                  </td>
                </tr>
              </table>

              <!-- Botón de Acción -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 32px 0 16px 0;">
                <tr>
                  <td align="center" style="background-color: #B6FF00; border-radius: 10px;">
                    <a href="${loginUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 15px; font-weight: 800; color: #080B14; text-decoration: none; border-radius: 10px;">
                      Ingresar a la Plataforma Web →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0 0 0; font-size: 13px; color: #6B7280; line-height: 1.5;">
                También puedes acceder directamente desde la App Móvil Android <strong style="color: #9CA3AF;">ERP Constructor</strong> instalada en tu dispositivo.
              </p>
            </td>
          </tr>

          <!-- Pie de Página -->
          <tr>
            <td style="background-color: #0D111C; padding: 24px 32px; border-top: 1px solid #252D3D; text-align: center; font-size: 12px; color: #6B7280;">
              <p style="margin: 0 0 6px 0;">Tec[ode ERP Constructor · Plataforma Multiempresa de Gestión de Obras</p>
              <p style="margin: 0;">Este es un mensaje automático generado por el sistema. Por favor no responda a este correo.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

async function sendEmail({ to, subject, html }) {
  const apiKey = env.resend.apiKey;
  if (!apiKey) {
    logger.info({ to, subject }, '[email.service] RESEND_API_KEY no configurada; omitiendo envío real.');
    return { success: true, simulated: true };
  }

  // Valida y limpia el formato del remitente
  let fromAddress = env.resend.fromEmail || 'onboarding@resend.dev';
  if (!fromAddress.includes('@') || !fromAddress.includes('>')) {
    fromAddress = 'onboarding@resend.dev';
  }

  const payload = JSON.stringify({
    from: fromAddress,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  });

  return new Promise((resolve, reject) => {
    const req = https.request(
      'https://api.resend.com/emails',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let responseBody = '';
        res.on('data', (chunk) => (responseBody += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            logger.info({ to, subject }, '[email.service] Correo enviado exitosamente vía Resend.');
            resolve({ success: true, response: JSON.parse(responseBody || '{}') });
          } else {
            logger.error({ statusCode: res.statusCode, body: responseBody }, '[email.service] Error al enviar vía Resend.');
            resolve({ success: false, error: responseBody });
          }
        });
      }
    );

    req.on('error', (err) => {
      logger.error({ err: err.message }, '[email.service] Excepción en solicitud Resend');
      resolve({ success: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
}

async function sendWelcomeEmail({ email, name, password, companyName, roleName }) {
  const html = getWelcomeHtml({ email, name, password, companyName, roleName });
  return sendEmail({
    to: email,
    subject: '¡Bienvenido a Tec[ode ERP Constructor! 🏗️',
    html,
  });
}

function getLoginNotificationHtml({ name, email, date, ip }) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Inicio de Sesión Detectado - Tec[ode ERP</title></head>
<body style="margin: 0; padding: 0; background-color: #080B14; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #F3F4F6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #080B14; padding: 40px 10px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #111622; border: 1px solid #252D3D; border-radius: 16px; overflow: hidden; padding: 32px;">
        <tr>
          <td>
            <div style="margin-bottom: 20px;">
              <span style="font-size: 22px; font-weight: 800; color: #FFFFFF;">Tec<span style="color: #B6FF00;">[</span>ode</span>
              <br><span style="font-size: 10px; font-weight: 800; color: #B6FF00; letter-spacing: 1px;">ERP CONSTRUCTOR</span>
            </div>
            <h2 style="color: #FFFFFF; font-size: 20px; margin: 0 0 12px 0;">Inicio de Sesión Detectado 🔐</h2>
            <p style="color: #9CA3AF; font-size: 14px; line-height: 1.5; margin: 0 0 20px 0;">
              Hola <strong style="color: #FFFFFF;">${name || email}</strong>, se ha iniciado sesión correctamente en tu cuenta de <strong style="color: #FFFFFF;">Tec[ode ERP Constructor</strong>.
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #151B28; border: 1px solid #252D3D; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
              <tr>
                <td>
                  <p style="margin: 4px 0; color: #E5E7EB; font-size: 13px;"><strong style="color: #9CA3AF;">Correo:</strong> ${email}</p>
                  <p style="margin: 4px 0; color: #E5E7EB; font-size: 13px;"><strong style="color: #9CA3AF;">Fecha y Hora:</strong> ${date}</p>
                  ${ip ? `<p style="margin: 4px 0; color: #E5E7EB; font-size: 13px;"><strong style="color: #9CA3AF;">Dirección IP:</strong> ${ip}</p>` : ''}
                </td>
              </tr>
            </table>
            <p style="color: #6B7280; font-size: 12px; line-height: 1.5; margin: 0;">
              Si fuiste tú, puedes ignorar este mensaje. Si no reconoces esta actividad, te recomendamos cambiar tu contraseña de inmediato.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
  `;
}

async function sendLoginNotification({ email, name, ip }) {
  const date = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });
  const html = getLoginNotificationHtml({ name, email, date, ip });
  return sendEmail({
    to: email,
    subject: '🔐 Notificación de Inicio de Sesión - Tec[ode ERP Constructor',
    html,
  });
}

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendLoginNotification,
};
