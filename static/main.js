// Register ChartDataLabels plugin globally
Chart.register(ChartDataLabels);

// Global state to store charts
let blocksChartInstance = null;
let areasChartInstance = null;
let historyChartInstance = null;

// Day of week mapping in Spanish
const DAYS_OF_WEEK = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function getDayName(dateStr) {
    if (!dateStr) return '';
    // YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        return DAYS_OF_WEEK[d.getDay()];
    }
    // DD/MM/YYYY
    const slashParts = dateStr.split('/');
    if (slashParts.length === 3) {
        const d = new Date(parseInt(slashParts[2]), parseInt(slashParts[1]) - 1, parseInt(slashParts[0]));
        return DAYS_OF_WEEK[d.getDay()];
    }
    return dateStr;
}

// Helper to determine compliance color class
function getComplianceClass(val) {
    if (val === 0 || val === "-") return 'red';
    // Margen de error es minimo 95% maximo 110%
    if (val >= 95 && val <= 110) return 'green';
    if (val >= 90 && val < 95) return 'orange';
    return 'red';
}

// Helper to format numbers with commas
function formatNum(val) {
    if (val === null || val === undefined || isNaN(val)) return "-";
    if (val === 0) return "-";
    return Math.round(val).toLocaleString('es-CO');
}

function formatPercent(val) {
    if (val === null || val === undefined || isNaN(val)) return "-%";
    return `${val}%`;
}

// Main initializer
document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    initUploadZone();
    initTabs();
    
    // Bind filter change events
    document.getElementById('semana-select').addEventListener('change', () => {
        loadReport();
        loadAnomalies();
    });
    document.getElementById('flor-select').addEventListener('change', handleFlorChange);
    document.getElementById('variedad-select').addEventListener('change', () => {
        loadReport();
        loadHistory();
        loadAnomalies();
    });
    document.getElementById('bloque-select').addEventListener('change', () => {
        loadReport();
        loadHistory();
        loadAnomalies();
    });
});

// Setup tab switches
function initTabs() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            
            btn.classList.add('active');
            
            const targetId = btn.dataset.tab;
            const targetPane = document.getElementById(targetId);
            if (targetPane) {
                targetPane.classList.add('active');
            }
            
            if (targetId === 'tab-history') {
                loadHistory();
            } else if (targetId === 'tab-deviations') {
                loadAnomalies();
            }
        });
    });
}

// When flor changes, update varieties & blocks select, then load data
async function handleFlorChange() {
    const flor = document.getElementById('flor-select').value;
    if (!flor) return;
    
    await updateVarietiesSelect(flor);
    await updateBlocksSelect(flor);
    loadReport();
    loadHistory();
    loadAnomalies();
}

// Load varieties from API
async function updateVarietiesSelect(flor, selectedVariedad = 'todas') {
    const variedadSelect = document.getElementById('variedad-select');
    variedadSelect.innerHTML = '<option value="todas">Cargando...</option>';
    
    try {
        const response = await fetch(`/api/variedades?flor=${flor}`);
        const data = await response.json();
        
        variedadSelect.innerHTML = '<option value="todas">Todas las variedades</option>';
        if (data.variedades && data.variedades.length > 0) {
            data.variedades.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                variedadSelect.appendChild(opt);
            });
            if (selectedVariedad && (selectedVariedad === 'todas' || data.variedades.includes(selectedVariedad))) {
                variedadSelect.value = selectedVariedad;
            }
        }
    } catch (e) {
        console.error("Error fetching varieties:", e);
        variedadSelect.innerHTML = '<option value="todas">Todas las variedades</option>';
    }
}

// Load blocks dynamically from API
async function updateBlocksSelect(flor, selectedBloque = 'todos') {
    const bloqueSelect = document.getElementById('bloque-select');
    bloqueSelect.innerHTML = '<option value="todos">Cargando...</option>';
    
    try {
        const response = await fetch(`/api/bloques?flor=${flor}`);
        const data = await response.json();
        
        bloqueSelect.innerHTML = '<option value="todos">Todos los bloques</option>';
        if (data.bloques && data.bloques.length > 0) {
            data.bloques.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b;
                
                let displayBlock = b;
                if (/^\d+$/.test(displayBlock) && displayBlock.length === 1) {
                    displayBlock = `0${displayBlock}`;
                }
                opt.textContent = displayBlock;
                bloqueSelect.appendChild(opt);
            });
            if (selectedBloque && (selectedBloque === 'todos' || data.bloques.includes(selectedBloque))) {
                bloqueSelect.value = selectedBloque;
            }
        }
    } catch (e) {
        console.error("Error fetching blocks:", e);
        bloqueSelect.innerHTML = '<option value="todos">Todos los bloques</option>';
    }
}

