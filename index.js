// backend/index.js (VERSIÓN CON REFERIDOS BLINDADOS v24.0)
const express = require('express');
const cors = require('cors');
const { Telegraf, Markup } = require('telegraf');
const morgan = require('morgan');
const crypto = require('crypto');
const dotenv = require('dotenv');
const colors = require('colors');
const { startWatcher } = require('./services/blockchainWatcherService');
// --- Carga de Configuración y Variables de Entorno ---
console.log('[SISTEMA] Iniciando aplicación NEURO LINK...');
dotenv.config();
const connectDB = require('./config/db');

// --- Verificación de Variables Críticas ---
function checkEnvVariables() {
    console.log('[SISTEMA] Verificando variables de entorno críticas...');
    const requiredVars = ['MONGO_URI', 'JWT_SECRET', 'TELEGRAM_BOT_TOKEN', 'FRONTEND_URL', 'ADMIN_URL', 'BACKEND_URL', 'BSCSCAN_API_KEY', 'MASTER_SEED_PHRASE'];
    const missingVars = requiredVars.filter(v => !process.env[v]);
    if (missingVars.length > 0) {
        console.error(`!! ERROR FATAL: FALTAN VARIABLES DE ENTORNO: ${missingVars.join(', ')}`.red.bold);
        process.exit(1);
    }
    console.log('[SISTEMA] ✅ Todas las variables de entorno críticas están presentes.');
}
checkEnvVariables();

// --- Conexión a la Base de Datos ---
connectDB();

// --- Carga de Módulos de Rutas ---
console.log('[SISTEMA] Cargando módulos de rutas...');
const authRoutes = require('./routes/authRoutes');
const toolRoutes = require('./routes/toolRoutes');
const referralRoutes = require('./routes/referralRoutes');
const rankingRoutes = require('./routes/rankingRoutes');
const walletRoutes = require('./routes/walletRoutes');
const teamRoutes = require('./routes/teamRoutes');
const taskRoutes = require('./routes/taskRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const treasuryRoutes = require('./routes/treasuryRoutes');
const userRoutes = require('./routes/userRoutes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
console.log('[SISTEMA] ✅ Módulos de rutas cargados.');

// --- Inicialización de Express y Telegram ---
const app = express();
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// --- Configuración de Middlewares ---
app.disable('etag');

const whitelist = [process.env.FRONTEND_URL, process.env.ADMIN_URL];
const corsOptions = {
    origin: (origin, callback) => {
        // Permitir peticiones sin origen (como las de Postman o scripts de servidor)
        if (!origin || whitelist.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            console.error(`[CORS] ❌ Origen RECHAZADO: '${origin}'. No está en la whitelist: [${whitelist.join(', ')}]`.red.bold);
            callback(new Error(`Origen no permitido por CORS: ${origin}`));
        }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(morgan('dev'));

// --- Definición de Rutas de la API ---
app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/tools', toolRoutes);
app.use('/api/ranking', rankingRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/treasury', treasuryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/referrals', referralRoutes);

const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET || crypto.randomBytes(32).toString('hex');
const secretPath = `/api/telegram-webhook/${secretToken}`;
app.post(secretPath, (req, res) => bot.handleUpdate(req.body, res));
console.log('[SISTEMA] ✅ Rutas de API registradas.');

// --- Lógica del Bot de Telegram ---
const WELCOME_MESSAGE = `
👋 ¡Bienvenido a NEURO LINK!\n\n
🔐 Tu acceso privilegiado al universo de la minería digital avanzada. Aquí, cada acción te acerca a recompensas exclusivas en *NTX*.\n\n
📘 ¿Cómo funciona?\n
1️⃣ Activa tu Minería: ⛏️ Inicia tu sesión cada 24 horas para comenzar a generar NTX, el token neural del ecosistema.\n
2️⃣ Optimiza tu Potencia: ⚙️ Accede a la tienda y adquiere herramientas con USDT, TRX o BNB. Aumenta tu velocidad de minería y maximiza tus beneficios.\n
3️⃣ Expande tu Red: 🧠 Invita a tus aliados con tu enlace personal. Obtén recompensas por su actividad y construye un flujo de ingresos pasivo.\n
4️⃣ Reclama y Evoluciona: 💎 Recupera tus NTX minados y fortalece tu saldo para futuras estrategias.\n\n
✨ Estás listo para comenzar tu travesía. Pulsa el botón inferior y desata el poder de la minería inteligente 🚀
`;

const escapeMarkdownV2 = (text) => text.replace(/([_*\[\]()~`>#+\-=|{}.!])/g, '\\$1');

// ======================= INICIO CORRECCIÓN ARQUITECTURAL DE REFERIDOS =======================
bot.command('start', async (ctx) => {
    try {
        const telegramId = ctx.from.id.toString();
        const startPayload = ctx.startPayload ? ctx.startPayload.trim() : null;

        if (startPayload) {
            console.log(`[Bot] Usuario ${telegramId} ha llegado con referido: ${startPayload}`);
        }

        // CORRECCIÓN: Usamos `startapp` para pasar el código de referido, como dicta la documentación de Telegram.
        const webAppUrl = startPayload
            ? `${process.env.FRONTEND_URL}?startapp=${startPayload}`
            : process.env.FRONTEND_URL;

        await ctx.replyWithMarkdownV2(
            escapeMarkdownV2(WELCOME_MESSAGE),
            Markup.inlineKeyboard([
                Markup.button.webApp('🚀 Abrir App', webAppUrl)
            ])
        );
    } catch (error) { 
        console.error('[Bot] Error en /start:', error); 
    }
});
// ======================== FIN CORRECCIÓN ARQUITECTURAL DE REFERIDOS =========================

bot.telegram.setMyCommands([{ command: 'start', description: 'Inicia la aplicación' }]);

// --- Middlewares de Manejo de Errores (al final) ---
app.use(notFound);
app.use(errorHandler);

// --- Arranque del Servidor ---
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, async () => {
    console.log(`[SERVIDOR] 🚀 Servidor corriendo en puerto ${PORT}`.yellow.bold);
    startWatcher(); 
    try {
        const botInfo = await bot.telegram.getMe();
        console.log(`[SERVIDOR] ✅ Conectado como bot: ${botInfo.username}.`);
        const webhookUrl = `${process.env.BACKEND_URL}${secretPath}`;
        await bot.telegram.setWebhook(webhookUrl, { secret_token: secretToken, drop_pending_updates: true });
        console.log(`[SERVIDOR] ✅ Webhook configurado en: ${webhookUrl}`.green.bold);
    } catch (telegramError) {
        console.error("[SERVIDOR] ❌ ERROR AL CONFIGURAR TELEGRAM:", telegramError.message);
    }
});

process.on('unhandledRejection', (err, promise) => {
    console.error(`❌ ERROR NO MANEJADO: ${err.message}`.red.bold);
    server.close(() => process.exit(1));
});