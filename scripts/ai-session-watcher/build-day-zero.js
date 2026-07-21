const fs = require('fs');
const path = require('path');
const readline = require('readline');

// We will use a simple recursive readdir instead of glob to avoid dependencies
function getFilesRecursively(dir, filterFn, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            getFilesRecursively(fullPath, filterFn, fileList);
        } else if (filterFn(fullPath)) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

const ANTIGRAVITY_BASE = 'C:/Users/eojon/.gemini/antigravity-ide/brain';
const COPILOT_BASE = 'C:/Users/eojon/AppData/Roaming/Code/User/workspaceStorage';
const SESSIONS_OBSIDIAN = 'E:\\_Biblioteca\\Notas Obsidian\\Antenor e Filhos\\06 - Sessões';
const SESSIONS_LOCAL = 'f:\\VC.VERSE\\PROJETOS\\antenor e filhos\\pedidos nr\\arquivos-projeto\\md\\06 - Sessões';

async function buildDayZero() {
    console.log('Limpando arquivos antigos...');
    [SESSIONS_OBSIDIAN, SESSIONS_LOCAL].forEach(dir => {
        if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach(file => {
                if (file.startsWith('Sessao_')) {
                    fs.unlinkSync(path.join(dir, file));
                }
            });
        }
    });

    console.log('Procurando arquivos .jsonl...');
    const agFiles = getFilesRecursively(ANTIGRAVITY_BASE, f => f.endsWith('transcript.jsonl'));
    const copilotFiles = getFilesRecursively(COPILOT_BASE, f => f.includes('GitHub.copilot-chat') && f.endsWith('.jsonl'));

    const allFiles = [...agFiles, ...copilotFiles];
    let messages = [];

    console.log(`Encontrados ${allFiles.length} arquivos. Lendo e extraindo mensagens...`);

    for (const file of allFiles) {
        const aiType = file.includes('antigravity') ? 'Antigravity' : 'Copilot';
        const stream = fs.createReadStream(file);
        const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                const data = JSON.parse(line);
                let timeStr = data.timestamp || data.created_at;
                if (!timeStr) continue;
                
                const time = new Date(timeStr);
                
                if (aiType === 'Copilot') {
                    if (data.type === 'user.message') {
                        messages.push({ time, source: 'Usuário', text: data.data?.content || '' });
                    } else if (data.type === 'assistant.message') {
                        messages.push({ time, source: 'Copilot', text: data.data?.content || '' });
                    }
                } else if (aiType === 'Antigravity') {
                    if (data.source === 'USER_EXPLICIT' && data.type === 'USER_INPUT') {
                        messages.push({ time, source: 'Usuário', text: data.content || '' });
                    } else if (data.source === 'MODEL' && (data.type === 'PLANNER_RESPONSE' || data.type === 'EXECUTOR_RESPONSE')) {
                        messages.push({ time, source: 'Antigravity', text: data.content || '' });
                    }
                }
            } catch (e) {
                // ignorar json invalido
            }
        }
    }

    console.log(`Ordenando ${messages.length} mensagens cronologicamente...`);
    messages.sort((a, b) => a.time - b.time);

    function sanitize(text, source) {
        if (!text) return null;

        // Para mensagens do usuário no Antigravity: pegar só o que está dentro de <USER_REQUEST>
        if (source === 'Usuário') {
            const match = text.match(/<USER_REQUEST>([\s\S]*?)<\/USER_REQUEST>/);
            if (match) text = match[1].trim();
        }

        // Remove tags XML/HTML residuais (<ADDITIONAL_METADATA>, <USER_SETTINGS_CHANGE>, etc.)
        text = text.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '');
        text = text.replace(/<[^>]+>/g, '');

        // Remove blocos de código (muito pesados e ilegíveis fora do contexto)
        text = text.replace(/```[\s\S]*?```/g, '[bloco de código omitido]');

        // Remove markdown pesado
        text = text.replace(/\*\*/g, '').replace(/\*/g, '');
        text = text.replace(/#{1,6} /g, '');
        text = text.replace(/`[^`]+`/g, '');
        text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

        // Remove linhas em branco extras
        text = text.replace(/\n{3,}/g, '\n\n').trim();

        // Ignora mensagens muito curtas ou vazias (ruído de sistema)
        if (text.length < 5) return null;

        // Trunca mensagens longas da IA (respostas de 10k chars) — mantém as primeiras 500 chars
        if (source !== 'Usuário' && text.length > 500) {
            text = text.substring(0, 500).trim() + '... [truncado]';
        }

        return text;
    }

    let mdBuffer = `HISTORICO UNIFICADO - DAY 0\n=============================\n\n`;

    for (const msg of messages) {
        const pad = n => n.toString().padStart(2, '0');
        const d = msg.time;
        const dateStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
        const timeStr = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

        const clean = sanitize(msg.text, msg.source);
        if (!clean) continue; // pula ruído

        mdBuffer += `[${dateStr} ${timeStr}] ${msg.source}\n${clean}\n\n`;
    }

    console.log('Escrevendo Day_0_Historico.md...');
    const day0FileObs = path.join(SESSIONS_OBSIDIAN, 'Day_0_Historico.md');
    const day0FileLoc = path.join(SESSIONS_LOCAL, 'Day_0_Historico.md');

    fs.writeFileSync(day0FileObs, mdBuffer);
    fs.writeFileSync(day0FileLoc, mdBuffer);
    
    console.log('Day 0 gerado com sucesso!');
}

buildDayZero().catch(console.error);
