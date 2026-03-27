// ACB3P2 Database - Main JavaScript with CSV loading
let peptidesData = [];
let currentView = 'table';
let sortColumn = 'peptide_name';
let sortDirection = 'asc';
let filteredPeptides = [];

// Helper functions
function getActivityCategory(ic50) {
    if (!ic50 || ic50 === '') return null;
    const value = parseFloat(ic50);
    if (isNaN(value)) return null;
    if (value < 10) return 'high';
    if (value <= 50) return 'medium';
    return 'low';
}

function getActivityText(category) {
    switch(category) {
        case 'high': return 'High';
        case 'medium': return 'Medium';
        case 'low': return 'Low';
        default: return 'N/A';
    }
}

function getActivityClass(category) {
    switch(category) {
        case 'high': return 'activity-high';
        case 'medium': return 'activity-medium';
        case 'low': return 'activity-low';
        default: return '';
    }
}

function getPeptideUrl(peptideId, peptideName) {
    const slug = peptideName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `peptide.html?id=${peptideId}&name=${encodeURIComponent(peptideName)}`;
}

// Load CSV data
async function loadCSV() {
    try {
        const response = await fetch('structure_ACPBBBP.csv');
        if (!response.ok) {
            throw new Error('Unable to load CSV file');
        }
        const csvText = await response.text();
        parseCSV(csvText);
    } catch (error) {
        console.error('Error loading CSV:', error);
        const errorHtml = `
            <div class="error-message">
                <p>Error loading data: ${error.message}</p>
                <p>Please ensure structure_ACPBBBP.csv is in the same directory.</p>
                <button onclick="location.reload()" class="btn-primary" style="margin-top: 1rem;">Retry</button>
            </div>
        `;
        
        const containers = ['featuredPeptides', 'resultsContainer', 'peptideDetail'];
        containers.forEach(id => {
            const container = document.getElementById(id);
            if (container && container.innerHTML.includes('Loading')) {
                container.innerHTML = errorHtml;
            }
        });
    }
}

function parseCSV(csvText) {
    const lines = csvText.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    peptidesData = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === '') continue;
        
        let line = lines[i];
        let fields = [];
        let inQuotes = false;
        let currentField = '';
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                fields.push(currentField.trim());
                currentField = '';
            } else {
                currentField += char;
            }
        }
        fields.push(currentField.trim());
        
        if (fields.length >= headers.length) {
            const peptide = {};
            headers.forEach((header, index) => {
                let value = fields[index] || '';
                if (value.startsWith('"') && value.endsWith('"')) {
                    value = value.slice(1, -1);
                }
                peptide[header] = value;
            });
            
            // Parse numeric values
            peptide.length = parseInt(peptide.length) || 0;
            peptide.molecular_weight = parseFloat(peptide.molecular_weight) || 0;
            peptide.net_charge = parseFloat(peptide.net_charge) || 0;
            peptide.hydrophobicity = parseFloat(peptide.hydrophobicity) || 0;
            peptide.id = i; // Assign ID based on row number
            
            if (peptide.anticancer_ic50 && peptide.anticancer_ic50 !== '') {
                peptide.anticancer_ic50_value = parseFloat(peptide.anticancer_ic50);
            } else {
                peptide.anticancer_ic50_value = null;
            }
            
            peptidesData.push(peptide);
        }
    }
    
    filteredPeptides = [...peptidesData];
    
    // Initialize appropriate page
    const currentPage = window.location.pathname.split('/').pop();
    if (currentPage === 'index.html' || currentPage === '') {
        initHomePage();
    } else if (currentPage === 'browse.html') {
        initBrowsePage();
    } else if (currentPage === 'peptide.html') {
        initPeptidePage();
    }
}

// Home page initialization
function initHomePage() {
    updateHomeStats();
    displayFeaturedPeptides();
}

function updateHomeStats() {
    const total = peptidesData.length;
    const avgLength = peptidesData.reduce((sum, p) => sum + p.length, 0) / total;
    const avgMW = peptidesData.reduce((sum, p) => sum + p.molecular_weight, 0) / total;
    const structures = [...new Set(peptidesData.map(p => p.structure_type))].length;
    
    document.getElementById('totalPeptides').textContent = total;
    document.getElementById('avgLength').textContent = avgLength.toFixed(0);
    document.getElementById('avgMW').textContent = avgMW.toFixed(0);
    document.getElementById('structures').textContent = structures;
}

