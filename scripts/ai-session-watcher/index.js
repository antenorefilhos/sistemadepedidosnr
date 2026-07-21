const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configurações
const OBSIDIAN_VAULT = 'E:/_Biblioteca/Notas Obsidian/Antenor e Filhos/06 - Sessões';
const LOCAL_VAULT = 'f:/VC.VERSE/PROJETOS/antenor e filhos/pedidos nr/arquivos-projeto/md/06 - Sessões';
const ANTIGRAVITY_PATH = 'C:/Users/eojon/.gemini/antigravity-ide/brain/*/.system_generated/logs/transcript.jsonl';
const COPILOT_PATH = 'C:/Users/eojon/AppData/Roaming/Code/User/workspaceStorage/*/GitHub.copilot-chat/transcripts/*.jsonl';

// Estado de bytes lidos por arquivo
const fileState = new Map();

// Função para obter o nome da IA com base no caminho
function getAiType(filePath) {
    if (filePath.includes('antigravity-ide')) return 'Antigravity';
    if (filePath.includes('GitHub.copilot-chat')) return 'Copilot';
    return 'IA_Desconhecida';
}

function getSessionId(filePath, aiType) {
    if (aiType === 'Antigravity') {
        const parts = filePath.split(path.sep);
        const brainIndex = parts.indexOf('brain');
        if (brainIndex !== -1 && parts.length > brainIndex + 1) {
            return parts[brainIndex + 1];
        }
    } else if (aiType === 'Copilot') {
        return path.basename(filePath, '.jsonl');
    }
    return path.basename(filePath);
}

function cleanUserRequest(text) {
    if (!text) return '';
    let cleaned = text;
    // Remove any ADDITIONAL_METADATA blocks (including nested/incomplete ones)
    cleaned = cleaned.replace(/<ADDITIONAL_METADATA>[\s\S]*?<\/ADDITIONAL_METADATA>/gi, '');
    cleaned = cleaned.replace(/<\/ADDITIONAL_METADATA>/gi, '');
    cleaned = cleaned.replace(/<ADDITIONAL_METADATA>[\s\S]*$/gi, ''); // If it was cut off at the end
    // Remove USER_REQUEST tags
    cleaned = cleaned.replace(/<\/?USER_REQUEST>/gi, '');
    return cleaned.trim();
}

function isInternalNarration(content) {
    if (!content) return false;
    const pattern = /^(I\s+am|I\s+will|I'm|I\s+should|I\s+need|I\s+want|waiting|running|checking|verifying|updating|rebuilding|starting|executing)/i;
    return pattern.test(content);
}

function parseLine(line, aiType) {
    if (!line || !line.trim()) return null;
    try {
        const data = JSON.parse(line);
        let timeStr = data.timestamp || data.created_at;
        if (!timeStr) return null;
        
        const time = new Date(timeStr);
        const pad = n => n.toString().padStart(2, '0');
        const timeFormatted = `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
        const dateStr = `${time.getFullYear()}-${pad(time.getMonth()+1)}-${pad(time.getDate())}`;
        
        // Ignora mensagens anteriores a 24/05/2026 (já consolidadas no Day_0_Historico)
        if (dateStr < '2026-05-24') return null;
        
        let icon = aiType === 'Copilot' ? '🤖' : '🌌';
        
        if (aiType === 'Copilot') {
            if (data.type === 'user.message') {
                let content = (data.data?.content || '').trim();
                content = cleanUserRequest(content);
                if (!content || content === '---') return null;
                return {
                    date: dateStr,
                    text: `👤 **Usuário** \`[${timeFormatted}]\`\n\n${content}\n\n---\n`
                };
            } else if (data.type === 'assistant.message') {
                const content = (data.data?.content || '').trim();
                if (!content || content === '---') return null;
                return {
                    date: dateStr,
                    text: `${icon} **Copilot** \`[${timeFormatted}]\`\n\n${content}\n\n---\n`
                };
            }
        } else if (aiType === 'Antigravity') {
            if (data.source === 'USER_EXPLICIT' && data.type === 'USER_INPUT') {
                let content = (data.content || '').trim();
                content = cleanUserRequest(content);
                if (!content || content === '---') return null;
                return {
                    date: dateStr,
                    text: `👤 **Usuário** \`[${timeFormatted}]\`\n\n${content}\n\n---\n`
                };
            } else if (data.source === 'MODEL' && (data.type === 'PLANNER_RESPONSE' || data.type === 'EXECUTOR_RESPONSE')) {
                // SKIP intermediate tool call narrations
                if (data.tool_calls && data.tool_calls.length > 0) return null;
                
                const content = (data.content || '').trim();
                if (!content || content === '---') return null;
                
                // Skip internal English narrations/status messages
                if (isInternalNarration(content)) return null;
                
                return {
                    date: dateStr,
                    text: `${icon} **Antigravity** \`[${timeFormatted}]\`\n\n${content}\n\n---\n`
                };
            }
        }
    } catch (e) {}
    return null;
}