// Load the weeks and flowers for filters
async function initFilters(selectedSemana = null, selectedFlor = null, selectedVariedad = 'todas', selectedBloque = 'todos') {
    try {
        const response = await fetch('/api/data');
        const data = await response.json();
        
        const semanaSelect = document.getElementById('semana-select');
        const florSelect = document.getElementById('flor-select');
        
        // Preserve current selections if possible
        const prevSemana = selectedSemana || semanaSelect.value;
        const prevFlor = selectedFlor || florSelect.value;
        
        // Clear
        semanaSelect.innerHTML = '';
        florSelect.innerHTML = '';
        
        if (data.semanas && data.semanas.length > 0) {
            data.semanas.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                semanaSelect.appendChild(opt);
            });
            if (prevSemana && data.semanas.includes(parseInt(prevSemana))) {
                semanaSelect.value = prevSemana;
            }
        } else {
            semanaSelect.innerHTML = '<option value="">Sin datos</option>';
        }
        
        if (data.flores && data.flores.length > 0) {
            data.flores.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f;
                opt.textContent = f.charAt(0).toUpperCase() + f.slice(1);
                florSelect.appendChild(opt);
            });
            if (prevFlor && data.flores.includes(prevFlor)) {
                florSelect.value = prevFlor;
            }
        } else {
            florSelect.innerHTML = '<option value="">Sin datos</option>';
        }
        
        // Update varieties and blocks
        const currentFlor = florSelect.value;
        if (currentFlor) {
            await updateVarietiesSelect(currentFlor, selectedVariedad);
            await updateBlocksSelect(currentFlor, selectedBloque);
        }
        
        // Initial load
        loadReport();
        loadAnomalies();
    } catch (e) {
        console.error("Error loading filters:", e);
    }
}

// Fetch report data and render dashboard
async function loadReport() {
    const semana = document.getElementById('semana-select').value;
    const flor = document.getElementById('flor-select').value;
    const variedad = document.getElementById('variedad-select').value;
    const bloque = document.getElementById('bloque-select').value;
    
    if (!semana || !flor) {
        return;
    }
    
    try {
        const response = await fetch(`/api/report?semana=${semana}&flor=${flor}&variedad=${variedad}&bloque=${bloque}`);
        const data = await response.json();
        
        if (data.error) {
            alert("Error al cargar reporte: " + data.error);
            return;
        }
        
        updateStatsSummary(data.totals);
        renderDetailTable(data.detail, data.totals);
        renderAcumuladoTable(data.acumulado, data.totals);
        renderAreasTable(data.areas);
        renderCharts(data.acumulado, data.areas);
    } catch (e) {
        console.error("Error fetching report:", e);
    }
}

function updateStatsSummary(totals) {
    const pilotosEl = document.getElementById('stat-pilotos');
    const recepcionEl = document.getElementById('stat-recepcion');
    const cumplimientoEl = document.getElementById('stat-cumplimiento');
    
    if (pilotosEl) pilotosEl.textContent = formatNum(totals.pilotos);
    if (recepcionEl) recepcionEl.textContent = formatNum(totals.recepcion);
    if (cumplimientoEl) cumplimientoEl.textContent = formatPercent(totals.cumplimiento);
    
    const efectividadEl = document.getElementById('stat-efectividad');
    const efectividadDescEl = document.getElementById('stat-efectividad-desc');
    
    if (efectividadEl && efectividadDescEl) {
        if (totals.efectividad_bloques !== undefined) {
            efectividadEl.textContent = `${totals.efectividad_bloques}%`;
            efectividadDescEl.textContent = `${totals.bloques_cumplidos} de ${totals.total_bloques} bloques cumplieron`;
        } else {
            efectividadEl.textContent = "-";
            efectividadDescEl.textContent = "Sin datos de efectividad";
        }
    }
}

