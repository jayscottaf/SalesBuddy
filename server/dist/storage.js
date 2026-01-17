"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analysisStore = void 0;
const analyses = [];
exports.analysisStore = {
    save: (analysis) => {
        analyses.unshift(analysis);
        return analysis;
    },
    list: (limit = 20) => analyses.slice(0, limit).map(item => ({
        id: item.id,
        createdAt: item.createdAt,
        meetingDate: item.meetingDate,
        accountName: item.accountName,
        summary: item.summary,
        intent: item.intent,
    })),
    get: (id) => analyses.find(item => item.id === id),
};
