function initNavigation() {
    const subsections = document.querySelectorAll('.subsection');
    const contentSections = document.querySelectorAll('.content-section');

    contentSections.forEach(section => {
        if (!section.classList.contains('active')) {
            section.style.opacity = '0';
        }
    });

    subsections.forEach(sub => {
        sub.addEventListener('click', () => {
            const targetId = sub.getAttribute('data-target');
            const current = document.querySelector('.content-section.active');
            
            if (current) {
                current.style.opacity = '0';
                setTimeout(() => {
                    current.classList.remove('active');
                    showContentSection(targetId);
                }, 400);
            } else {
                showContentSection(targetId);
            }
        });
    });
}

function showContentSection(targetId) {
    const target = document.getElementById(targetId);
    if (target) {
        target.classList.add('active');
        setTimeout(() => (target.style.opacity = '1'), 50);
    }
}

function showElement(el) {
    if (!el) return;
    el.style.display = 'block';
    setTimeout(() => (el.style.opacity = '1'), 10);
}

function hideElement(el) {
    if (!el) return;
    el.style.opacity = '0';
    setTimeout(() => (el.style.display = 'none'), 400);
}

function initFileUpload({ uploadArea, fileInput, processButtonContainer, resultsContainer }) {
    let selectedFile = null;

    [processButtonContainer, resultsContainer].forEach(el => {
        if (el) {
            el.style.display = 'none';
            el.style.opacity = '0';
        }
    });

    function handleFileSelection(file) {
        selectedFile = file;
        if (uploadArea) {
            const p = uploadArea.querySelector('p');
            if (p) p.textContent = `Выбран файл: ${file.name}`;
        }
        if (processButtonContainer) showElement(processButtonContainer);
        if (resultsContainer) hideElement(resultsContainer);
    }

    if (uploadArea) {
        uploadArea.addEventListener('click', (e) => {
            if (fileInput && (e.target === uploadArea || e.target.tagName === 'P')) {
                fileInput.click();
            }
        });

        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) handleFileSelection(files[0]);
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) handleFileSelection(e.target.files[0]);
        });
    }

    return {
        getSelectedFile: () => selectedFile,
        showResults: () => showElement(resultsContainer),
        processFile: () => !!selectedFile
    };
}

function processFile(fileManager, processBtn, parseFunction, displayFunction) {
    if (!fileManager.processFile()) {
        alert('Пожалуйста, выберите файл');
        return;
    }

    processBtn.textContent = 'Обработка...';
    processBtn.disabled = true;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const results = parseFunction(e.target.result);
            displayFunction(results);
            fileManager.showResults();
        } catch (err) {
            alert('Ошибка обработки файла. Проверьте формат.');
            console.error(err);
        } finally {
            processBtn.textContent = 'Обработать отчеты';
            processBtn.disabled = false;
        }
    };
    reader.onerror = () => {
        alert('Ошибка чтения файла');
        processBtn.textContent = 'Обработать отчеты';
        processBtn.disabled = false;
    };
    reader.readAsText(fileManager.getSelectedFile());
}

function parsePlayerLine(text, bonusFlags = ['м','к','и']) {
    if (!text) return null;
    const match = text.match(/([^(]+?)\s*\(([^)]+)\)\s*(?:\(([^)]+)\))?/);
    if (!match) return null;
    
    const [, name, id, flags] = match;
    const flagStr = flags ? flags.replace(/\s+/g, '') : '';
    
    return {
        name: name.trim(),
        id: id.trim(),
        flagsStr: flagStr,
        hasBonus: bonusFlags.some(f => flagStr.includes(f)),
        isLeader: flagStr.includes('в')
    };
}

function parseMembersList(text, bonusFlags = ['м','к','и']) {
    if (!text) return [];
    const pureText = text.includes(':') ? text.split(':')[1].trim() : text.trim();
    return pureText
        .split(/\s*,\s*(?![^(]*\))/)
        .map(part => parsePlayerLine(part, bonusFlags))
        .filter(Boolean);
}

function createTableRow(cells, tbody) {
    const tr = document.createElement('tr');
    cells.forEach(cell => {
        const td = document.createElement('td');
        td.textContent = cell.txt;
        if (cell.cls) td.className = cell.cls;
        tr.appendChild(td);
    });
    tbody.appendChild(tr);
}

function formatPoints(points) {
    if (points == null) return '0';
    return (points % 1 === 0) ? points.toFixed(0) : points.toFixed(1);
}

window.Core = {
    initNavigation,
    initFileUpload,
    processFile,
    showElement,
    hideElement,
    parsePlayerLine,
    parseMembersList,
    createTableRow,
    formatPoints
};