import 'dotenv/config';
import mainLayer from "./layers/main.layer";
// import { join } from 'path';
import { createBot, createProvider, createFlow, addKeyword } from '@builderbot/bot';
import { MemoryDB as Database } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import conversationalLayer from './layers/conversational.layer';
import AIClass from './services/ai';
import { flowConstruct, flowForm } from './flows/construct_.flow';
import flowAgente from './flows/agent.flow';
import { flowRepair } from './flows/repair.flow';
import { flowConstructIa } from './flows/construc2.flow';
import { flowAgentConfirm } from './flows/confirmAgent.flow';
// import blackListFlow from './flows/blackList.flow';


const PORT = process.env.PORT ?? 3008;
const ai = new AIClass(process.env.OPEN_API_KEY, 'gpt-3.5-turbo-16k');

const welcomeFlow = addKeyword<Provider, Database>(['hi', 'hello', 'hola', 'buenas','buenos dias', 'buenos días', 'buenas tardes', 'buenas noches', 'buen día', 'hola buenos días', 'Hola', 'Holis', 'pileta', 'hacer', 'necesito', 'quiero'])
    .addAnswer(`🙌 Hola bienvenido al *Chatbot* de AquaDreams`)
    .addAnswer(
        [
            'Decime si estás interesado en:',
            '👉  *CONSTRUIR* para construir una pileta',
            '👉  *REPARAR* para reparar una pileta',
            '👉  *AGENTE* para hablar con uno de nuestros agentes',
            '👉  *HOLA* para reinicar la conversación',
        ].join('\n'),
        { delay: 800, capture: true },
        async (ctx, { fallBack, gotoFlow }) => { // Asegúrate de incluir gotoFlow aquí
            const userInput = ctx.body.toLocaleLowerCase();

            if (!(userInput.includes('construir') || userInput.includes('reparar') || userInput.includes('agente'))) {
                return fallBack('Debes escribir *CONSTRUIR, REPARAR, AGENTE*');
            }
        }
    )
    .addAction(conversationalLayer)
    .addAction(mainLayer);

const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, flowConstruct, flowAgente, flowRepair, flowForm, flowConstructIa, flowAgentConfirm]);
    const adapterProvider = createProvider(Provider);
    const adapterDB = new Database();

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    }, { extensions: { ai } });

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body;
            await bot.sendMessage(number, message, { media: urlMedia ?? null });
            return res.end('sended');
        })
    );

    adapterProvider.server.post(
        '/v1/register',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body;
            await bot.dispatch('REGISTER_FLOW', { from: number, name });
            return res.end('trigger');
        })
    );

    adapterProvider.server.post(
        '/v1/samples',
        handleCtx(async (bot, req, res) => {
            const { number, name } = req.body;
            await bot.dispatch('SAMPLES', { from: number, name });
            return res.end('trigger');
        })
    );

    adapterProvider.server.post(
        '/v1/blacklist',
        handleCtx(async (bot, req, res) => {
            const { number, intent } = req.body;
            if (intent === 'remove') bot.blacklist.remove(number);
            if (intent === 'add') bot.blacklist.add(number);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'ok', number, intent }));
        })
    );

    httpServer(+PORT);
};

main();