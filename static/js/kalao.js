document.addEventListener("DOMContentLoaded", () => {
    Core.initNavigation();
    
    const fileManager = Core.initFileUpload({
        uploadArea: document.getElementById("uploadAreaKalao"),
        fileInput: document.getElementById("fileInputKalao"),
        processButtonContainer: document.getElementById("processButtonContainerKalao"),
        resultsContainer: document.getElementById("resultsContainerKalao"),
    });

    document.getElementById("processBtnKalao").addEventListener("click", () => {
        Core.processFile(fileManager, document.getElementById("processBtnKalao"), parseKalaoReports, displayResultsKalao);
    });
});

function parseKalaoReports(content) {
    const players = {};
    const reports = content.split(/\n\s*\n/);

    for (let block of reports) {
        const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) continue;

        const hasCollector = lines.some(l => l.startsWith('Собрал:'));
        const hasHunters = lines.some(l => l.startsWith('Охотники:'));
        const hasCleaner = lines.some(l => l.startsWith('Почистил кучу:'));
        const hasTransport = lines.some(l => l.startsWith('Участники:')) && lines.some(m => m.startsWith('Количество перенесенной дичи:'));

        if (hasCollector) processKalaoPatrolHunt(lines, players);
        else if (hasHunters) processKalaoFreeHunt(lines, players);
        else if (hasCleaner) processKalaoCleaning(lines, players);
        else if (hasTransport) processKalaoTransport(lines, players);
    }

    return Object.values(players).sort((a, b) => b.points - a.points);
}

function processKalaoPatrolHunt(lines, players) {
    const collectorLine = lines.find(l => l.startsWith('Собрал:'));
    const leadersLine = lines.find(l => l.startsWith('Ведущие:'));
    const huntersLine = lines.find(l => l.startsWith('Охотники:'));
    const carriersLine = lines.find(l => l.startsWith('Носильщики:'));

    if (collectorLine) {
        const coll = Core.parsePlayerLine(collectorLine.split(':')[1] || collectorLine, ['к']);
        if (coll) {
            const player = getOrCreateKalaoPlayer(players, coll.id, coll.name, coll.hasBonus);
            player.collectedCount += 1;
            player.points += 3;
        }
    }

    if (leadersLine) {
        const leads = Core.parseMembersList(leadersLine, ['к']);
        for (const lead of leads) {
            const player = getOrCreateKalaoPlayer(players, lead.id, lead.name, lead.hasBonus);
            player.leadershipCount += 1;
            player.points += 2;
        }
    }

    const hunters = huntersLine ? Core.parseMembersList(huntersLine, ['к']) : [];
    const carriers = carriersLine ? extractCarriersFromLine(carriersLine) : [];

    const allParticipants = new Map();
    for (const h of hunters) allParticipants.set(h.id, h);
    for (const c of carriers) {
        if (allParticipants.has(c.id)) {
            allParticipants.get(c.id).amount = (allParticipants.get(c.id).amount || 0) + c.amount;
        } else {
            allParticipants.set(c.id, c);
        }
    }

    for (const [id, playerData] of allParticipants.entries()) {
        const player = getOrCreateKalaoPlayer(players, id, playerData.name, playerData.hasBonus);
        player.participationCount += 1;
        player.points += playerData.hasBonus ? 10 : 5;
        if (playerData.amount) {
            player.carryCount += playerData.amount;
            player.points += Math.floor(playerData.amount / 2);
        }
    }
}

function processKalaoFreeHunt(lines, players) {
    const huntersLine = lines.find(l => l.startsWith('Охотники:') && !l.match(/[:]\s*[-–]/));
    const carriersLine = lines.find(l => l.startsWith('Носильщики:') && !l.match(/[:]\s*[-–]/));

    if (huntersLine) {
        const hunters = extractCarriersFromLine(huntersLine);
        for (const h of hunters) {
            const player = getOrCreateKalaoPlayer(players, h.id, h.name, h.hasBonus);
            player.freeHuntCount += h.amount;
            player.points += (h.amount * (h.hasBonus ? 5 : 2.5)) / 2;
        }
    }

    if (carriersLine) {
        const carriers = extractCarriersFromLine(carriersLine);
        for (const c of carriers) {
            const player = getOrCreateKalaoPlayer(players, c.id, c.name, c.hasBonus);
            player.freeCarryCount += c.amount;
            player.points += c.amount;
        }
    }
}