function displayFeaturedPeptides() {
    const container = document.getElementById('featuredPeptides');
    const featured = peptidesData.slice(0, 6);
    
    if (featured.length === 0) {
        container.innerHTML = '<div class="loading">No peptides found in database</div>';
        return;
    }
    
    let html = '';
    featured.forEach(peptide => {
        const activityCat = getActivityCategory(peptide.anticancer_ic50);
        const activityClass = getActivityClass(activityCat);
        const activityText = getActivityText(activityCat);
        
        html += `
            <a href="${getPeptideUrl(peptide.id, peptide.peptide_name)}" class="peptide-card">
                <div class="card-header">
                    <h3>${peptide.peptide_name || 'Unnamed Peptide'}</h3>
                </div>
                <div class="card-content">
                    <div class="card-row">
                        <div class="card-label">Source:</div>
                        <div class="card-value">${peptide.source_organism || 'N/A'}</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Length / MW:</div>
                        <div class="card-value">${peptide.length || 'N/A'} aa / ${peptide.molecular_weight ? peptide.molecular_weight.toFixed(1) : 'N/A'} Da</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Activity:</div>
                        <div class="card-value"><span class="badge ${activityClass}">${activityText}</span> (${peptide.anticancer_ic50 || 'N/A'} µM)</div>
                    </div>
                </div>
            </a>
        `;
    });
    
    container.innerHTML = html;
}

// Browse page initialization
function initBrowsePage() {
    filteredPeptides = [...peptidesData];
    updateBrowseStats();
    displayBrowseResults();
    setupBrowseEventListeners();
}

function setupBrowseEventListeners() {
    const searchInput = document.getElementById('searchInput');
    const activityFilter = document.getElementById('activityFilter');
    const structureFilter = document.getElementById('structureFilter');
    
    if (searchInput) searchInput.addEventListener('keyup', searchPeptides);
    if (activityFilter) activityFilter.addEventListener('change', searchPeptides);
    if (structureFilter) structureFilter.addEventListener('change', searchPeptides);
}

function updateBrowseStats() {
    const count = filteredPeptides.length;
    const countElement = document.getElementById('resultsCount');
    if (countElement) countElement.textContent = `Found peptides: ${count}`;
}

function searchPeptides() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const activityFilter = document.getElementById('activityFilter').value;
    const structureFilter = document.getElementById('structureFilter').value;
    
    filteredPeptides = peptidesData.filter(peptide => {
        const matchesSearch = searchTerm === '' || 
            (peptide.peptide_name && peptide.peptide_name.toLowerCase().includes(searchTerm)) ||
            (peptide.sequence_one_letter && peptide.sequence_one_letter.toLowerCase().includes(searchTerm)) ||
            (peptide.source_organism && peptide.source_organism.toLowerCase().includes(searchTerm));
        
        let matchesActivity = true;
        if (activityFilter !== 'all') {
            const activityCat = getActivityCategory(peptide.anticancer_ic50);
            matchesActivity = activityCat === activityFilter;
        }
        
        let matchesStructure = true;
        if (structureFilter !== 'all') {
            matchesStructure = (peptide.structure_type || '').toLowerCase() === structureFilter.toLowerCase();
        }
        
        return matchesSearch && matchesActivity && matchesStructure;
    });
    
    updateBrowseStats();
    displayBrowseResults();
}

function resetFilters() {
    const searchInput = document.getElementById('searchInput');
    const activityFilter = document.getElementById('activityFilter');
    const structureFilter = document.getElementById('structureFilter');
    
    if (searchInput) searchInput.value = '';
    if (activityFilter) activityFilter.value = 'all';
    if (structureFilter) structureFilter.value = 'all';
    
    filteredPeptides = [...peptidesData];
    updateBrowseStats();
    displayBrowseResults();
}

function displayBrowseResults() {
    const container = document.getElementById('resultsContainer');
    if (!container) return;
    
    const count = filteredPeptides.length;
    
    if (count === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 3rem;">No peptides found</div>';
        return;
    }
    
    if (currentView === 'table') {
        displayTableView(container);
    } else {
        displayCardBrowseView(container);
    }
}

