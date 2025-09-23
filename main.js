/* ----------  JSON LOADERS  ---------- */
async function loadProjects() {
  const res = await fetch('data.json');
  if (!res.ok) throw new Error('Erreur chargement data.json');
  return await res.json();          // researchProjects
}
async function loadCompanies() {
  const res = await fetch('companies.json');
  if (!res.ok) throw new Error('Erreur chargement companies.json');
  return await res.json();          // array of company objects
}
/* ----------  END LOADERS  ---------- */

// Variables globales
let selectedRegion = null;
let currentResults = [];      // projets de recherche
let allProjects   = [];
let researchProjects = {};    // sera rempli après le fetch
let companies     = [];       // NEW – entreprises / labs
let filteredCompanies = [];   // NEW – après filtres

const tooltip = document.querySelector('.tooltip');

// NEW – petite projection très rapide (France métro)
function project([lat, lon]) {
  const x =  980 * (lon + 5.5) / 11;   // -5.5° … +5.5°
  const y =  980 * (50.5 - lat) / 12;  // 50.5° … 38.5°
  return [x, y];
}

// NEW – affiche/masque les marqueurs entreprise
function renderCompanyMarkers() {
  const pinGroup = document.getElementById('company-pins');
  if (!pinGroup) return;
  pinGroup.innerHTML = '';

  filteredCompanies.forEach(c => {
    const [cx, cy] = project([c.lat, c.lon]);
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#pin-entreprise');
    use.setAttribute('x', String(cx - 12));
    use.setAttribute('y', String(cy - 24));
    use.setAttribute('width', '24');
    use.setAttribute('height', '24');
    use.style.cursor = 'pointer';

    use.addEventListener('click', () => {
      displayCompanyDetails(c);
    });
    use.addEventListener('mouseenter', e => {
      tooltip.innerHTML = `<strong>${c.name}</strong>`;
      updateTooltipPosition(e);
      tooltip.classList.add('visible');
    });
    use.addEventListener('mouseleave', () => tooltip.classList.remove('visible'));
    pinGroup.appendChild(use);
  });
}

// NEW – applique les filtres HTML aux entreprises
function applyCompanyFilters() {
    const industriesChecked = document.getElementById('industries').checked;
    if (!industriesChecked) {
        filteredCompanies = [];
        renderCompanyMarkers();
        return;
    }

    const domain = document.getElementById('techniqueFilter').value;
    const location = document.getElementById('location').value;
    const startupChecked = document.getElementById('startup').checked;
    const pmeChecked = document.getElementById('pme').checked;
    const grandeChecked = document.getElementById('grande').checked;

    filteredCompanies = companies.filter(c => {
        if (domain && c.domain !== domain) return false;
        
        // Normalize region name from data to match filter value
        const regionNormalized = c.region.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/ /g, '-');
        if (location && regionNormalized !== location) return false;

        const type = c.type.toLowerCase();
        if (!startupChecked && type === 'startup') return false;
        if (!pmeChecked && type === 'pme') return false;
        if (!grandeChecked && type.includes('grande')) return false;

        return true;
    });
    renderCompanyMarkers();
}


// Initialisation
document.addEventListener('DOMContentLoaded', async () => {
  try {
    [researchProjects, companies] = await Promise.all([loadProjects(), loadCompanies()]);
    flattenProjects();
    updateDashboard();
  } catch (e) {
    console.error(e);
    researchProjects = {}; allProjects = []; companies = [];
  }

  initializeMap();
  setupEventListeners();
  setupToggleButtons();
  injectLabPins();
  showWelcomeMessage();

  applyCompanyFilters(); // premier rendu
  applyFilters(); // premier rendu
});


// Aplatir tous les projets pour la recherche
function flattenProjects() {
    allProjects = [];
    for (const region in researchProjects) {
        researchProjects[region].forEach(project => {
            allProjects.push({ ...project, region });
        });
    }
}

function clearLabPins() {
    const pinGroup = document.getElementById('lab-pins');
    if (pinGroup) {
        pinGroup.innerHTML = '';
    }
}

