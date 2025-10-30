document.addEventListener("DOMContentLoaded", () => {
    Core.initNavigation();
    
    const fileManager = Core.initFileUpload({
        uploadArea: document.getElementById("uploadAreaMaru"),
        fileInput: document.getElementById("fileInputMaru"),
        processButtonContainer: document.getElementById("processButtonContainerMaru"),
        resultsContainer: document.getElementById("resultsContainerMaru"),
    });

    document.getElementById("processBtnMaru").addEventListener("click", () => {
        Core.processFile(fileManager, document.getElementById("processBtnMaru"), parseMaruReports, displayResultsMaru);
    });
});

function parseMaruReports(content) {
    const players = {};
    const rawBlocks = content.split(/\n\s*\n/);
    
    for (const raw of rawBlocks) {
        const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length === 0) continue;

        const isPatrol = lines.some(l => /^Собран|^Состав патруля/i.test(l));
        const isWatch = lines.some(l => /^Дозорный|^Вид дозора/i.test(l)) || /\(\d+[\.,]?\d*\)/.test(lines[0]);
        const isDuty  = lines.some(l => /^Дежурный|^Вид дежурства/i.test(l));

        if (isPatrol) processMaruPatrolBlock(lines, players);
        else if (isWatch) processMaruWatchBlock(lines, players);
        else if (isDuty) processMaruDutyBlock(lines, players);
    }

    return Object.values(players).map(p => ({
        name: p.name, id: p.id, hasBonus: p.hasBonus || false,
        patrolPoints: Math.round(p.patrolPoints || 0),
        watchPoints: Math.round((p.watchPoints || 0) * 100) / 100,
        patrols: p.patrolCount || 0,
        leadershipCount: p.leadershipCount || 0,
        gatheredCount: p.gatheredCount || 0,
        watchHours: p.watchHours || 0,
        passiveWatches: p.passiveWatches || 0,
        activeWatches: p.activeWatches || 0,
        passiveDuties: p.passiveDuties || 0,
        activeDuties: p.activeDuties || 0,
        totalPoints: (p.patrolPoints || 0) + (p.watchPoints || 0)
    })).sort((a, b) => b.totalPoints - a.totalPoints);
}

function processMaruPatrolBlock(lines, players) {
    const gatheredLine = lines.find(l => /^Собран/i.test(l));
    const membersLine  = lines.find(l => /^Состав патруля/i.test(l));

    if (gatheredLine) {
        const g = Core.parsePlayerLine(gatheredLine.split(':')[1] || gatheredLine, ['м']);
        if (g) {
            const pl = getOrCreateMaruPlayer(players, g.id, g.name, g.hasBonus);
            pl.gatheredCount = (pl.gatheredCount || 0) + 1;
            pl.patrolPoints = (pl.patrolPoints || 0) + 2;
        }
    }

    if (membersLine) {
        const members = Core.parseMembersList(membersLine, ['м']);
        for (const m of members) {
            if (!m) continue;
            const pl = getOrCreateMaruPlayer(players, m.id, m.name, m.hasBonus);
            pl.patrolCount = (pl.patrolCount || 0) + 1;
            pl.patrolPoints = (pl.patrolPoints || 0) + (m.hasBonus ? 10 : 5);
            if (m.isLeader) {
                pl.leadershipCount = (pl.leadershipCount || 0) + 1;
                pl.patrolPoints = (pl.patrolPoints || 0) + 1;
            }
        }
    }
}