// Render the left-hand detailed table with expandable days
function renderDetailTable(detailRows, totals) {
    const body = document.getElementById('detail-table-body');
    body.innerHTML = '';
    
    if (!detailRows || detailRows.length === 0) {
        body.innerHTML = '<tr><td colspan="5" class="empty-state">No hay registros para este filtro</td></tr>';
        return;
    }
    
    // Group by Date in JS
    const groups = {};
    detailRows.forEach(row => {
        // Skip row if both cpc (pilotos) and recepcion are 0 or empty
        const cpcVal = row.cpc || 0;
        const recepVal = row.recepcion || 0;
        if (cpcVal === 0 && recepVal === 0) {
            return;
        }
        
        const date = row.fecha;
        if (!groups[date]) {
            groups[date] = {
                rows: [],
                cpc_sum: 0,
                recepcion_sum: 0,
                diff_sum: 0
            };
        }
        groups[date].rows.push(row);
        groups[date].cpc_sum += row.cpc;
        groups[date].recepcion_sum += row.recepcion;
        groups[date].diff_sum += row.cpc_reception_diff;
    });
    
    let dateIndex = 0;
    
    // Output group header and block rows
    for (const date in groups) {
        const group = groups[date];
        const compliance = group.recepcion_sum > 0 ? Math.round((group.cpc_sum / group.recepcion_sum) * 100) : 0;
        
        const groupId = `date-group-${dateIndex++}`;
        
        // Date Group Header Row - Shows Day name instead of YYYY-MM-DD date string
        const headerRow = document.createElement('tr');
        headerRow.className = 'date-group';
        headerRow.dataset.target = groupId;
        
        const dayName = getDayName(date);
        
        headerRow.innerHTML = `
            <td><i class="fa-solid fa-chevron-down"></i>${dayName}</td>
            <td style="text-align: right;">${formatNum(group.cpc_sum)}</td>
            <td style="text-align: right;">${formatNum(group.recepcion_sum)}</td>
            <td style="text-align: right;">${formatNum(group.diff_sum)}</td>
            <td style="text-align: right;"><span class="cell-comp ${getComplianceClass(compliance)}">${formatPercent(compliance)}</span></td>
        `;
        
        // Toggle action
        headerRow.addEventListener('click', () => {
            headerRow.classList.toggle('collapsed');
            const targetRows = document.querySelectorAll(` tr.${groupId}`);
            targetRows.forEach(tr => tr.classList.toggle('hidden'));
        });
        
        body.appendChild(headerRow);
        
        // Block Rows under this date
        group.rows.forEach(r => {
            const blockRow = document.createElement('tr');
            blockRow.className = `block-row ${groupId}`;
            const blockComp = r.recepcion > 0 ? Math.round((r.cpc / r.recepcion) * 100) : 0;
            
            let displayBlock = r.bloque;
            if (/^\d+$/.test(displayBlock) && displayBlock.length === 1) {
                displayBlock = `0${displayBlock}`;
            }
            
            blockRow.innerHTML = `
                <td>${displayBlock}</td>
                <td style="text-align: right; color: var(--text-muted);">${formatNum(r.cpc)}</td>
                <td style="text-align: right; color: var(--text-muted);">${formatNum(r.recepcion)}</td>
                <td style="text-align: right; color: var(--text-muted);">${formatNum(r.cpc_reception_diff)}</td>
                <td style="text-align: right;"><span class="cell-comp ${getComplianceClass(blockComp)}">${formatPercent(blockComp)}</span></td>
            `;
            body.appendChild(blockRow);
        });
    }
    
    // Grand Total Row
    const grandRow = document.createElement('tr');
    grandRow.className = 'total-general-row';
    grandRow.innerHTML = `
        <td>Total general</td>
        <td style="text-align: right;">${formatNum(totals.pilotos)}</td>
        <td style="text-align: right;">${formatNum(totals.recepcion)}</td>
        <td style="text-align: right;">${formatNum(totals.pilotos - totals.recepcion)}</td>
        <td style="text-align: right;"><span class="cell-comp ${getComplianceClass(totals.cumplimiento)}">${formatPercent(totals.cumplimiento)}</span></td>
    `;
    body.appendChild(grandRow);
}