// Injection des drapeaux « lab-pin »
function injectLabPins() {
    clearLabPins();
    const labsChecked = document.getElementById('laboratories').checked;
    if (!labsChecked) {
        return;
    }

    const pinGroup = document.getElementById('lab-pins');
    if (!pinGroup) return;                       // sécurité si le groupe n’existe pas

    const cityCoords = {                        // coordonnées cx/cy des labos
        "INRIA Paris"         : { cx: 512, cy: 270 },
        "Sorbonne Université" : { cx: 512, cy: 275 },
        "Université de Caen"  : { cx: 380, cy: 249 }
    };

    allProjects.forEach(p => {
        const c = cityCoords[p.institution];
        if (!c) return;

        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#pin');
        use.setAttribute('x', String(c.cx - 12));
        use.setAttribute('y', String(c.cy - 24));
        use.setAttribute('width', '24');
        use.setAttribute('height', '24');
        use.classList.add('lab-pin');
        use.style.cursor = 'pointer';
        use.setAttribute('data-project', p.title);

        // tooltip au survol du pin
        use.addEventListener('mouseenter', e => {
            showTooltip(e, `${p.institution}`);
        });
        use.addEventListener('mouseleave', hideTooltip);

        pinGroup.appendChild(use);
    });
}

function setupEventListeners() {
    // Filtres en temps réel
    const projectFilterIds = ['domainFilter', 'budgetFilter', 'statusFilter', 'yearFilter'];
    projectFilterIds.forEach(id => document.getElementById(id).addEventListener('change', applyFilters));

    const companyFilterIds = ['techniqueFilter', 'startup', 'pme', 'grande'];
    companyFilterIds.forEach(id => document.getElementById(id).addEventListener('change', applyCompanyFilters));

    const actorCheckboxes = ['laboratories', 'industries', 'projects'];
    actorCheckboxes.forEach(id => document.getElementById(id).addEventListener('change', () => {
        if (id === 'industries') {
            applyCompanyFilters();
        } else if (id === 'laboratories') {
            injectLabPins();
        } else {
            applyFilters();
        }
    }));
    
    // Recherche en temps réel
    document.getElementById('searchInput').addEventListener('input', performSearch);
    
    // Fermer modal au clic extérieur
    document.getElementById('contactModal').addEventListener('click', function(e) {
        if (e.target === this) {
            closeContactModal();
        }
    });
    
    // Formulaire de contact
    document.getElementById('contactForm').addEventListener('submit', function(e) {
        e.preventDefault();
        alert('Message envoyé avec succès !');
        closeContactModal();
        this.reset();
    });

    // Formulaire de soumission
    document.getElementById('submissionForm').addEventListener('submit', function(e) {
        e.preventDefault();
        alert('Projet soumis avec succès !');
        closeSubmissionModal();
        this.reset();
    });

    // Dashboard toggle
    const toggleDashboardBtn = document.getElementById('toggle-dashboard-btn');
    const dashboard = document.getElementById('dashboard');
    dashboard.style.display = 'none'; // Cacher par défaut
    toggleDashboardBtn.addEventListener('click', () => {
        if (dashboard.style.display === 'none') {
            dashboard.style.display = 'block';
            toggleDashboardBtn.textContent = 'Cacher le Dashboard';
        } else {
            dashboard.style.display = 'none';
            toggleDashboardBtn.textContent = 'Afficher le Dashboard';
        }
    });
}