function displayTableView(container) {
    let html = `
        <div class="table-view">
             <table>
                <thead>
                    <tr>
                        <th onclick="sortBy('peptide_name')">Name</th>
                        <th onclick="sortBy('sequence_one_letter')">Sequence</th>
                        <th onclick="sortBy('length')">Length</th>
                        <th onclick="sortBy('molecular_weight')">MW (Da)</th>
                        <th onclick="sortBy('net_charge')">Charge</th>
                        <th>Activity (IC50)</th>
                        <th onclick="sortBy('source_organism')">Source</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody>
    `;
    
    filteredPeptides.forEach(peptide => {
        const sequenceDisplay = peptide.sequence_one_letter ? 
            (peptide.sequence_one_letter.length > 35 ? 
                peptide.sequence_one_letter.substring(0, 35) + '...' : 
                peptide.sequence_one_letter) : 'N/A';
        
        const ic50Display = peptide.anticancer_ic50 ? `${peptide.anticancer_ic50} µM` : 'N/A';
        const activityCat = getActivityCategory(peptide.anticancer_ic50);
        const activityClass = getActivityClass(activityCat);
        const activityText = getActivityText(activityCat);
        
        html += `
            <tr>
                <td><strong>${peptide.peptide_name || 'N/A'}</strong></td>
                <td style="font-family: monospace; font-size: 0.7rem;">${sequenceDisplay}</td>
                <td>${peptide.length || 'N/A'}</td>
                <td>${peptide.molecular_weight ? peptide.molecular_weight.toFixed(1) : 'N/A'}</td>
                <td>${peptide.net_charge || 'N/A'}</td>
                <td><

span class="badge ${activityClass}">${activityText} (${ic50Display})</span></td>
                <td>${peptide.source_organism || 'N/A'}</td>
                <td><a href="${getPeptideUrl(peptide.id, peptide.peptide_name)}" class="btn-primary" style="padding: 0.2rem 0.75rem; font-size: 0.75rem; text-decoration: none;">View</a></td>
            </tr>
        `;
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}

function displayCardBrowseView(container) {
    let html = '<div class="peptide-grid">';
    
    filteredPeptides.forEach(peptide => {
        const activityCat = getActivityCategory(peptide.anticancer_ic50);
        const activityClass = getActivityClass(activityCat);
        const activityText = getActivityText(activityCat);
        const ic50Display = peptide.anticancer_ic50 ? `${peptide.anticancer_ic50} µM` : 'N/A';
        
        html += `
            <a href="${getPeptideUrl(peptide.id, peptide.peptide_name)}" class="peptide-card">
                <div class="card-header">
                    <h3>${peptide.peptide_name || 'Unnamed Peptide'}</h3>
                </div>
                <div class="card-content">
                    <div class="card-row">
                        <div class="card-label">Sequence:</div>
                        <div class="card-value" style="font-family: monospace; font-size: 0.7rem; word-break: break-all;">${peptide.sequence_one_letter || 'N/A'}</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Source:</div>
                        <div class="card-value">${peptide.source_organism || 'N/A'}</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Length / MW:</div>
                        <div class="card-value">${peptide.length || 'N/A'} aa / ${peptide.molecular_weight ? peptide.molecular_weight.toFixed(1) : 'N/A'} Da</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Activity:</div>
                        <div class="card-value"><span class="badge ${activityClass}">${activityText}</span> (${ic50Display})</div>
                    </div>
                    <div class="card-row">
                        <div class="card-label">Cancer Lines:</div>
                        <div class="card-value">${peptide.anticancer_cell_lines || 'N/A'}</div>
                    </div>
                </div>
            </a>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

function setView(view) {
    currentView = view;
    const btns = document.querySelectorAll('.toggle-btn');
    btns.forEach(btn => btn.classList.remove('active'));
    if (view === 'table') {
        btns[0].classList.add('active');
    } else {
        btns[1].classList.add('active');
    }
    displayBrowseResults();
}

function sortBy(column) {
    if (sortColumn === column) {
        sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        sortColumn = column;
        sortDirection = 'asc';
    }
    
    filteredPeptides.sort((a, b) => {
        let valA = a[column];
        let valB = b[column];
        
        if (valA === undefined || valA === null || valA === '') valA = -Infinity;
        if (valB === undefined || valB === null || valB === '') valB = -Infinity;
        
        if (typeof valA === 'string') {
            valA = valA.toLowerCase();
            valB = valB.toLowerCase();
        }
        
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    displayBrowseResults();
}

// Peptide detail page initialization
function initPeptidePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const peptideId = parseInt(urlParams.get('id'));
    const peptide = peptidesData.find(p => p.id === peptideId);
    
    if (!peptide) {
        document.getElementById('peptideDetail').innerHTML = `
            <div class="error-message">
                <p>Peptide not found</p>
                <a href="browse.html" class="btn-primary">Browse Database</a>
            </div>
        `;
        return;
    }
    
    document.getElementById('pageTitle').textContent = `${peptide.peptide_name} - ACB3P2 Database`;
    displayPeptideDetail(peptide);
}

function displayPeptideDetail(peptide) {
    const activityCat = getActivityCategory(peptide.anticancer_ic50);
    const activityClass = getActivityClass(activityCat);
    const activityText = getActivityText(activityCat);
    
    const html = `
        <div class="peptide-detail-container">
            <div style="margin-bottom: 2rem;">
                <a href="browse.html" class="btn-secondary" style="display: inline-block; margin-bottom: 1rem;">&larr; Back to Browse</a>
                <h1 style="color: #2c5282;">${peptide.peptide_name}</h1>
                <p style="color: #718096;">ID: ${peptide.id} | Last updated: ${peptide.created_date || 'N/A'}</p>
            </div>
            
            <div class="detail-section">
                <h3>Basic Information</h3>
                <div class="detail-row">
                    <div class="detail-label">Peptide Name:</div>
                    <div class="detail-value">${peptide.peptide_name}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Sequence (1-letter):</div>
                    <div class="detail-value" style="font-family: monospace;">${peptide.sequence_one_letter || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Sequence (3-letter):</div>
                    <div class="detail-value" style="font-size: 0.8rem;">${peptide.sequence_three_letter || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Length:</div>
                    <div class="detail-value">${peptide.length || 'N/A'} amino acids</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Molecular Weight:</div>
                    <div class="detail-value">${peptide.molecular_weight ? peptide.molecular_weight.toFixed(2) : 'N/A'} Da</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Net Charge:</div>
                    <div class="detail-value">${peptide.net_charge || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Hydrophobicity:</div>
                    <div class="detail-value">${peptide.hydrophobicity || 'N/A'}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Structural Properties</h3>
                <div class="detail-row">
                    <div class="detail-label">Structure Type:</div>
                    <div class="detail-value">${peptide.structure_type || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">PDB ID:</div>
                    <div class="detail-value">${peptide.PDB || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">SMILES:</div>
                    <div class="detail-value" style="font-size: 0.7rem; word-break: break-all;">${peptide.SMILES || 'N/A'}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Anticancer Activity</h3>
                <div class="detail-row">
                    <div class="detail-label">IC50:</div>
                    <div class="detail-value">${peptide.anticancer_ic50 || 'N/A'} µM <span class="badge ${activityClass}" style="margin-left: 0.5rem;">${activityText}</span></div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Cancer Cell Lines:</div>
                    <div class="detail-value">${peptide.anticancer_cell_lines || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Selectivity Index:</div>
                    <div class="detail-value">${peptide.anticancer_selectivity || 'N/A'}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Antimicrobial Activity</h3>
                <div class="detail-row">
                    <div class="detail-label">Targets:</div>
                    <div class="detail-value">${peptide.antimicrobial_targets || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">MIC:</div>
                    <div class="detail-value">${peptide.antimicrobial_mic || 'N/A'} µM</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Biological Source</h3>
                <div class="detail-row">
                    <div class="detail-label">Organism:</div>
                    <div class="detail-value">${peptide.source_organism || 'N/A'}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Blood-Brain Barrier Penetration</h3>
                <div class="detail-row">
                    <div class="detail-label">Permeability Value:</div>
                    <div class="detail-value">${peptide.bbb_permeability_value || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Transport Type:</div>
                    <div class="detail-value">${peptide.bbb_transport_type || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Model:</div>
                    <div class="detail-value">${peptide.bbb_model || 'N/A'}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Toxicity & Stability</h3>
                <div class="detail-row">
                    <div class="detail-label">Hemolysis (LC50):</div>
                    <div class="detail-value">${peptide.toxicity_hemolysis || 'N/A'} µM</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Serum Stability:</div>
                    <div class="detail-value">${peptide.stability_serum || 'N/A'} h</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Synergy:</div>
                    <div class="detail-value">${peptide.synergy || 'N/A'}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>References</h3>
                <div class="detail-row">
                    <div class="detail-label">PMID:</div>
                    <div class="detail-value">${peptide.pmid || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">DOI:</div>
                    <div class="detail-value">${peptide.doi ? `<a href="https://doi.org/${peptide.doi}" target="_blank">${peptide.doi}</a>` : 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Notes:</div>
                    <div class="detail-value">${peptide.notes || 'N/A'}</div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('peptideDetail').innerHTML = html;
}

// Predict secondary structure using simple algorithm (heuristic based on amino acid propensities)
function predictSecondaryStructure(sequence) {
    // Helix-forming amino acids (A, L, M, E, Q, K, R, H)
    const helixFormers = new Set(['A', 'L', 'M', 'E', 'Q', 'K', 'R', 'H', 'W', 'F', 'Y']);
    // Sheet-forming amino acids (V, I, Y, F, W, T, C)
    const sheetFormers = new Set(['V', 'I', 'Y', 'F', 'W', 'T', 'C']);
    // Turn-forming amino acids (G, N, P, S, D)
    const turnFormers = new Set(['G', 'N', 'P', 'S', 'D']);
    
    let structure = [];
    let windowSize = 5;
    
    for (let i = 0; i < sequence.length; i++) {
        let aa = sequence[i];
        let helixScore = 0;
        let sheetScore = 0;
        let turnScore = 0;
        
        // Count surrounding residues for prediction
        for (let j = Math.max(0, i - windowSize/2); j <= Math.min(sequence.length - 1, i + windowSize/2); j++) {
            let res = sequence[j];
            if (helixFormers.has(res)) helixScore++;
            if (sheetFormers.has(res)) sheetScore++;
            if (turnFormers.has(res)) turnScore++;
        }
        
        if (helixScore > sheetScore && helixScore > turnScore) {
            structure.push('helix');
        } else if (sheetScore > helixScore && sheetScore > turnScore) {
            structure.push('sheet');
        } else if (turnScore > helixScore && turnScore > sheetScore) {
            structure.push('turn');
        } else {
            structure.push('coil');
        }
    }
    
    return structure;
}

// Generate PDB-like data from sequence (simplified structure prediction)
function generateStructureData(sequence, structureType, secondaryStructure) {
    // This creates a simplified 3D representation
    let atoms = [];
    let bonds = [];
    
    let x = 0, y = 0, z = 0;
    let angle = 0;
    
    for (let i = 0; i < sequence.length; i++) {
        // Calculate position based on secondary structure
        if (secondaryStructure[i] === 'helix') {
            // Helix: circular arrangement
            let radius = 2.0;
            let angleStep = (2 * Math.PI) / 3.6;
            x = radius * Math.cos(angle);
            y = radius * Math.sin(angle);
            z = i * 1.5;
            angle += angleStep;
        } else if (secondaryStructure[i] === 'sheet') {
            // Sheet: extended zigzag
            x = Math.sin(i * 0.8) * 1.5;
            y = (i % 2 === 0 ? 0.5 : -0.5);
            z = i * 1.3;
        } else {
            // Coil/turn: random coil
            x = Math.sin(i * 0.5) * 1.0;
            y = Math.cos(i * 0.7) * 1.0;
            z = i * 1.4;
        }
        
        atoms.push({
            serial: i + 1,
            name: 'CA',
            resName: getThreeLetterCode(sequence[i]),
            chain: 'A',
            resSeq: i + 1,
            x: x,
            y: y,
            z: z
        });
        
        if (i > 0) {
            bonds.push([i - 1, i]);
        }
    }
    
    return { atoms, bonds };
}

function getThreeLetterCode(oneLetter) {
    const codes = {
        'A': 'ALA', 'R': 'ARG', 'N': 'ASN', 'D': 'ASP', 'C': 'CYS',
        'Q': 'GLN', 'E': 'GLU', 'G': 'GLY', 'H': 'HIS', 'I': 'ILE',
        'L': 'LEU', 'K': 'LYS', 'M': 'MET', 'F': 'PHE', 'P': 'PRO',
        'S': 'SER', 'T': 'THR', 'W': 'TRP', 'Y': 'TYR', 'V': 'VAL'
    };
    return codes[oneLetter] || 'UNK';
}

// Render 3D structure using 3Dmol.js
function render3DStructure(sequence, structureType, secondaryStructure) {
    const container = document.getElementById('structure-viewer-3d');
    if (!container) return;
    
    // Generate structure data
    const structureData = generateStructureData(sequence, structureType, secondaryStructure);
    
    // Create PDB-like string
    let pdbString = '';
    structureData.atoms.forEach(atom => {
        pdbString += `ATOM  ${atom.serial.toString().padStart(5)}  CA  ${atom.resName} ${atom.chain}${atom.resSeq.toString().padStart(4)}    ${atom.x.toFixed(3)} ${atom.y.toFixed(3)} ${atom.z.toFixed(3)}  1.00  0.00           C  \n`;
    });
    structureData.bonds.forEach(bond => {
        pdbString += `CONECT${bond[0].toString().padStart(5)}${bond[1].toString().padStart(5)}\n`;
    });
    
    // Clear and add viewer
    container.innerHTML = '';
    let viewer = $3Dmol.createViewer(container, { backgroundColor: 'white' });
    
    // Add model
    viewer.addModel(pdbString, 'pdb');
    viewer.setStyle({}, { cartoon: { color: 'spectrum' } });
    viewer.zoomTo();
    viewer.render();
    
    // Store viewer for controls
    window.currentViewer = viewer;
}

// Render 2D secondary structure diagram
function render2DStructure(sequence, secondaryStructure) {
    const container = document.getElementById('structure-viewer-2d');
    if (!container) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const startX = 50;
    const startY = 150;
    const spacing = (canvas.width - 100) / sequence.length;
    
    // Draw backbone
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    for (let i = 1; i < sequence.length; i++) {
        const x = startX + i * spacing;
        ctx.lineTo(x, startY);
    }
    ctx.strokeStyle = '#cbd5e0';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw secondary structure elements
    for (let i = 0; i < sequence.length; i++) {
        const x = startX + i * spacing;
        const y = startY;
        
        // Draw structure representation
        if (secondaryStructure[i] === 'helix') {
            // Helix: spiral or cylinder
            ctx.beginPath();
            ctx.ellipse(x, y - 15, 8, 12, 0, 0, Math.PI * 2);
            ctx.fillStyle = '#4299e1';
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 10px monospace';
            ctx.fillText('α', x - 3, y - 17);
        } else if (secondaryStructure[i] === 'sheet') {
            // Sheet: zigzag arrow
            ctx.beginPath();
            ctx.moveTo(x - 8, y - 10);
            ctx.lineTo(x, y - 18);
            ctx.lineTo(x + 8, y - 10);
            ctx.fillStyle = '#48bb78';
            ctx.fill();
            ctx.fillStyle = 'white';
            ctx.font = 'bold 8px monospace';
            ctx.fillText('β', x - 2, y - 12);
        } else if (secondaryStructure[i] === 'turn') {
            // Turn: curved line
            ctx.beginPath();
            ctx.arc(x, y - 10, 8, 0, Math.PI, true);
            ctx.strokeStyle = '#ed8936';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            // Coil: loop
            ctx.beginPath();
            ctx.arc(x, y - 8, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#a0aec0';
            ctx.fill();
        }
        
        // Draw amino acid label
        ctx.fillStyle = '#4a5568';
        ctx.font = '10px monospace';
        ctx.fillText(sequence[i], x - 3, y + 20);
    }
    
    // Add title
    ctx.fillStyle = '#2c5282';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('Secondary Structure Prediction', 20, 40);
    
    container.innerHTML = '';
    container.appendChild(canvas);
}

// Render sequence with colored secondary structure
function renderSequenceWithStructure(sequence, secondaryStructure) {
    const container = document.getElementById('structure-viewer-sequence');
    if (!container) return;
    
    let html = '<div class="prediction-sequence">';
    for (let i = 0; i < sequence.length; i++) {
        let className = '';
        let title = '';
        switch(secondaryStructure[i]) {
            case 'helix':
                className = 'helix';
                title = 'α-helix';
                break;
            case 'sheet':
                className = 'sheet';
                title = 'β-sheet';
                break;
            case 'turn':
                className = 'turn';
                title = 'Turn';
                break;
            default:
                className = 'coil';
                title = 'Coil';
        }
        html += `<span class="${className}" title="${title}">${sequence[i]}</span>`;
    }
    html += '</div>';
    html += '<div class="secondary-structure-annotation">';
    html += '<strong>Secondary Structure Prediction:</strong> ';
    html += '<span style="background:#4299e1; padding:2px 4px;">α-helix</span> ';
    html += '<span style="background:#48bb78; padding:2px 4px;">β-sheet</span> ';
    html += '<span style="background:#ed8936; padding:2px 4px;">Turn</span> ';
    html += '<span style="background:#a0aec0; padding:2px 4px;">Coil</span>';
    html += '</div>';
    
    container.innerHTML = html;
}

// Switch between structure views
let currentViewTab = '3d';

function switchViewTab(tab) {
    currentViewTab = tab;
    
    // Update tab buttons
    document.querySelectorAll('.viewer-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`.viewer-tab[data-tab="${tab}"]`).classList.add('active');
    
    // Show/hide views
    const view3d = document.getElementById('structure-viewer-3d');
    const view2d = document.getElementById('structure-viewer-2d');
    const viewSeq = document.getElementById('structure-viewer-sequence');
    
    if (tab === '3d') {
        view3d.style.display = 'block';
        view2d.style.display = 'none';
        viewSeq.style.display = 'none';
        if (window.currentViewer) {
            window.currentViewer.render();
            window.currentViewer.zoomTo();
        }
    } else if (tab === '2d') {
        view3d.style.display = 'none';
        view2d.style.display = 'block';
        viewSeq.style.display = 'none';
    } else {
        view3d.style.display = 'none';
        view2d.style.display = 'none';
        viewSeq.style.display = 'block';
    }
}

// Control functions for 3D viewer
function rotateStructure(direction) {
    if (!window.currentViewer) return;
    if (direction === 'left') {
        window.currentViewer.rotate(10, { x: 0, y: 1, z: 0 });
    } else if (direction === 'right') {
        window.currentViewer.rotate(-10, { x: 0, y: 1, z: 0 });
    } else if (direction === 'up') {
        window.currentViewer.rotate(10, { x: 1, y: 0, z: 0 });
    } else if (direction === 'down') {
        window.currentViewer.rotate(-10, { x: 1, y: 0, z: 0 });
    }
    window.currentViewer.render();
}

function resetView() {
    if (!window.currentViewer) return;
    window.currentViewer.zoomTo();
    window.currentViewer.render();
}

// Update displayPeptideDetail function to include structure viewer
// Replace the existing displayPeptideDetail function with this enhanced version
function displayPeptideDetail(peptide) {
    const activityCat = getActivityCategory(peptide.anticancer_ic50);
    const activityClass = getActivityClass(activityCat);
    const activityText = getActivityText(activityCat);
    
    // Predict secondary structure
    const sequence = peptide.sequence_one_letter || '';
    const secondaryStructure = predictSecondaryStructure(sequence);
    
    const html = `
        <div class="peptide-detail-container">
            <div style="margin-bottom: 2rem;">
                <a href="browse.html" class="btn-secondary" style="display: inline-block; margin-bottom: 1rem;">&larr; Back to Browse</a>
                <h1 style="color: #2c5282;">${peptide.peptide_name}</h1>
                <p style="color: #718096;">ID: ${peptide.id} | Last updated: ${peptide.created_date || 'N/A'}</p>
            </div>
            
            <div class="structure-viewer">
                <h3>Secondary Structure Visualization</h3>
                <div class="viewer-tabs">
                    <button class="viewer-tab active" data-tab="3d" onclick="switchViewTab('3d')">3D Structure</button>
                    <button class="viewer-tab" data-tab="2d" onclick="switchViewTab('2d')">2D Diagram</button>
                    <button class="viewer-tab" data-tab="sequence" onclick="switchViewTab('sequence')">Sequence View</button>
                </div>
                <div id="structure-viewer-3d" class="structure-container" style="display: block;"></div>
                <div id="structure-viewer-2d" class="structure-container" style="display: none;"></div>
                <div id="structure-viewer-sequence" class="prediction-container" style="display: none;"></div>
                <div class="structure-controls">
                    <button onclick="rotateStructure('left')">Rotate Left</button>
                    <button onclick="rotateStructure('right')">Rotate Right</button>
                    <button onclick="rotateStructure('up')">Rotate Up</button>
                    <button onclick="rotateStructure('down')">Rotate Down</button>
                    <button onclick="resetView()">Reset View</button>
                </div>
                <div class="structure-legend">
                    <div class="legend-item"><div class="legend-color alpha"></div><span>α-Helix</span></div>
                    <div class="legend-item"><div class="legend-color beta"></div><span>β-Sheet</span></div>
                    <div class="legend-item"><div class="legend-color coil"></div><span>Coil/Turn</span></div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Basic Information</h3>
                <div class="detail-row">
                    <div class="detail-label">Peptide Name:</div>
                    <div class="detail-value">${peptide.peptide_name}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Sequence (1-letter):</div>
                    <div class="detail-value" style="font-family: monospace;">${peptide.sequence_one_letter || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Sequence (3-letter):</div>
                    <div class="detail-value" style="font-size: 0.8rem;">${peptide.sequence_three_letter || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Length:</div>
                    <div class="detail-value">${peptide.length || 'N/A'} amino acids</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Molecular Weight:</div>
                    <div class="detail-value">${peptide.molecular_weight ? peptide.molecular_weight.toFixed(2) : 'N/A'} Da</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Net Charge:</div>
                    <div class="detail-value">${peptide.net_charge || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Hydrophobicity:</div>
                    <div class="detail-value">${peptide.hydrophobicity || 'N/A'}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Structural Properties</h3>
                <div class="detail-row">
                    <div class="detail-label">Structure Type:</div>
                    <div class="detail-value">${peptide.structure_type || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Predicted Secondary Structure:</div>
                    <div class="detail-value">${secondaryStructure.filter(s => s === 'helix').length} α-helices, ${secondaryStructure.filter(s => s === 'sheet').length} β-sheets, ${secondaryStructure.filter(s => s === 'coil' || s === 'turn').length} coils/turns</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">PDB ID:</div>
                    <div class="detail-value">${peptide.PDB || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">SMILES:</div>
                    <div class="detail-value" style="font-size: 0.7rem; word-break: break-all;">${peptide.SMILES || 'N/A'}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Anticancer Activity</h3>
                <div class="detail-row">
                    <div class="detail-label">IC50:</div>
                    <div class="detail-value">${peptide.anticancer_ic50 || 'N/A'} µM <span class="badge ${activityClass}" style="margin-left: 0.5rem;">${activityText}</span></div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Cancer Cell Lines:</div>
                    <div class="detail-value">${peptide.anticancer_cell_lines || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Selectivity Index:</div>
                    <div class="detail-value">${peptide.anticancer_selectivity || 'N/A'}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Antimicrobial Activity</h3>
                <div class="detail-row">
                    <div class="detail-label">Targets:</div>
                    <div class="detail-value">${peptide.antimicrobial_targets || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">MIC:</div>
                    <div class="detail-value">${peptide.antimicrobial_mic || 'N/A'} µM</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Biological Source</h3>
                <div class="detail-row">
                    <div class="detail-label">Organism:</div>
                    <div class="detail-value">${peptide.source_organism || 'N/A'}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Blood-Brain Barrier Penetration</h3>
                <div class="detail-row">
                    <div class="detail-label">Permeability Value:</div>
                    <div class="detail-value">${peptide.bbb_permeability_value || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Transport Type:</div>
                    <div class="detail-value">${peptide.bbb_transport_type || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Model:</div>
                    <div class="detail-value">${peptide.bbb_model || 'N/A'}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>Toxicity & Stability</h3>
                <div class="detail-row">
                    <div class="detail-label">Hemolysis (LC50):</div>
                    <div class="detail-value">${peptide.toxicity_hemolysis || 'N/A'} µM</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Serum Stability:</div>
                    <div class="detail-value">${peptide.stability_serum || 'N/A'} h</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Synergy:</div>
                    <div class="detail-value">${peptide.synergy || 'N/A'}</div>
                </div>
            </div>
            
            <div class="detail-section">
                <h3>References</h3>
                <div class="detail-row">
                    <div class="detail-label">PMID:</div>
                    <div class="detail-value">${peptide.pmid || 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">DOI:</div>
                    <div class="detail-value">${peptide.doi ? `<a href="https://doi.org/${peptide.doi}" target="_blank">${peptide.doi}</a>` : 'N/A'}</div>
                </div>
                <div class="detail-row">
                    <div class="detail-label">Notes:</div>
                    <div class="detail-value">${peptide.notes || 'N/A'}</div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('peptideDetail').innerHTML = html;
    
    // Render structure visualizations
    setTimeout(() => {
        render3DStructure(sequence, peptide.structure_type, secondaryStructure);
        render2DStructure(sequence, secondaryStructure);
        renderSequenceWithStructure(sequence, secondaryStructure);
        
        // Initialize with 3D view
        switchViewTab('3d');
    }, 100);
}

// Make structure control functions globally available
window.switchViewTab = switchViewTab;
window.rotateStructure = rotateStructure;
window.resetView = resetView;

// Make functions globally available
window.searchPeptides = searchPeptides;
window.resetFilters = resetFilters;
window.setView = setView;
window.sortBy = sortBy;

// Start loading data when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadCSV();
});