// Render the middle-panel block accumulated table & PWA badges list
function renderAcumuladoTable(acumRows, totals) {
    const body = document.getElementById('acumulado-table-body');
    body.innerHTML = '';
    
    const compliantContainer = document.getElementById('blocks-compliant-list');
    const failedContainer = document.getElementById('blocks-failed-list');
    
    if (compliantContainer) compliantContainer.innerHTML = '';
    if (failedContainer) failedContainer.innerHTML = '';
    
    if (!acumRows || acumRows.length === 0) {
        body.innerHTML = '<tr><td colspan="4" class="empty-state">Sin datos</td></tr>';
        if (compliantContainer) compliantContainer.innerHTML = '<span style="color:var(--text-muted); font-style:italic; font-size:0.8rem;">Ninguno</span>';
        if (failedContainer) failedContainer.innerHTML = '<span style="color:var(--text-muted); font-style:italic; font-size:0.8rem;">Ninguno</span>';
        return;
    }
    
    let greenCount = 0;
    let redCount = 0;
    
    acumRows.forEach(r => {
        const tr = document.createElement('tr');
        
        let displayBlock = r.bloque;
        if (/^\d+$/.test(displayBlock) && displayBlock.length === 1) {
            displayBlock = `0${displayBlock}`;
        }
        
        tr.innerHTML = `
            <td>${displayBlock}</td>
            <td style="text-align: right;">${formatNum(r.pilotos)}</td>
            <td style="text-align: right;">${formatNum(r.recepcion)}</td>
            <td style="text-align: right;"><span class="cell-comp ${getComplianceClass(r.cumplimiento)}">${formatPercent(r.cumplimiento)}</span></td>
        `;
        body.appendChild(tr);
        
        // Render badges
        const badge = document.createElement('span');
        const isCompliant = r.cumplimiento >= 95 && r.cumplimiento <= 110;
        badge.className = `block-badge ${isCompliant ? 'green' : 'red'}`;
        badge.innerHTML = `<i class="fa-solid ${isCompliant ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i> Bloque ${displayBlock} (${r.cumplimiento}%)`;
        
        if (isCompliant) {
            greenCount++;
            if (compliantContainer) {
                compliantContainer.appendChild(badge);
            }
        } else {
            redCount++;
            if (failedContainer) {
                failedContainer.appendChild(badge);
            }
        }
    });
    
    if (greenCount === 0 && compliantContainer) {
        compliantContainer.innerHTML = '<span style="color:var(--text-muted); font-style:italic; font-size:0.8rem;">Ninguno</span>';
    }
    if (redCount === 0 && failedContainer) {
        failedContainer.innerHTML = '<span style="color:var(--text-muted); font-style:italic; font-size:0.8rem;">Ninguno</span>';
    }
    
    // Calculate block effectiveness
    const totalBlocks = acumRows.length;
    const blockCompPercent = totalBlocks > 0 ? Math.round((greenCount / totalBlocks) * 100) : 0;
    
    const blockPercentEl = document.getElementById('comp-summary-bloq-percent');
    const blockDescEl = document.getElementById('comp-summary-bloq-desc');
    
    if (blockPercentEl) {
        blockPercentEl.textContent = `${blockCompPercent}%`;
    }
    if (blockDescEl) {
        blockDescEl.textContent = `${greenCount} de ${totalBlocks} bloques cumplieron`;
    }
    
    // Total Row
    const totalTr = document.createElement('tr');
    totalTr.style.fontWeight = 'bold';
    totalTr.style.background = 'rgba(0, 0, 0, 0.02)';
    totalTr.innerHTML = `
        <td>TOTAL</td>
        <td style="text-align: right;">${formatNum(totals.pilotos)}</td>
        <td style="text-align: right;">${formatNum(totals.recepcion)}</td>
        <td style="text-align: right;"><span class="cell-comp ${getComplianceClass(totals.cumplimiento)}">${formatPercent(totals.cumplimiento)}</span></td>
    `;
    body.appendChild(totalTr);
}