function processMaruWatchBlock(lines, players) {
    const sentryLine = lines.find(l => /^Дозорный[:]?/i.test(l));
    const typeLine = lines.find(l => /^Вид дозора[:]?/i.test(l));
    const firstLine = lines[0] || '';
    let hours = 0;

    const hoursMatch = firstLine.match(/\((\d+[\.,]?\d*)\)/);
    if (hoursMatch) {
        hours = parseFloat(hoursMatch[1].replace(',', '.'));
    } else {
        const hm = firstLine.match(/(\d+)\s*час/);
        const mm = firstLine.match(/(\d+)\s*мин/);
        const h = hm ? parseInt(hm[1]) : 0;
        const m = mm ? parseInt(mm[1]) : 0;
        hours = h + Math.floor(m / 30) * 0.5;
    }

    if (!sentryLine) return;
    const s = Core.parsePlayerLine(sentryLine.split(':')[1] || sentryLine, ['м']);
    if (!s) return;

    const pl = getOrCreateMaruPlayer(players, s.id, s.name, s.hasBonus);
    const halfCount = Math.floor(hours * 2);
    const hoursRounded = halfCount * 0.5;
    pl.watchHours = (pl.watchHours || 0) + hoursRounded;

    const typeText = typeLine ? (typeLine.split(':')[1] || typeLine).toLowerCase() : '';
    const isActive = typeText.includes('актив');
    const perHalf = isActive ? (pl.hasBonus ? 7 : 3.5) : (pl.hasBonus ? 5 : 2.5);
    
    pl.watchPoints = (pl.watchPoints || 0) + halfCount * perHalf;
    if (isActive) pl.activeWatches = (pl.activeWatches || 0) + hoursRounded;
    else pl.passiveWatches = (pl.passiveWatches || 0) + hoursRounded;
}

function processMaruDutyBlock(lines, players) {
    const dutyLine = lines.find(l => /^Дежурный[:]?/i.test(l));
    const typeLine = lines.find(l => /^Вид дежурства[:]?/i.test(l));
    if (!dutyLine) return;

    const d = Core.parsePlayerLine(dutyLine.split(':')[1] || dutyLine, ['м']);
    if (!d) return;
    
    const pl = getOrCreateMaruPlayer(players, d.id, d.name, d.hasBonus);
    const typeText = typeLine ? (typeLine.split(':')[1] || typeLine).toLowerCase() : '';
    const isActive = typeText.includes('актив');
    const pts = isActive ? (pl.hasBonus ? 10 : 5) : (pl.hasBonus ? 8 : 4);
    
    pl.watchPoints = (pl.watchPoints || 0) + pts;
    if (isActive) pl.activeDuties = (pl.activeDuties || 0) + 1;
    else pl.passiveDuties = (pl.passiveDuties || 0) + 1;
}

function getOrCreateMaruPlayer(players, id, name, hasBonus = false) {
    if (!players[id]) {
        players[id] = {
            id, name, hasBonus: !!hasBonus,
            patrolPoints: 0, patrolCount: 0, leadershipCount: 0, gatheredCount: 0,
            watchPoints: 0, watchHours: 0, passiveWatches: 0, activeWatches: 0,
            passiveDuties: 0, activeDuties: 0
        };
    }
    if (hasBonus) players[id].hasBonus = true;
    return players[id];
}

function displayResultsMaru(results) {
    const tbody = document.getElementById('resultsBodyMaru');
    const container = document.getElementById('resultsContainerMaru');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!results || results.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center">Не найдено отчетов для обработки</td></tr>';
        if (container) Core.showElement(container);
        return;
    }

    for (const player of results) {
        const cells = [
            { txt: player.name, cls: player.hasBonus ? 'underlined-name' : '' },
            { txt: player.id },
            { txt: Core.formatPoints(player.patrolPoints), cls: 'points-column points-divider' },
            { txt: player.patrols || 0 },
            { txt: player.leadershipCount || 0 },
            { txt: player.gatheredCount || 0 },
            { txt: Core.formatPoints(player.watchPoints), cls: 'points-column points-divider' },
            { txt: player.passiveWatches || 0 },
            { txt: player.activeWatches || 0 },
            { txt: player.passiveDuties || 0 },
            { txt: player.activeDuties || 0 }
        ];
        Core.createTableRow(cells, tbody);
    }

    if (container) Core.showElement(container);
}