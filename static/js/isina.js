document.addEventListener("DOMContentLoaded", () => {
    Core.initNavigation();
    
    const fileManager = Core.initFileUpload({
        uploadArea: document.getElementById("uploadAreaIsina"),
        fileInput: document.getElementById("fileInputIsina"),
        processButtonContainer: document.getElementById("processButtonContainerIsina"),
        resultsContainer: document.getElementById("resultsContainerIsina"),
    });

    document.getElementById("processBtnIsina").addEventListener("click", () => {
        Core.processFile(fileManager, document.getElementById("processBtnIsina"), parseIsinaReports, displayResultsIsina);
    });

    initTableSwitcher();
});

function parseIsinaReports(content) {
    const players = {}, zorchPlayers = {};
    let totalWeb = 0, totalMoss = 0;

    const lines = String(content || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
        try {
            if (/^Собран:/i.test(line)) {
                const parsed = Core.parsePlayerLine(line.split(':')[1] || line, ['и']);
                if (parsed) getOrCreateIsinaPlayer(players, parsed.id, parsed.name, parsed.hasBonus);
                continue;
            }
            
            if (/^Участники:/i.test(line)) {
                const members = Core.parseMembersList(line, ['и']);
                for (const m of members) {
                    const pl = getOrCreateIsinaPlayer(players, m.id, m.name, m.hasBonus);
                    pl.patrolCount = (pl.patrolCount || 0) + 1;
                    pl.points += m.hasBonus ? 10 : 5;
                    
                    const extraMatch = m.flagsStr.match(/\+(\d+)/);
                    if (extraMatch) pl.points += 5 * parseInt(extraMatch[1]);
                }
                continue;
            }
            
            if (/^Количество собранной паутины:/i.test(line)) {
                const m = line.match(/(\d+)/);
                if (m) totalWeb += parseInt(m[1]) || 0;
                continue;
            }

            const watchMatch = line.match(/Дозорный:\s*([^(]+?)\s*\((\d+)\)\s*(?:\(([^)]+)\))?/i);
            if (watchMatch) {
                const hasBonus = watchMatch[3]?.includes('и');
                const pl = getOrCreateIsinaPlayer(players, watchMatch[2].trim(), watchMatch[1].trim(), hasBonus);
                const hours = 0;
                const halfs = Math.floor(hours * 2);
                pl.watchHours = (pl.watchHours || 0) + halfs * 0.5;
                pl.points += halfs * (pl.hasBonus ? 4 : 2);
                continue;
            }

            const miceMatch = line.match(/([^(]+?)\s*\((\d+)\).*?поймал[а]?\s*(\d+)\s*мыш/i);
            if (miceMatch) {
                const pl = getOrCreateIsinaPlayer(players, miceMatch[2].trim(), miceMatch[1].trim());
                const mice = parseInt(miceMatch[3]) || 0;
                pl.miceCount = (pl.miceCount || 0) + mice;
                pl.points += mice;
                continue;
            }

            const bonehealerMatch = line.match(/([^(]+?)\s*\((\d+)\)\s*[–—−-]\s*выдал[а]?\s+костоправ/i);
            if (bonehealerMatch) {
                const pl = getOrCreateIsinaPlayer(players, bonehealerMatch[2].trim(), bonehealerMatch[1].trim());
                pl.bonehealerGiven = (pl.bonehealerGiven || 0) + 1;
                pl.points += 6;
                continue;
            }

            const herbMatch = line.match(/([^(]+?)\s*\((\d+)\)\s*[–—−-]\s*дал[а]?\s+трав/i);
            if (herbMatch) {
                const pl = getOrCreateIsinaPlayer(players, herbMatch[2].trim(), herbMatch[1].trim());
                pl.herbGiven = (pl.herbGiven || 0) + 1;
                pl.points += 8;
                continue;
            }

            const transferMatch = line.match(/([^(]+?)\s*\((\d+)\)\s*(?:\(([^)]+)\))?.*?перенес\s+(\d+)\s*ресурс/i);
            if (transferMatch) {
                const hasBonus = transferMatch[3]?.includes('и');
                const pl = getOrCreateIsinaPlayer(players, transferMatch[2].trim(), transferMatch[1].trim(), hasBonus);
                const resources = parseInt(transferMatch[4]) || 0;
                const mossMatch = line.match(/(?:[\/,]\s*|\b)\s*(\d+)\s*(?:мох|мха|мху|мх[аеиоу])/i);
                const moss = mossMatch ? parseInt(mossMatch[1]) || 0 : 0;
                
                const totalItems = resources + moss;
                pl.transferPV = (pl.transferPV || 0) + totalItems;
                pl.mossCount = (pl.mossCount || 0) + moss;
                totalMoss += moss;
                pl.points += totalItems * (pl.hasBonus ? 2 : 1);
                continue;
            }

            const zMatch = line.match(/^([^(]+?)\s*\((\d+)\)\s*[–—−-]\s*(.+)$/i);
            if (zMatch && !/перенес|перен[её]с/i.test(zMatch[3])) {
                const name = zMatch[1].trim(), id = zMatch[2].trim(), rest = zMatch[3].toLowerCase();
                const zp = getOrCreateZorchPlayer(zorchPlayers, id, name);
                const isp = getOrCreateIsinaPlayer(players, id, name);

                const resTypes = [
                    [/(\d+)\s*(?:паути|паутин|паутины|паутину|паутиной)/gi, "web", 4, "web"],
                    [/(\d+)\s*(?:мох|мха|мху|мх[аеиоу])/gi, "moss", 3, "moss"],
                    [/(\d+)\s*(?:трав|трава|травы|траву)/gi, "herbs", 3],
                    [/(\d+)\s*(?:вьюн|вьюнк|вьюнки|вьюнков|вьюнка)/gi, "vines", 1],
                    [/(\d+)\s*(?:крепк[а-яё]*\s*ветк[а-яё]*|ветк[а-яё]*|ветки|веток)/gi, "branches", 2]
                ];

                for (const [regex, field, points, total] of resTypes) {
                    const matches = [...rest.matchAll(regex)];
                    for (const m of matches) {
                        const count = parseInt(m[1]) || 0;
                        zp[field] += count;
                        isp.points += count * points;
                        if (total === "web") totalWeb += count;
                        if (total === "moss") totalMoss += count;
                    }
                }

                if (zp.web || zp.moss || zp.herbs || zp.vines || zp.branches) {
                    zorchPlayers[id] = zp;
                    players[id] = isp;
                }
            }
        } catch (err) {
            console.error('Ошибка при парсинге строки:', line, err);
        }
    }

    const isinaResults = Object.values(players).map(p => ({
        name: p.name, id: p.id, hasBonus: p.hasBonus || false,
        points: Math.round((p.points || 0) * 100) / 100,
        patrolCount: p.patrolCount || 0, watchHours: Math.round((p.watchHours || 0) * 10) / 10,
        transferPV: p.transferPV || 0, miceCount: p.miceCount || 0,
        bonehealerGiven: p.bonehealerGiven || 0, herbGiven: p.herbGiven || 0, mossCount: p.mossCount || 0
    })).sort((a,b) => b.points - a.points);

    const zorchList = Object.values(zorchPlayers).filter(z => z.web || z.moss || z.herbs || z.vines || z.branches)
        .sort((a,b) => (b.web*4 + b.moss*3 + b.herbs*3 + b.branches*2 + b.vines*1) - (a.web*4 + a.moss*3 + a.herbs*3 + a.branches*2 + a.vines*1));

    return { isinaResults, zorchList, totalWeb, totalMoss };
}

function getOrCreateZorchPlayer(map, id, name) {
    if (!map[id]) map[id] = { id, name, web: 0, moss: 0, herbs: 0, vines: 0, branches: 0 };
    return map[id];
}

function getOrCreateIsinaPlayer(map, id, name, hasBonus = false) {
    if (!map[id]) {
        map[id] = { name, id, hasBonus: !!hasBonus, points: 0, patrolCount: 0, watchHours: 0, 
                   transferPV: 0, miceCount: 0, bonehealerGiven: 0, herbGiven: 0, mossCount: 0 };
    } else if (hasBonus) map[id].hasBonus = true;
    return map[id];
}

function initTableSwitcher() {
    const switcher = document.getElementById('tableSwitcherIsina');
    if (!switcher) return;
    
    switcher.addEventListener('click', (e) => {
        const btn = e.target.closest('.table-switch-btn');
        if (!btn) return;
        
        switcher.querySelectorAll('.table-switch-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('#resultsContainerIsina .table-container').forEach(c => {
            c.style.display = 'none';
            c.style.opacity = '0';
        });
        
        const targetId = btn.dataset.table === 'general' ? 'generalTableIsina' : 'zorchTableIsina';
        const target = document.getElementById(targetId);
        if (target) {
            target.style.display = 'block';
            setTimeout(() => target.style.opacity = '1', 10);
        }
        
        if (window.currentIsinaRaw) {
            if (btn.dataset.table === 'general') displayGeneralTableIsina(window.currentIsinaRaw);
            else displayZorchTableIsina(window.currentIsinaRaw);
        }
    });
}

function displayResultsIsina(parsed) {
    if (!parsed) return;
    const container = document.getElementById('resultsContainerIsina');
    if (!container) return;
    
    window.currentIsinaRaw = parsed;
    Core.showElement(document.getElementById('tableSwitcherIsina'));
    
    // учет запасов
    const webInfo = document.getElementById('webInfoIsina');
    if (webInfo) {
        webInfo.innerHTML = `Паутина: <span style="color:#50ff99;">${parsed.totalWeb||0}</span>; мох: <span style="color:#50ff99;">${parsed.totalMoss||0}</span>`;
        webInfo.style.display = 'block';
        webInfo.style.opacity = '1';
    }
    
    document.querySelectorAll('#resultsContainerIsina .table-container').forEach(c => {
        c.style.display = 'none';
        c.style.opacity = '0';
    });
    
    Core.showElement(container);
    setTimeout(() => container.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
}

function displayGeneralTableIsina(parsed) {
    if (!parsed) return;
    const tbody = document.getElementById('resultsBodyIsina');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    for (const p of parsed.isinaResults || []) {
        const cells = [
            { txt: p.name, cls: p.hasBonus ? 'underlined-name' : '' },
            { txt: p.id },
            { txt: Core.formatPoints(p.points), cls: 'points-column points-divider' },
            { txt: p.patrolCount || 0 },
            { txt: Core.formatPoints(p.watchHours) },
            { txt: p.transferPV || 0 },
            { txt: p.miceCount || 0, cls: 'divider' },
            { txt: p.bonehealerGiven || 0 },
            { txt: p.herbGiven || 0 }
        ];
        Core.createTableRow(cells, tbody);
    }
    
    const table = document.getElementById('generalTableIsina');
    if (table) {
        table.style.display = 'block';
        setTimeout(() => table.style.opacity = '1', 10);
    }
}

function displayZorchTableIsina(parsed) {
    if (!parsed) return;
    const tbody = document.getElementById('resultsBodyZorch');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    for (const p of parsed.zorchList || []) {
        const cells = [
            { txt: p.name },
            { txt: p.id },
            { txt: p.web || 0 },
            { txt: (p.moss || 0) + (p.herbs || 0) + (p.vines || 0) + (p.branches || 0) },
            { txt: p.moss || 0 },
            { txt: p.herbs || 0 },
            { txt: p.vines || 0 },
            { txt: p.branches || 0 }
        ];
        Core.createTableRow(cells, tbody);
    }
    
    const table = document.getElementById('zorchTableIsina');
    if (table) {
        table.style.display = 'block';
        setTimeout(() => table.style.opacity = '1', 10);
    }
}