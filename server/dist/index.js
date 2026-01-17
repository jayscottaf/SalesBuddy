"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const crypto_1 = __importDefault(require("crypto"));
const storage_1 = require("./storage");
const analysis_1 = require("./ai/analysis");
const app = (0, express_1.default)();
const port = process.env.PORT ? Number(process.env.PORT) : 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '2mb' }));
app.post('/api/sales/analysis', async (req, res) => {
    const body = req.body;
    if (!body?.transcript || typeof body.transcript !== 'string') {
        return res.status(400).json({ message: 'Transcript is required.' });
    }
    let analysisPayload;
    try {
        if (!process.env.OPENAI_API_KEY) {
            analysisPayload = (0, analysis_1.analyzeTranscriptFallback)(body);
        }
        else {
            analysisPayload = await (0, analysis_1.analyzeTranscriptWithAI)(body);
        }
    }
    catch (error) {
        console.error('OpenAI analysis failed, using fallback:', error);
        analysisPayload = (0, analysis_1.analyzeTranscriptFallback)(body);
    }
    const analysis = {
        id: crypto_1.default.randomUUID(),
        createdAt: new Date().toISOString(),
        ...analysisPayload,
    };
    storage_1.analysisStore.save(analysis);
    return res.json(analysis);
});
app.get('/api/sales/analysis', (req, res) => {
    const limitRaw = req.query.limit;
    const limit = limitRaw ? Math.min(Number(limitRaw), 50) : 20;
    res.json(storage_1.analysisStore.list(limit));
});
app.get('/api/sales/analysis/:id', (req, res) => {
    const analysis = storage_1.analysisStore.get(req.params.id);
    if (!analysis) {
        return res.status(404).json({ message: 'Analysis not found.' });
    }
    return res.json(analysis);
});
app.post('/api/sales/improve', async (req, res) => {
    const { content, type } = req.body;
    if (!content || typeof content !== 'string') {
        return res.status(400).json({ message: 'Content is required.' });
    }
    if (!type || !['email', 'callScript'].includes(type)) {
        return res.status(400).json({ message: 'Type must be "email" or "callScript".' });
    }
    try {
        const improved = await (0, analysis_1.improveContent)(content, type);
        return res.json({ improved });
    }
    catch (error) {
        console.error('AI improve failed:', error);
        return res.status(500).json({ message: 'Failed to improve content.' });
    }
});
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});
app.listen(port, () => {
    console.log(`Salesbuddy server running on http://localhost:${port}`);
    if (!process.env.OPENAI_API_KEY) {
        console.log('OPENAI_API_KEY not set; using fallback analysis.');
    }
});