function setupToggleButtons() {
    const projectBtn = document.getElementById('projectFilterBtn');
    const companyBtn = document.getElementById('companyFilterBtn');
    const projectSpecificFilters = document.getElementById('project-specific-filters');
    const companySpecificFilters = document.getElementById('company-specific-filters');

    projectBtn.addEventListener('click', () => {
        projectBtn.classList.add('active');
        companyBtn.classList.remove('active');
        projectSpecificFilters.style.display = 'block';
        companySpecificFilters.style.display = 'none';
    });

    companyBtn.addEventListener('click', () => {
        companyBtn.classList.add('active');
        projectBtn.classList.remove('active');
        projectSpecificFilters.style.display = 'none';
        companySpecificFilters.style.display = 'block';
    });

    // Initial state
    projectBtn.click();
}
function initializeMap() {
    const regions = document.querySelectorAll('.region-clickable');
    
    regions.forEach(region => {
        const regionName = region.getAttribute('data-region');
        
        region.addEventListener('mouseenter', function(e) {
            if (!this.classList.contains('selected')) {
                this.style.fill = '#ef4444';
            }
        });
        
        region.addEventListener('mouseleave', function(e) {
            if (!this.classList.contains('selected')) {
                this.style.fill = this.classList.contains('has-results') ? '#f59e0b' : '#3b82f6';
            }
        });
        
        region.addEventListener('mousemove', function(e) {
            updateTooltipPosition(e);
        });
        
        region.addEventListener('click', function(e) {
            selectRegion(this, regionName);
        });
    });
}

function showTooltip(event, regionName) {
    const projectCount = researchProjects[regionName]?.length || 0;
    tooltip.style.opacity = '1';
    tooltip.innerHTML = `${regionName}<br><small>${projectCount} projet(s)</small>`;
    updateTooltipPosition(event);
}
function hideTooltip() {
    tooltip.style.opacity = '0';
}
function updateTooltipPosition(event) {
    const mapContainer = document.querySelector('.map-container');
    const mapRect = mapContainer.getBoundingClientRect();
    
    const left = event.clientX - mapRect.left + 15;
    const top = event.clientY - mapRect.top - 30;

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}
function selectRegion(regionElement, regionName) {
    // Retirer la sélection précédente
    if (selectedRegion) {
        selectedRegion.classList.remove('selected');
        selectedRegion.style.fill = selectedRegion.classList.contains('has-results') ? '#f59e0b' : '#3b82f6';
    }
    
    // Sélectionner la nouvelle région
    regionElement.classList.add('selected');
    regionElement.style.fill = '#10b981';
    selectedRegion = regionElement;
    
    // Effacer les filtres et afficher les projets de la région
    clearAllFilters();
    displayRegionProjects(regionName);
}

function displayRegionProjects(regionName) {
    currentResults = researchProjects[regionName] || [];
    updateSidebar(`🔬 ${regionName}`, currentResults);
}
function performSearch() {
    const query = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (query === '') {
        if (selectedRegion) {
            const regionName = selectedRegion.getAttribute('data-region');
            displayRegionProjects(regionName);
        } else {
            showWelcomeMessage();
        }
        updateMapHighlights([]);
        return;
    }
    
    const results = allProjects.filter(project => {
        return project.title.toLowerCase().includes(query) ||
                project.institution.toLowerCase().includes(query) ||
                project.description.toLowerCase().includes(query) ||
                project.domain.toLowerCase().includes(query);
    });
    
    currentResults = results;
    updateSidebar(`🔍 Résultats de recherche: "${query}"`, applyCurrentFilters(results));
}
function applyFilters() {
    const projectsChecked = document.getElementById('projects').checked;
    if (!projectsChecked) {
        updateSidebar('Projets', []);
        updateMapHighlights([]);
        return;
    }

    const baseResults = currentResults.length > 0 ? currentResults : allProjects;
    const filteredResults = applyCurrentFilters(baseResults);
    
    const title = document.getElementById('searchInput').value.trim() ? 
                    `🔍 Résultats filtrés` : 
                    selectedRegion ? `🔬 ${selectedRegion.getAttribute('data-region')} - Filtré` : '🔧 Résultats filtrés';
    
    updateSidebar(title, filteredResults);
    updateMapHighlights(filteredResults);
}
function applyCurrentFilters(projects) {
    const domain = document.getElementById('domainFilter').value;
    const budget = document.getElementById('budgetFilter').value;
    const status = document.getElementById('statusFilter').value;
    const year = document.getElementById('yearFilter').value;
    
    return projects.filter(project => {
        if (domain && project.domain !== domain) return false;
        if (status && project.status !== status) return false;
        if (year && project.year.toString() !== year) return false;
        
        if (budget) {
            const [min, max] = budget.split('-').map(v => v === '+' ? Infinity : parseFloat(v));
            if (max !== undefined) {
                if (project.budgetValue < min || project.budgetValue > max) return false;
            } else if (min === 3 && project.budgetValue < 3) return false;
        }
        
        return true;
    });
}
function clearAllFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('domainFilter').value = '';
    document.getElementById('techniqueFilter').value = '';
    document.getElementById('budgetFilter').value = '';
    document.getElementById('statusFilter').value = '';
    document.getElementById('yearFilter').value = '';
    
    if (selectedRegion) {
        const regionName = selectedRegion.getAttribute('data-region');
        displayRegionProjects(regionName);
    } else {
        showWelcomeMessage();
    }
}
function updateSidebar(title, projects) {
    document.getElementById('sidebarTitle').textContent = title;
    document.getElementById('resultsCount').textContent = `${projects.length} projet(s) trouvé(s)`;
    
    const sidebarContent = document.querySelector('.sidebar-content');
    
    if (projects.length === 0) {
        sidebarContent.innerHTML = `
            <div class="no-results">
                <p>😔 Aucun projet trouvé</p>
                <p>Essayez de modifier vos critères de recherche</p>
            </div>
        `;
        return;
    }
    sidebarContent.innerHTML = '';
    projects.forEach(project => {
        sidebarContent.innerHTML += createProjectCard(project);
    });
}