// Render the middle-panel Area compliance table
function renderAreasTable(areaRows) {
    const body = document.getElementById('areas-table-body');
    body.innerHTML = '';
    
    const areaPercentEl = document.getElementById('comp-summary-area-percent');
    const areaDescEl = document.getElementById('comp-summary-area-desc');
    
    if (!areaRows || areaRows.length === 0) {
        body.innerHTML = '<tr><td colspan="4" class="empty-state">Sin datos para áreas</td></tr>';
        if (areaPercentEl) areaPercentEl.textContent = '-%';
        if (areaDescEl) areaDescEl.textContent = 'Sin áreas registradas';
        return;
    }
    
    let compliantAreas = 0;
    areaRows.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${r.area}</td>
            <td style="text-align: right;">${formatNum(r.pilotos)}</td>
            <td style="text-align: right;">${formatNum(r.recepcion)}</td>
            <td style="text-align: right;"><span class="cell-comp ${getComplianceClass(r.cumplimiento)}">${r.cumplimiento}%</span></td>
        `;
        body.appendChild(tr);
        
        if (r.cumplimiento >= 95 && r.cumplimiento <= 110) {
            compliantAreas++;
        }
    });
    
    const totalAreas = areaRows.length;
    const areaCompPercent = totalAreas > 0 ? Math.round((compliantAreas / totalAreas) * 100) : 0;
    
    if (areaPercentEl) {
        areaPercentEl.textContent = `${areaCompPercent}%`;
    }
    if (areaDescEl) {
        areaDescEl.textContent = `${compliantAreas} de ${totalAreas} áreas cumplieron`;
    }
}

// Render charts using Chart.js with datalabels on top of bars
function renderCharts(acumRows, areaRows) {
    // 1. Block compliance chart
    const blockCtx = document.getElementById('blocks-chart').getContext('2d');
    
    if (blocksChartInstance) {
        blocksChartInstance.destroy();
    }
    
    const blockLabels = acumRows.map(r => {
        let displayBlock = r.bloque;
        if (/^\d+$/.test(displayBlock) && displayBlock.length === 1) {
            return `0${displayBlock}`;
        }
        return displayBlock;
    });
    const blockData = acumRows.map(r => r.cumplimiento);
    
    const blockColors = blockData.map(val => {
        // Rango meta es 95% a 110%
        if (val >= 95 && val <= 110) return '#059669'; // Green Emerald
        if (val >= 90 && val < 95) return '#d97706'; // Orange Amber
        return '#dc2626'; // Red
    });
    
    blocksChartInstance = new Chart(blockCtx, {
        type: 'bar',
        data: {
            labels: blockLabels,
            datasets: [{
                label: '% Cumplimiento',
                data: blockData,
                backgroundColor: blockColors,
                borderRadius: 6,
                borderWidth: 0,
                barPercentage: 0.6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 24 }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Cumplimiento: ${context.raw}%`;
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#1e293b', // Dark labels on light backgrounds
                    font: {
                        weight: 'bold',
                        family: 'Outfit',
                        size: 11
                    },
                    formatter: function(value) {
                        return value + '%';
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: Math.max(120, ...blockData) + 12,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' }, // Light grid lines
                    ticks: { color: '#475569', callback: value => `${value}%` }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#475569' }
                }
            }
        }
    });
    
    // 2. Area compliance chart
    const areaCtx = document.getElementById('areas-chart').getContext('2d');
    
    if (areasChartInstance) {
        areasChartInstance.destroy();
    }
    
    const areaLabels = areaRows.map(r => r.area);
    const areaData = areaRows.map(r => r.cumplimiento);
    
    const areaColors = areaData.map(val => {
        if (val >= 95 && val <= 110) return '#059669';
        if (val >= 90 && val < 95) return '#d97706';
        return '#dc2626';
    });
    
    const minVal = Math.min(...areaData, 0);
    const maxVal = Math.max(...areaData, 100);
    const yMin = minVal > 50 ? Math.floor(minVal - 8) : 0;
    
    areasChartInstance = new Chart(areaCtx, {
        type: 'bar',
        data: {
            labels: areaLabels,
            datasets: [{
                label: '% Cumplimiento',
                data: areaData,
                backgroundColor: areaColors,
                borderRadius: 6,
                borderWidth: 0,
                barPercentage: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 24 }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Cumplimiento: ${context.raw}%`;
                        }
                    }
                },
                datalabels: {
                    anchor: 'end',
                    align: 'top',
                    color: '#1e293b',
                    font: {
                        weight: 'bold',
                        family: 'Outfit',
                        size: 11
                    },
                    formatter: function(value) {
                        return value + '%';
                    }
                }
            },
            scales: {
                y: {
                    min: yMin,
                    max: Math.round(maxVal + 8),
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: { color: '#475569', callback: value => `${value}%` }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#475569' }
                }
            }
        }
    });
}

// Fetch historical data and render graph/table with cross filters
async function loadHistory() {
    const flor = document.getElementById('flor-select').value;
    const variedad = document.getElementById('variedad-select').value;
    const bloque = document.getElementById('bloque-select').value;
    
    if (!flor) return;
    
    try {
        const response = await fetch(`/api/history?flor=${flor}&variedad=${variedad}&bloque=${bloque}`);
        const data = await response.json();
        
        if (data.error) {
            console.error("Error loading history:", data.error);
            return;
        }
        
        renderHistoryTable(data.history);
        renderHistoryChart(data.history);
    } catch (e) {
        console.error("Error fetching history:", e);
    }
}

function renderHistoryTable(histRows) {
    const body = document.getElementById('history-table-body');
    body.innerHTML = '';
    
    if (!histRows || histRows.length === 0) {
        body.innerHTML = '<tr><td colspan="5" class="empty-state">Sin histórico disponible</td></tr>';
        return;
    }
    
    const sortedRows = [...histRows].sort((a, b) => b.semana - a.semana);
    
    sortedRows.forEach(r => {
        const tr = document.createElement('tr');
        const diff = r.pilotos - r.recepcion;
        tr.innerHTML = `
            <td><strong>${r.semana}</strong></td>
            <td style="text-align: right;">${formatNum(r.pilotos)}</td>
            <td style="text-align: right;">${formatNum(r.recepcion)}</td>
            <td style="text-align: right;">${formatNum(diff)}</td>
            <td style="text-align: right;"><span class="cell-comp ${getComplianceClass(r.cumplimiento)}">${r.cumplimiento}%</span></td>
        `;
        body.appendChild(tr);
    });
}

function renderHistoryChart(histRows) {
    const ctx = document.getElementById('history-chart').getContext('2d');
    
    if (historyChartInstance) {
        historyChartInstance.destroy();
    }
    
    if (!histRows || histRows.length === 0) return;
    
    const labels = histRows.map(r => r.semana.toString());
    const data = histRows.map(r => r.cumplimiento);
    
    historyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '% Cumplimiento Semanal',
                data: data,
                borderColor: '#db2777', // Pink floral line
                backgroundColor: 'rgba(219, 39, 119, 0.05)',
                borderWidth: 3,
                tension: 0.3,
                fill: true,
                pointBackgroundColor: '#db2777',
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: { top: 24 }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Cumplimiento: ${context.raw}%`;
                        }
                    }
                },
                // Display percentage labels directly on top of line points
                datalabels: {
                    display: true,
                    anchor: 'end',
                    align: 'top',
                    color: '#1e293b',
                    font: {
                        weight: 'bold',
                        family: 'Outfit',
                        size: 10
                    },
                    formatter: function(value) {
                        return value + '%';
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: { color: 'rgba(0, 0, 0, 0.05)' },
                    ticks: { color: '#475569', callback: value => `${value}%` }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#475569' }
                }
            }
        }
    });
}

