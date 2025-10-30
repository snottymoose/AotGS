document.addEventListener('DOMContentLoaded', () => {
    if (window.Core && typeof window.Core.initNavigation === 'function') {
        window.Core.initNavigation();
    }

    if (window.parseMaruReports && window.displayResultsMaru) {
        window.Core.initSection('Maru', window.parseMaruReports, window.displayResultsMaru);
    }
    if (window.parseKalaoReports && window.displayResultsKalao) {
        window.Core.initSection('Kalao', window.parseKalaoReports, window.displayResultsKalao);
    }
    if (window.parseIsinaReports && window.displayResultsIsina) {
        window.Core.initSection('Isina', window.parseIsinaReports, window.displayResultsIsina);
    }
});