function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
        <div class="project-header">
            <div class="project-title">${project.title}</div>
            <div class="project-status ${project.status}">${getStatusText(project.status)}</div>
        </div>
        
        <div class="project-meta">
            <div class="project-institution">📍 ${project.institution}</div>
            <div class="project-year">📅 ${project.year}</div>
        </div>
        
        <div class="project-type">${project.domain} • ${project.type}</div>
        
        <div class="project-description">${project.description}</div>
        
        <div class="project-footer">
            <div class="project-budget">💰 Budget: ${project.budget}</div>
            <div class="project-actions">
                <a href="${project.website}" target="_blank" class="btn-link">🌐 Site web</a>
                <button class="btn-contact" onclick="openContactModal('${project.title}', '${project.contact}')">✉️ Contact</button>
                <a href="fiches/${project.title.toLowerCase().replace(/ /g, '_')}.pdf" download class="btn-link">📄 Télécharger PDF</a>
            </div>
        </div>
    `;
    card.addEventListener('click', (e) => {
        if (e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON') {
            openDetailView(project, 'project');
        }
    });
    return card.outerHTML;
}
function createProjectCard(project) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
        <div class="project-header">
            <div class="project-title">${project.title}</div>
            <div class="project-status ${project.status}">${getStatusText(project.status)}</div>
        </div>
        
        <div class="project-meta">
            <div class="project-institution">📍 ${project.institution}</div>
            <div class="project-year">📅 ${project.year}</div>
        </div>
        
        <div class="project-type">${project.domain} • ${project.type}</div>
        
        <div class="project-description">${project.description}</div>
        
        <div class="project-footer">
            <div class="project-budget">💰 Budget: ${project.budget}</div>
            <div class="project-actions">
                <a href="${project.website}" target="_blank" class="btn-link">🌐 Site web</a>
                <button class="btn-contact" onclick="openContactModal('${project.title}', '${project.contact}')">✉️ Contact</button>
                <a href="fiches/${project.title.toLowerCase().replace(/ /g, '_')}.pdf" download class="btn-link">📄 Télécharger PDF</a>
            </div>
        </div>
    `;
    card.addEventListener('click', (e) => {
        if (e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON') {
            openDetailView(project, 'project');
        }
    });
    return card.outerHTML;
}