// Fetch and render weekly deviations
async function loadAnomalies() {
    const semana = document.getElementById('semana-select').value;
    const flor = document.getElementById('flor-select').value;
    const variedad = document.getElementById('variedad-select').value;
    const bloque = document.getElementById('bloque-select').value;
    
    if (!semana || !flor) return;
    
    const container = document.getElementById('deviations-container');
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-circle-notch fa-spin"></i> Analizando desviaciones...</div>';
    
    try {
        const response = await fetch(`/api/anomalies?semana=${semana}&flor=${flor}&variedad=${variedad}&bloque=${bloque}`);
        const data = await response.json();
        
        if (data.error) {
            console.error("Error loading anomalies:", data.error);
            container.innerHTML = `<div class="empty-state">Error: ${data.error}</div>`;
            return;
        }
        
        renderAnomalies(data.anomalies);
    } catch (e) {
        console.error("Error fetching anomalies:", e);
        container.innerHTML = '<div class="empty-state">Error al conectar con la API</div>';
    }
}

function renderAnomalies(anomalies) {
    const container = document.getElementById('deviations-container');
    container.innerHTML = '';
    
    if (!anomalies || anomalies.length === 0) {
        container.innerHTML = '<div class="empty-state" style="grid-column: span 2;">No hay bloques con desviaciones críticas detectadas para esta semana (Meta 95% - 110%).</div>';
        return;
    }
    
    // Group anomalies by Area
    const grouped = {};
    anomalies.forEach(anom => {
        const area = anom.area || 'OTRAS';
        if (!grouped[area]) {
            grouped[area] = [];
        }
        grouped[area].push(anom);
    });
    
    // Predetermined order for rendering areas
    const areaOrder = ['CLZ-1', 'CLZ-2', 'CLZ-3', 'SEZ', 'SAZ', 'LMZ', 'OTRAS'];
    
    let globalCardIndex = 0;
    
    areaOrder.forEach(areaName => {
        const items = grouped[areaName];
        if (!items || items.length === 0) return;
        
        // Render Area Header Section with WhatsApp share button for the entire AREA!
        const areaHeaderId = `area-wrapper-${areaName}`;
        
        const areaHeaderSection = document.createElement('div');
        areaHeaderSection.className = 'area-group-section';
        areaHeaderSection.innerHTML = `
            <div class="area-group-title">
                <i class="fa-solid fa-layer-group"></i> Área ${areaName}
            </div>
            <button class="btn-share" onclick="shareArea('${areaHeaderId}', '${areaName}')">
                <i class="fa-brands fa-whatsapp"></i> Compartir Área ${areaName} (Completo)
            </button>
        `;
        container.appendChild(areaHeaderSection);
        
        // Wrapper container that groups all cards for this area (for capture!)
        const areaWrapper = document.createElement('div');
        areaWrapper.id = areaHeaderId;
        areaWrapper.className = 'deviations-grid capture-container';
        areaWrapper.style.gridColumn = 'span 2';
        areaWrapper.style.width = '100%';
        areaWrapper.style.padding = '15px';
        areaWrapper.style.borderRadius = '18px';
        
        // Render cards for this area inside wrapper
        items.forEach(anom => {
            const cardId = `dev-card-${globalCardIndex++}`;
            const card = document.createElement('div');
            card.id = cardId;
            
            const isInternal = anom.tipo_alerta === 'interna';
            card.className = `deviation-card capture-container ${isInternal ? 'internal-alert' : (anom.cumplimiento < 95 ? 'danger' : '')}`;
            
            // 1. Critical Days List
            let daysHtml = '';
            if (anom.critical_days && anom.critical_days.length > 0) {
                daysHtml = '<div class="deviation-list">';
                anom.critical_days.forEach(d => {
                    const dayName = getDayName(d.fecha);
                    const diffLabel = d.diferencia > 0 ? `sobran ${formatNum(d.diferencia)}` : `faltan ${formatNum(Math.abs(d.diferencia))}`;
                    daysHtml += `
                        <div class="deviation-item">
                            <span class="deviation-item-name"><i class="fa-regular fa-calendar" style="margin-right:8px; color:var(--primary-color);"></i>${dayName}</span>
                            <span class="deviation-item-val">${d.cumplimiento}% de cumplimiento (${diffLabel})</span>
                        </div>
                    `;
                });
                daysHtml += '</div>';
            } else {
                daysHtml = '<p style="font-size: 0.9rem; color: var(--text-muted); font-style: italic;">Sin días críticos (cumplimiento diario en rango)</p>';
            }
            
            // 2. Varieties list - only shows the top 3 varieties
            let varietiesHtml = '';
            const targetVarieties = isInternal ? anom.variedades_criticas : anom.top_varieties;
            
            if (targetVarieties && targetVarieties.length > 0) {
                varietiesHtml = '<div class="deviation-list">';
                targetVarieties.forEach(v => {
                    const diffLabel = v.diferencia > 0 ? `sobran ${formatNum(v.diferencia)}` : `faltan ${formatNum(Math.abs(v.diferencia))}`;
                    const borderStyle = isInternal ? 'style="border-left: 3px solid var(--comp-red);"' : '';
                    const iconHtml = isInternal ? '<i class="fa-solid fa-triangle-exclamation" style="color:var(--comp-red); margin-right:6px;"></i>' : '';
                    
                    varietiesHtml += `
                        <div class="deviation-item" ${borderStyle}>
                            <span class="deviation-item-name">${iconHtml}${v.variedad}</span>
                            <span class="deviation-item-val">${v.cumplimiento}% de cumplimiento (${diffLabel})</span>
                        </div>
                    `;
                });
                varietiesHtml += '</div>';
            } else {
                varietiesHtml = '<p style="font-size: 0.9rem; color: var(--text-muted); font-style: italic;">Sin datos de variedades</p>';
            }
            
            let displayBlock = anom.bloque;
            if (/^\d+$/.test(displayBlock) && displayBlock.length === 1) {
                displayBlock = `0${displayBlock}`;
            }
            
            const semanaVal = document.getElementById('semana-select').value;
            const titleLabel = isInternal ? 'Alerta de Variedad Interna' : 'Desviación General';
            const descText = `${titleLabel} - Bloque ${displayBlock} - Área ${areaName} - Semana ${semanaVal}. Cumplimiento del bloque: ${anom.cumplimiento}%.`;
            
            card.innerHTML = `
                <div class="deviation-card-header">
                    <h3>Bloque ${displayBlock} <span style="font-size: 0.85rem; font-weight: normal; color: var(--text-muted); display: block; margin-top: 4px;"><i class="fa-solid fa-circle-info"></i> ${titleLabel}</span></h3>
                    <span class="cell-comp ${isInternal ? 'cell-comp orange' : getComplianceClass(anom.cumplimiento)}">${anom.cumplimiento}% cumpl.</span>
                </div>
                
                <div class="deviation-section">
                    <h4><i class="fa-solid fa-calendar-days"></i> Días Críticos de la Semana</h4>
                    ${daysHtml}
                </div>
                
                <div class="deviation-section">
                    <h4><i class="fa-solid fa-tags"></i> ${isInternal ? 'Variedades Fuera de Rango (Top 3)' : 'Desviaciones por Variedad (Top 3)'}</h4>
                    ${varietiesHtml}
                </div>
                
                <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
                    <button class="btn-share" onclick="shareElement('${cardId}', '${descText}')">
                        <i class="fa-brands fa-whatsapp"></i> Compartir Reporte Bloque
                    </button>
                </div>
            `;
            areaWrapper.appendChild(card);
        });
        
        container.appendChild(areaWrapper);
    });
}