function writeToSessionFile(filePath, mdBuffer, todayStr, dirPath) {
    if (!mdBuffer) return;
    
    const headerPrefix = `---\ntipo: sessao-diaria\ndata: ${todayStr}\n---\n\n# Sessões do Dia ${todayStr}\n\n`;
    
    try {
        if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
        
        if (!fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, headerPrefix + mdBuffer, 'utf8');
            return;
        }
        
        let fileContent = fs.readFileSync(filePath, 'utf8');
        
        // Split mdBuffer back into individual messages to filter out already existing ones
        const newMessages = mdBuffer.split('\n---\n').map(m => m.trim()).filter(Boolean);
        let messagesToWrite = [];
        
        for (const msg of newMessages) {
            const firstLine = msg.split('\n')[0].trim();
            if (firstLine && !fileContent.includes(firstLine)) {
                messagesToWrite.push(msg + '\n\n---\n');
            }
        }
        
        if (messagesToWrite.length === 0) {
            return; // No new messages to write
        }
        
        const finalBuffer = messagesToWrite.join('\n');
        const headerPattern = `# Sessões do Dia ${todayStr}`;
        const index = fileContent.indexOf(headerPattern);
        
        if (index !== -1) {
            const insertPos = index + headerPattern.length;
            let bodyStart = insertPos;
            while (bodyStart < fileContent.length && (fileContent[bodyStart] === '\r' || fileContent[bodyStart] === '\n' || fileContent[bodyStart] === ' ' || fileContent[bodyStart] === '\t')) {
                bodyStart++;
            }
            
            const headerPart = fileContent.slice(0, bodyStart);
            const bodyPart = fileContent.slice(bodyStart);
            
            const newContent = headerPart + finalBuffer + '\n' + bodyPart;
            fs.writeFileSync(filePath, newContent, 'utf8');
        } else {
            fs.writeFileSync(filePath, headerPrefix + finalBuffer + '\n' + fileContent, 'utf8');
        }
    } catch (err) {
        console.error(`Erro ao escrever no arquivo ${filePath}:`, err);
    }
}

async function processFile(filePath) {
    const aiType = getAiType(filePath);

    let stats;
    try {
        stats = fs.statSync(filePath);
    } catch (e) {
        return; 
    }

    const currentSize = stats.size;
    const bytesRead = fileState.get(filePath) || 0;

    if (currentSize <= bytesRead) {
        if (currentSize < bytesRead) fileState.set(filePath, 0);
        return;
    }

    let startRead = bytesRead;
    if (bytesRead === 0 && currentSize > 10 * 1024 * 1024) { 
        startRead = currentSize - (1024 * 1024);
    }

    const stream = fs.createReadStream(filePath, { start: startRead, end: currentSize - 1 });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    let messagesByDate = {};
    for await (const line of rl) {
        const result = parseLine(line, aiType);
        if (result) {
            const { date, text } = result;
            if (!messagesByDate[date]) {
                messagesByDate[date] = [];
            }
            messagesByDate[date].push(text);
        }
    }

    for (const dateStr of Object.keys(messagesByDate)) {
        const list = messagesByDate[dateStr];
        if (list.length > 0) {
            list.reverse();
            const mdBuffer = list.join('\n');
            const mdFileName = `${dateStr}.md`;
            const mdFilePathObsidian = path.join(OBSIDIAN_VAULT, mdFileName);
            const mdFilePathLocal = path.join(LOCAL_VAULT, mdFileName);
            
            writeToSessionFile(mdFilePathObsidian, mdBuffer, dateStr, OBSIDIAN_VAULT);
            writeToSessionFile(mdFilePathLocal, mdBuffer, dateStr, LOCAL_VAULT);
        }
    }

    fileState.set(filePath, currentSize);
}

const ANTIGRAVITY_BASE = 'C:/Users/eojon/.gemini/antigravity-ide/brain';
const COPILOT_BASE = 'C:/Users/eojon/AppData/Roaming/Code/User/workspaceStorage';

console.log('Iniciando AI Session Watcher...');
console.log('Monitorando:');
console.log('-', ANTIGRAVITY_BASE);
console.log('-', COPILOT_BASE);

const watcher = chokidar.watch([ANTIGRAVITY_BASE, COPILOT_BASE], {
    persistent: true,
    ignoreInitial: false,
    ignored: (filePath, stats) => {
        if (filePath.includes('node_modules')) return true;
        if (stats && stats.isFile() && !filePath.endsWith('.jsonl')) return true;
        if (filePath.startsWith(ANTIGRAVITY_BASE) && stats && stats.isFile()) {
            return !filePath.includes('transcript.jsonl');
        }
        if (filePath.startsWith(COPILOT_BASE) && stats && stats.isFile()) {
            return !filePath.includes('GitHub.copilot-chat');
        }
        return false;
    },
    usePolling: false,
    depth: 8
});

watcher
    .on('add', filePath => processFile(filePath))
    .on('change', filePath => processFile(filePath))
    .on('error', error => console.log(`Watcher error: ${error}`));