function updateDashboard() {
    const totalProjectsElement = document.getElementById('total-projects');
    const totalCompaniesElement = document.getElementById('total-companies');

    if (!totalProjectsElement || !totalCompaniesElement) return;

    const totalProjects = allProjects.length;
    const totalCompanies = companies.length;

    totalProjectsElement.textContent = totalProjects;
    totalCompaniesElement.textContent = totalCompanies;

    const projectsByDomain = allProjects.reduce((acc, project) => {
        acc[project.domain] = (acc[project.domain] || 0) + 1;
        return acc;
    }, {});

    const companiesByDomain = companies.reduce((acc, company) => {
        acc[company.domain] = (acc[company.domain] || 0) + 1;
        return acc;
    }, {});

    const projectsChartCtx = document.getElementById('projects-by-domain-chart').getContext('2d');
    new Chart(projectsChartCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(projectsByDomain),
            datasets: [{
                label: 'Projets par Domaine',
                data: Object.values(projectsByDomain),
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)',
                    'rgba(255, 159, 64, 0.7)',
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                ],
            }]
        },
    });

    const companiesChartCtx = document.getElementById('companies-by-domain-chart').getContext('2d');
    new Chart(companiesChartCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(companiesByDomain),
            datasets: [{
                label: 'Entreprises par Domaine',
                data: Object.values(companiesByDomain),
                backgroundColor: [
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                    'rgba(255, 206, 86, 0.7)',
                    'rgba(75, 192, 192, 0.7)',
                    'rgba(153, 102, 255, 0.7)',
                    'rgba(255, 159, 64, 0.7)',
                    'rgba(255, 99, 132, 0.7)',
                    'rgba(54, 162, 235, 0.7)',
                ],
            }]
        },
    });
}

function createCompanyCard(company) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.innerHTML = `
        <div class="project-header">
            <div class="project-title">${company.name}</div>
        </div>
        
        <div class="project-meta">
            <div class="project-institution">📍 ${company.region}</div>
        </div>
        
        <div class="project-type">${company.domain} • ${company.type}</div>
        
        <div class="project-description">
            <p><strong>Expertises:</strong> ${company['Expertises particulires'] || 'Non spécifiées'}</p>
            <p><strong>Adresse:</strong> ${company.Adresse || 'Non spécifiée'}</p>
        </div>
        
        <div class="project-footer">
            <div class="project-contact">
                <p><strong>Contact:</strong> ${company.Contact || 'Non spécifié'}</p>
                <p><strong>Mail:</strong> ${company.Mail ? `<a href="mailto:${company.Mail}">${company.Mail}</a>` : 'Non spécifié'}</p>
            </div>
            <div class="project-actions">
                ${company['Site web'] ? `<a href="${company['Site web']}" target="_blank" class="btn-link">🌐 Site web</a>` : ''}
                <button class="btn-contact" onclick="openContactModal('${company.name}')">✉️ Contact</button>
            </div>
        </div>
    `;
    card.addEventListener('click', (e) => {
        if (e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON') {
            openDetailView(company, 'company');
        }
    });
    return card.outerHTML;
}

function displayCompanyDetails(company) {
    document.getElementById('sidebarTitle').textContent = `🏢 ${company.name}`;
    document.getElementById('resultsCount').textContent = `Détails de l'entreprise`;

    const sidebarContent = document.querySelector('.sidebar-content');
    sidebarContent.innerHTML = createCompanyCard(company);
}

function getStatusText(status) {
    const statusMap = {
        'en-cours': 'En cours',
        'planifie': 'Planifié',
        'termine': 'Terminé'
    };
    return statusMap[status] || status;
}
function updateMapHighlights(results) {
    const regions = document.querySelectorAll('.region-clickable');
    const regionsWithResults = [...new Set(results.map(p => p.region))];
    
    regions.forEach(region => {
        region.classList.remove('has-results');
        
        if (regionsWithResults.includes(region.getAttribute('data-region'))) {
            region.classList.add('has-results');
            region.style.fill = '#f59e0b';
        } else if (!region.classList.contains('selected')) {
            region.style.fill = '#3b82f6';
        }
    });
}
function showWelcomeMessage() {
    document.getElementById('sidebarTitle').textContent = '🔍 Recherche Interactive';
    document.getElementById('resultsCount').textContent = 'Sélectionnez une région ou effectuez une recherche';
    
    document.querySelector('.sidebar-content').innerHTML = `
        <div class="welcome-message">
            <p><strong>💡 Comment utiliser :</strong></p>
            <p>• Utilisez la barre de recherche pour trouver des projets spécifiques</p>
            <p>• Filtrez par domaine, budget, statut ou année</p>
            <p>• Cliquez sur une région pour voir tous ses projets</p>
            <p>• Contactez directement les équipes de recherche</p>
        </div>
    `;
}
// Raccourcis clavier
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeContactModal();
    }
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
});