// Convert HTML element to canvas and copy to Clipboard as image for WhatsApp, with WhatsApp web redirect or Native Web Share API
function shareElement(elementId, textDescription = "") {
    const el = document.getElementById(elementId);
    if (!el) return;
    
    showToast("Generando imagen para WhatsApp...");
    
    // We pass style values to make html2canvas match our light dashboard theme perfectly
    html2canvas(el, {
        backgroundColor: '#ffffff',
        scale: 2, // higher resolution
        logging: false,
        useCORS: true
    }).then(canvas => {
        canvas.toBlob(blob => {
            if (!blob) {
                showToast("Error al procesar la imagen");
                return;
            }
            
            // Create a File object from blob for Native Sharing
            const file = new File([blob], `${elementId}.png`, { type: 'image/png' });
            
            // 1. Try Native Web Share API first (For Android / iOS Mobile Devices!)
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({
                    files: [file],
                    title: 'Diferencias CPC vs Recepción',
                    text: textDescription
                }).then(() => {
                    showToast("¡Reporte compartido con éxito!");
                }).catch(err => {
                    console.error("Web Share failed:", err);
                    triggerDownloadFallback(canvas, elementId);
                });
            } else {
                // 2. Desktop Clipboard Fallback + Instruction Dialog Popup!
                try {
                    navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]).then(() => {
                        // Open instruction modal
                        openWhatsappModal(textDescription);
                    }).catch(err => {
                        console.error("Clipboard API failed:", err);
                        triggerDownloadFallback(canvas, elementId);
                    });
                } catch (e) {
                    console.error("Clipboard Item failed:", e);
                    triggerDownloadFallback(canvas, elementId);
                }
            }
        }, 'image/png');
    }).catch(err => {
        showToast("Error al generar la imagen");
        console.error(err);
    });
}