function processKalaoCleaning(lines, players) {
    const cleanerLine = lines.find(l => l.startsWith('Почистил кучу:'));
    const amountLine = lines.find(l => l.startsWith('Количество падали:'));
    if (!cleanerLine || !amountLine) return;

    const cleaner = Core.parsePlayerLine(cleanerLine.split(':')[1] || cleanerLine, ['к']);
    const amountMatch = amountLine.match(/(\d+)/);
    const amount = amountMatch ? parseInt(amountMatch[1]) : 0;

    const player = getOrCreateKalaoPlayer(players, cleaner.id, cleaner.name, cleaner.hasBonus);
    player.cleanCount += amount;
    player.points += (amount * 3) / 5;
}

function processKalaoTransport(lines, players) {
    const participantsLine = lines.find(l => l.startsWith('Участники:'));
    const amountLine = lines.find(l => l.startsWith('Количество перенесенной дичи:'));
    if (!participantsLine || !amountLine) return;

    const participants = Core.parseMembersList(participantsLine, ['к']);
    const amounts = Array.from(amountLine.matchAll(/(\d+)/g)).map(m => parseInt(m[1]));
    const totalAmount = amounts.length ? amounts.reduce((a, b) => a + b, 0) : 0;

    for (const playerData of participants) {
        const player = getOrCreateKalaoPlayer(players, playerData.id, playerData.name, playerData.hasBonus);
        player.transportCount += totalAmount;
        player.points += totalAmount;
    }
}

function extractCarriersFromLine(line) {
    if (!line) return [];
    const text = line.includes(':') ? line.split(':')[1].trim() : line.trim();
    if (!text) return [];
    
    return text.split(/\s*,\s*/)
        .map(p => {
            const match = p.match(/(.+?)\s*\((\d+)\)\s*(?:\((к)\))?\s*[-–]\s*(\d+)/i);
            if (!match) return null;
            
            const playerData = Core.parsePlayerLine(`${match[1].trim()} (${match[2].trim()})${match[3] ? ` (${match[3]})` : ''}`, ['к']);
            return playerData ? {
                name: playerData.name,
                id: playerData.id,
                hasBonus: playerData.hasBonus,
                amount: parseInt(match[4])
            } : null;
        })
        .filter(Boolean);
}

function getOrCreateKalaoPlayer(players, id, name, hasBonus = false) {
    if (!players[id]) {
        players[id] = {
            name, id, hasBonus: !!hasBonus, points: 0,
            participationCount: 0, leadershipCount: 0, collectedCount: 0,
            carryCount: 0, freeHuntCount: 0, freeCarryCount: 0,
            cleanCount: 0, transportCount: 0
        };
    } else {
        players[id].name = players[id].name || name;
        if (!players[id].hasBonus && hasBonus) players[id].hasBonus = true;
    }
    return players[id];
}

function displayResultsKalao(results) {
    const tbody = document.getElementById('resultsBodyKalao');
    const container = document.getElementById('resultsContainerKalao');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    for (const r of results) {
        const cells = [
            { txt: r.name, cls: r.hasBonus ? 'underlined-name' : '' },
            { txt: r.id },
            { txt: Core.formatPoints(r.points), cls: 'points-divider points-column' },
            { txt: r.participationCount || 0 },
            { txt: r.leadershipCount || 0 },
            { txt: r.collectedCount || 0 },
            { txt: r.carryCount || 0, cls: 'divider' },
            { txt: r.freeHuntCount || 0 },
            { txt: r.freeCarryCount || 0, cls: 'divider' },
            { txt: r.cleanCount || 0 },
            { txt: r.transportCount || 0 }
        ];
        Core.createTableRow(cells, tbody);
    }

    if (container) Core.showElement(container);
}