// --- Fonctions modales (doivent être GLOBALES si appelées par onclick dans le HTML)
function openContactModal(context = "") {
  const modal = document.getElementById("contactModal");
  const titleEl = document.getElementById("contactTitle");
  const form = document.getElementById("contactForm");

  if (!modal) return;
  if (titleEl) {
    titleEl.textContent = context
      ? `Contacter l'équipe — ${context}`
      : `Contacter l'équipe`;
  }
  if (form) form.reset();
  modal.style.display = "block";
}

function closeContactModal() {
  const modal = document.getElementById("contactModal");
  if (modal) modal.style.display = "none";
}

function openSubmissionModal() {
  const modal = document.getElementById("submissionModal");
  if (modal) modal.style.display = "block";
}

function closeSubmissionModal() {
  const modal = document.getElementById("submissionModal");
  if (modal) modal.style.display = "none";
}

// Rendre les fonctions accessibles aux attributs HTML (onclick="...")
window.openContactModal = openContactModal;
window.closeContactModal = closeContactModal;
window.openSubmissionModal = openSubmissionModal;
window.closeSubmissionModal = closeSubmissionModal;

// --- Init UI
document.addEventListener("DOMContentLoaded", () => {
  const regions = document.querySelectorAll(".region-clickable");
  const sidebarTitle = document.getElementById("sidebarTitle");
  const resultsCount = document.getElementById("resultsCount");
  const regionInfo = document.getElementById("region-info");
  const tooltip = document.querySelector(".tooltip");
  const contactModal = document.getElementById("contactModal");
  const contactForm = document.getElementById("contactForm");
  
  // Carte interactive
  regions.forEach(region => {
    region.style.cursor = "pointer";
            
    region.addEventListener('mouseenter', function (e) {
        const regionName = this.getAttribute('data-region');
        if (!this.classList.contains('selected')) {
            this.style.fill = '#ef4444';
        }
        showTooltip(e, regionName);   // <-- appel corrigé
    });

    region.addEventListener('mousemove', function (e) {
        updateTooltipPosition(e);
    });

    region.addEventListener('mouseleave', function () {
        this.style.fill = this.classList.contains('selected')
            ? '#10b981'
            : (this.classList.contains('has-results') ? '#f59e0b' : '#3b82f6');
        hideTooltip();
    });

    region.addEventListener("click", () => {
      const regionName = region.getAttribute("data-region") || "Région";
      if (sidebarTitle) sidebarTitle.textContent = `📍 ${regionName}`;
      if (resultsCount) resultsCount.textContent = `Projets trouvés pour ${regionName}`;

      // Exemple de contenu avec un bouton de contact qui appelle openContactModal
      if (regionInfo) {
        regionInfo.innerHTML = `
          <div class="region-details">
            <h3>${regionName}</h3>
            <ul>
              <li>Projet A — en cours <button class="mini-btn" onclick="openContactModal('Projet A')">Contacter</button></li>
              <li>Projet B — terminé <button class="mini-btn" onclick="openContactModal('Projet B')">Contacter</button></li>
              <li>Projet C — planifié <button class="mini-btn" onclick="openContactModal('Projet C')">Contacter</button></li>
            </ul>
          </div>
        `;
      }
    });
  });

  // Comportements du modal (fermeture sur fond / ESC / submit)
  if (contactModal) {
    contactModal.addEventListener("click", (e) => {
      if (e.target === contactModal) closeContactModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeContactModal();
  });
  if (contactForm) {
    contactForm.addEventListener("submit", (e) => {
      e.preventDefault();
      // Ici tu peux envoyer les données…
      alert("Message envoyé ✅");
      closeContactModal();
    });
  }
});

// Initialiser l'affichage
showWelcomeMessage();