function shareArea(wrapperId, areaName) {
    const semana = document.getElementById('semana-select').value;
    const flor = document.getElementById('flor-select').value;
    
    const desc = `Reporte Completo del Área ${areaName} - Semana ${semana} - Flor: ${flor}.`;
    shareElement(wrapperId, desc);
}

function shareDashboardSummary() {
    const semana = document.getElementById('semana-select').value;
    const flor = document.getElementById('flor-select').value;
    const pilotsVal = document.getElementById('stat-pilotos').textContent;
    const recepVal = document.getElementById('stat-recepcion').textContent;
    const compVal = document.getElementById('stat-cumplimiento').textContent;
    
    const efecEl = document.getElementById('comp-summary-bloq-percent');
    const efecVal = efecEl ? efecEl.textContent : '-';
    
    const desc = `Resumen Semanal de Producción - Semana ${semana} - Flor: ${flor}. \n* Pilotos Totales: ${pilotsVal} \n* Recepción Total: ${recepVal} \n* Cumplimiento Total: ${compVal} \n* Efectividad de Bloques: ${efecVal}.`;
    
    shareElement('dashboard-summary-wrapper', desc);
}

function shareAllDeviations() {
    const semana = document.getElementById('semana-select').value;
    const flor = document.getElementById('flor-select').value;
    
    // Collect deviant block numbers
    const blocks = Array.from(document.querySelectorAll('.deviation-card h3')).map(h3 => {
        // extract block number digits only
        const m = h3.textContent.match(/Bloque\s+(\w+)/);
        return m ? m[1] : '';
    }).filter(v => v);
    
    const blocksText = blocks.length > 0 ? blocks.join(', ') : 'Ninguno';
    
    const desc = `Reporte Completo de Desviaciones - Semana ${semana} - Flor: ${flor}. \nMeta de Cumplimiento: 95% - 110%. \nBloques fuera de rango detectados: ${blocksText}.`;
    
    shareElement('deviations-container', desc);
}

// Fallback: download file if clipboard copying is blocked by browser policies
function triggerDownloadFallback(canvas, filename) {
    try {
        const link = document.createElement('a');
        link.download = `${filename}.png`;
        link.href = canvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Copia falló. Imagen descargada. Adjúntala en WhatsApp.");
    } catch(e) {
        showToast("No se pudo exportar la imagen");
    }
}

// Dialog Modal Controls for Desktop sharing instructions
function openWhatsappModal(textDescription) {
    const modal = document.getElementById('whatsapp-modal');
    modal.classList.remove('hidden');
    
    // Open WhatsApp Web in background/new tab with loaded text
    const encodedText = encodeURIComponent(textDescription + " (Adjunto imagen en el portapapeles. Pega con Ctrl+V)");
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    window.open(whatsappUrl, '_blank');
}

function closeWhatsappModal() {
    const modal = document.getElementById('whatsapp-modal');
    modal.classList.add('hidden');
}

// Show clean UI notification toasts
function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    
    toastMsg.textContent = message;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 5500);
}

// Initialize Drag & Drop Zone
function initUploadZone() {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const statusDiv = document.getElementById('upload-status');
    const statusText = document.getElementById('status-text');
    
    dropZone.addEventListener('click', () => fileInput.click());
    
    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) {
            uploadFiles(fileInput.files);
        }
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('dragover');
        }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('dragover');
        }, false);
    });
    
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            uploadFiles(files);
        }
    });
    
    async function uploadFiles(files) {
        statusDiv.classList.remove('hidden');
        statusText.innerHTML = `Procesando y cargando ${files.length} archivo(s)...`;
        
        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('files[]', files[i]);
        }
        
        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            
            if (data.success) {
                statusText.innerHTML = `<span style="color: var(--comp-green);"><i class="fa-solid fa-circle-check"></i> ${data.message}</span>`;
                
                const semSelect = document.getElementById('semana-select').value;
                const flSelect = document.getElementById('flor-select').value;
                const varSelect = document.getElementById('variedad-select').value;
                const blqSelect = document.getElementById('bloque-select').value;
                setTimeout(() => {
                    initFilters(semSelect, flSelect, varSelect, blqSelect);
                    statusDiv.classList.add('hidden');
                }, 2000);
            } else {
                statusText.innerHTML = `<span style="color: var(--comp-red);"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${data.error}</span>`;
            }
        } catch (e) {
            statusText.innerHTML = `<span style="color: var(--comp-red);"><i class="fa-solid fa-triangle-exclamation"></i> Error de conexión: ${e.message}</span>`;
            console.error("Upload error:", e);
        }
    }
}
