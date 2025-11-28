// admin.js - Gestion de l'interface administrateur OptiTime
(function () {
    const state = {
        currentAdmin: null,
        users: [],
        filteredUsers: [],
        logData: [],
        logFileHandle: null,
        totpInterval: null,
        totpUserId: null,
        pendingCredentials: null,
        pendingUser: null,
        pendingOtpUrl: null,
    };

    const selectors = {
        loginSection: () => document.getElementById('adminLoginSection'),
        loginForm: () => document.getElementById('adminCredentialsForm'),
        loginError: () => document.getElementById('adminLoginError'),
        badge: () => document.getElementById('adminStatusBadge'),
        logoutBtn: () => document.getElementById('btnAdminLogout'),
        adminApp: () => document.getElementById('adminApp'),
        welcome: () => document.getElementById('adminWelcome'),
        adminEmail: () => document.getElementById('adminEmail'),
        adminPassword: () => document.getElementById('adminPassword'),
        adminTotpInput: () => document.getElementById('adminTotpCode'),
        userTableBody: () => document.getElementById('userTableBody'),
        userSearch: () => document.getElementById('userSearch'),
        roleFilter: () => document.getElementById('roleFilter'),
        newUserBtn: () => document.getElementById('btnNewUser'),
        userModal: () => document.getElementById('userModal'),
        userModalTitle: () => document.getElementById('userModalTitle'),
        userForm: () => document.getElementById('userForm'),
        userFormError: () => document.getElementById('userFormError'),
        userId: () => document.getElementById('userId'),
        userName: () => document.getElementById('userName'),
        userEmail: () => document.getElementById('userEmail'),
        userPassword: () => document.getElementById('userPassword'),
        userRole: () => document.getElementById('userRole'),
        userActive: () => document.getElementById('userActive'),
        logStatus: () => document.getElementById('adminLogStatus'),
        openLogBtn: () => document.getElementById('btnOpenLogFile'),
        logUserFilter: () => document.getElementById('logUserFilter'),
        logActionFilter: () => document.getElementById('logActionFilter'),
        logStartDate: () => document.getElementById('logStartDate'),
        logEndDate: () => document.getElementById('logEndDate'),
        logTableBody: () => document.getElementById('logTableBody'),
        exportCsv: () => document.getElementById('btnExportCsv'),
        exportExcel: () => document.getElementById('btnExportExcel'),
        exportPdf: () => document.getElementById('btnExportPdf'),
        totpModal: () => document.getElementById('totpModal'),
        totpSecretField: () => document.getElementById('totpSecretField'),
        totpUriField: () => document.getElementById('totpUriField'),
        totpPreview: () => document.getElementById('totpCodePreview'),
        totpQrCanvas: () => document.getElementById('totpQrCanvas'),
        copySecretBtn: () => document.getElementById('copySecretBtn'),
        copyUriBtn: () => document.getElementById('copyUriBtn'),
        resetTotpBtn: () => document.getElementById('resetTotpBtn'),
        loginQrCanvas: () => document.getElementById('adminQrCanvas'),
        loginQrSecretField: () => document.getElementById('adminQrSecret'),
        copyLoginQrSecretBtn: () => document.getElementById('copyAdminQrSecret'),
        qrContinueBtn: () => document.getElementById('adminQrContinue'),
        qrBackBtn: () => document.getElementById('adminQrBack'),
        totpForm: () => document.getElementById('adminTotpForm'),
        totpBackBtn: () => document.getElementById('adminTotpBack'),
        totpError: () => document.getElementById('adminTotpError'),
        credentialsStep: () => document.getElementById('adminStepCredentials'),
        qrStep: () => document.getElementById('adminStepQr'),
        totpStep: () => document.getElementById('adminStepTotp'),
        toast: () => document.getElementById('adminToast'),
    };

    document.addEventListener('DOMContentLoaded', async () => {
        if (window.themeManager) {
            window.themeManager.init();
        }
        if (window.clockManager) {
            window.clockManager.init();
        }
        document.getElementById('themeToggle').addEventListener('click', () => {
            if (window.themeManager) {
                window.themeManager.toggle();
            }
        });

        await window.AuthService.ready();
        bindEvents();
        hydrateSession();
    });

    function bindEvents() {
        selectors.loginForm().addEventListener('submit', onAdminCredentialsSubmit);
        selectors.qrContinueBtn().addEventListener('click', onAdminQrContinue);
        selectors.qrBackBtn().addEventListener('click', () => {
            resetPendingAuth();
            showAuthStep('credentials');
        });
        selectors.copyLoginQrSecretBtn().addEventListener('click', () => copyToClipboard(selectors.loginQrSecretField().value, 'Secret copié'));
        selectors.totpForm().addEventListener('submit', onAdminTotpSubmit);
        selectors.totpBackBtn().addEventListener('click', () => {
            setTotpError('');
            showAuthStep('qr');
        });
        selectors.logoutBtn().addEventListener('click', onAdminLogout);
        selectors.newUserBtn().addEventListener('click', () => openUserModal());
        selectors.userSearch().addEventListener('input', debounce(renderUserTable, 200));
        selectors.roleFilter().addEventListener('change', renderUserTable);
        selectors.userTableBody().addEventListener('click', handleUserTableAction);
        selectors.userForm().addEventListener('submit', handleUserFormSubmit);

        document.querySelectorAll('[data-close]').forEach(btn => {
            btn.addEventListener('click', () => closeModal(btn.dataset.close));
        });

        selectors.copySecretBtn().addEventListener('click', () => copyToClipboard(selectors.totpSecretField().value, 'Secret copié'));
        selectors.copyUriBtn().addEventListener('click', () => copyToClipboard(selectors.totpUriField().value, 'URI copié'));
        selectors.resetTotpBtn().addEventListener('click', onResetTotp);

        selectors.openLogBtn().addEventListener('click', openLogFile);
        [selectors.logUserFilter(), selectors.logActionFilter(), selectors.logStartDate(), selectors.logEndDate()].forEach(input => {
            input.addEventListener('change', renderLogTable);
        });
        selectors.exportCsv().addEventListener('click', () => exportLogs('csv'));
        selectors.exportExcel().addEventListener('click', () => exportLogs('excel'));
        selectors.exportPdf().addEventListener('click', () => exportLogs('pdf'));

        window.addEventListener('click', (event) => {
            const modal = event.target.closest('.modal');
            if (event.target === modal) {
                closeModal(modal.id);
            }
        });
    }

    function hydrateSession() {
        const admin = window.AuthService.requireRole('admin');
        if (admin) {
            state.currentAdmin = admin;
            selectors.loginSection().classList.add('hidden');
            selectors.adminApp().classList.remove('hidden');
            selectors.logoutBtn().classList.remove('hidden');
            updateBadge(`Connecté en tant que ${admin.name}`);
            selectors.welcome().textContent = `Bonjour ${admin.name}`;
            loadUsers();
        } else {
            selectors.loginSection().classList.remove('hidden');
            selectors.adminApp().classList.add('hidden');
            selectors.logoutBtn().classList.add('hidden');
            updateBadge('Accès réservé - Authentification requise', true);
        }
        resetPendingAuth();
        selectors.loginForm().reset();
        selectors.totpForm().reset();
        showAuthStep('credentials');
        setCredentialsError('');
        setTotpError('');
    }

    function updateBadge(text, warning = false) {
        const badge = selectors.badge();
        badge.textContent = text;
        badge.classList.toggle('warning', Boolean(warning));
    }

    function showAuthStep(step) {
        const steps = {
            credentials: selectors.credentialsStep(),
            qr: selectors.qrStep(),
            totp: selectors.totpStep(),
        };
        Object.entries(steps).forEach(([name, el]) => {
            if (!el) return;
            el.classList.toggle('hidden', name !== step);
        });
        if (step === 'qr' && state.pendingOtpUrl) {
            renderLoginQr(state.pendingOtpUrl);
        }
        if (step === 'credentials') {
            selectors.loginForm().reset();
        }
    }

    function resetPendingAuth() {
        state.pendingCredentials = null;
        state.pendingUser = null;
        state.pendingOtpUrl = null;
        if (selectors.loginQrSecretField()) {
            selectors.loginQrSecretField().value = '';
        }
        clearCanvas(selectors.loginQrCanvas());
    }

    async function onAdminCredentialsSubmit(event) {
        event.preventDefault();
        setCredentialsError('');
        const email = selectors.adminEmail().value.trim();
        const password = selectors.adminPassword().value;

        try {
            const result = await window.AuthService.verifyPassword({
                email,
                password,
                allowedRoles: ['admin'],
            });
            if (!result.requiresTotp) {
                await window.AuthService.login({
                    email,
                    password,
                    totpCode: '',
                    allowedRoles: ['admin'],
                });
                selectors.loginForm().reset();
                hydrateSession();
                showToast('Connexion réussie');
                return;
            }
            state.pendingCredentials = { email, password };
            state.pendingUser = result.user;
            state.pendingOtpUrl = result.otpAuthUrl;
            selectors.loginQrSecretField().value = result.user.totpSecret || '';
            renderLoginQr(result.otpAuthUrl);
            showAuthStep('qr');
        } catch (error) {
            setCredentialsError(error.message || 'Identifiants invalides');
        }
    }

    function onAdminQrContinue() {
        if (!state.pendingCredentials) {
            setCredentialsError('Veuillez d\'abord valider vos identifiants.');
            showAuthStep('credentials');
            return;
        }
        setTotpError('');
        selectors.adminTotpInput().value = '';
        showAuthStep('totp');
        selectors.adminTotpInput().focus();
    }

    async function onAdminTotpSubmit(event) {
        event.preventDefault();
        setTotpError('');
        const totpCode = selectors.adminTotpInput().value.trim();
        if (!state.pendingCredentials) {
            setTotpError('Session expirée. Veuillez recommencer.');
            showAuthStep('credentials');
            return;
        }

        try {
            await window.AuthService.login({
                email: state.pendingCredentials.email,
                password: state.pendingCredentials.password,
                totpCode,
                allowedRoles: ['admin'],
            });
            selectors.totpForm().reset();
            selectors.loginForm().reset();
            hydrateSession();
            showToast('Connexion réussie');
        } catch (error) {
            setTotpError(error.message || 'Code invalide');
        }
    }

    function setCredentialsError(message) {
        const errorEl = selectors.loginError();
        if (!message) {
            errorEl.classList.add('hidden');
            errorEl.textContent = '';
        } else {
            errorEl.textContent = message;
            errorEl.classList.remove('hidden');
        }
    }

    function setTotpError(message) {
        const el = selectors.totpError();
        if (!message) {
            el.classList.add('hidden');
            el.textContent = '';
        } else {
            el.textContent = message;
            el.classList.remove('hidden');
        }
    }

    function onAdminLogout() {
        window.AuthService.logout();
        state.currentAdmin = null;
        hydrateSession();
        showToast('Déconnexion effectuée');
    }

    function loadUsers() {
        state.users = window.AuthService.getUsers().sort((a, b) =>
            a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' })
        );
        renderUserTable();
    }

    function renderUserTable() {
        const tbody = selectors.userTableBody();
        const search = selectors.userSearch().value.trim().toLowerCase();
        const roleFilter = selectors.roleFilter().value;

        const filtered = state.users.filter(user => {
            const matchesRole = roleFilter === 'all' || user.role === roleFilter;
            const matchesSearch =
                user.name.toLowerCase().includes(search) ||
                user.email.toLowerCase().includes(search);
            return matchesRole && matchesSearch;
        });

        if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="no-data">Aucun utilisateur.</td></tr>';
            return;
        }

        const rows = filtered.map(user => {
            const statusClass = user.isActive ? 'active' : 'inactive';
            const statusLabel = user.isActive ? 'Actif' : 'Désactivé';
            return `
                <tr>
                    <td>${user.name}</td>
                    <td>${user.email}</td>
                    <td>${user.role === 'admin' ? 'Admin' : 'Utilisateur'}</td>
                    <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                    <td>
                        <div class="table-actions">
                            <button class="btn-tertiary" data-action="totp" data-id="${user.id}">🔐 Secret</button>
                            <button class="btn-tertiary" data-action="edit" data-id="${user.id}">✏️ Modifier</button>
                            <button class="btn-tertiary" data-action="toggle" data-id="${user.id}">
                                ${user.isActive ? '⏸️ Désactiver' : '▶️ Activer'}
                            </button>
                            <button class="btn-tertiary" data-action="reset-password" data-id="${user.id}">🔁 Mot de passe</button>
                            <button class="btn-tertiary" data-action="delete" data-id="${user.id}">🗑️ Supprimer</button>
                        </div>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = rows.join('');
    }

    function handleUserTableAction(event) {
        const btn = event.target.closest('button[data-action]');
        if (!btn) return;
        const userId = btn.dataset.id;
        switch (btn.dataset.action) {
            case 'totp':
                openTotpModal(userId);
                break;
            case 'edit':
                openUserModal(userId);
                break;
            case 'toggle':
                toggleUserStatus(userId);
                break;
            case 'reset-password':
                promptResetPassword(userId);
                break;
            case 'delete':
                deleteUser(userId);
                break;
            default:
                break;
        }
    }

    function openUserModal(userId = '') {
        const isEdit = Boolean(userId);
        selectors.userModalTitle().textContent = isEdit ? 'Modifier un utilisateur' : 'Nouvel utilisateur';
        selectors.userForm().reset();
        selectors.userFormError().classList.add('hidden');
        selectors.userId().value = userId;

        if (isEdit) {
            const user = state.users.find(u => u.id === userId);
            if (!user) return;
            selectors.userName().value = user.name;
            selectors.userEmail().value = user.email;
            selectors.userRole().value = user.role;
            selectors.userActive().value = user.isActive ? 'true' : 'false';
            selectors.userEmail().disabled = true;
        } else {
            selectors.userEmail().disabled = false;
        }

        openModal('userModal');
    }

    async function handleUserFormSubmit(event) {
        event.preventDefault();
        selectors.userFormError().classList.add('hidden');

        const id = selectors.userId().value;
        const payload = {
            name: selectors.userName().value.trim(),
            email: selectors.userEmail().value.trim(),
            role: selectors.userRole().value,
            isActive: selectors.userActive().value === 'true',
        };
        const password = selectors.userPassword().value;

        try {
            if (id) {
                await window.AuthService.updateUser(id, payload);
                if (password) {
                    await window.AuthService.resetPassword(id, password);
                }
                showToast('Utilisateur mis à jour');
            } else {
                if (!password) {
                    throw new Error('Le mot de passe est obligatoire pour créer un utilisateur.');
                }
                await window.AuthService.createUser({ ...payload, password });
                showToast('Utilisateur créé');
            }
            closeModal('userModal');
            loadUsers();
        } catch (error) {
            selectors.userFormError().textContent = error.message || 'Erreur inattendue';
            selectors.userFormError().classList.remove('hidden');
        }
    }

    async function toggleUserStatus(userId) {
        const user = state.users.find(u => u.id === userId);
        if (!user) return;
        if (user.id === state.currentAdmin.id) {
            showToast('Impossible de désactiver votre propre compte.');
            return;
        }
        if (user.role === 'admin' && user.isActive && countAdmins() <= 1) {
            showToast('Au moins un administrateur actif est requis.');
            return;
        }
        await window.AuthService.updateUser(userId, { isActive: !user.isActive });
        loadUsers();
        showToast(`Utilisateur ${user.isActive ? 'désactivé' : 'activé'}`);
    }

    function countAdmins() {
        return state.users.filter(user => user.role === 'admin' && user.isActive).length;
    }

    async function promptResetPassword(userId) {
        const user = state.users.find(u => u.id === userId);
        if (!user) return;
        const newPassword = prompt(`Nouveau mot de passe pour ${user.name} (min. 8 caractères)`);
        if (!newPassword) return;
        if (newPassword.length < 8) {
            showToast('Mot de passe trop court.');
            return;
        }
        try {
            await window.AuthService.resetPassword(userId, newPassword);
            showToast('Mot de passe réinitialisé.');
        } catch (error) {
            showToast(error.message || 'Erreur lors de la réinitialisation.');
        }
    }

    async function deleteUser(userId) {
        const user = state.users.find(u => u.id === userId);
        if (!user) return;
        if (!confirm(`Supprimer définitivement ${user.name} ?`)) {
            return;
        }
        if (user.role === 'admin' && countAdmins() <= 1) {
            showToast('Impossible de supprimer le dernier administrateur.');
            return;
        }
        window.AuthService.deleteUser(userId);
        loadUsers();
        showToast('Utilisateur supprimé.');
    }

    function openTotpModal(userId) {
        const user = state.users.find(u => u.id === userId);
        if (!user) return;
        state.totpUserId = userId;
        const otpUrl = window.AuthService.getOtpAuthUrl(user);
        selectors.totpSecretField().value = user.totpSecret || '—';
        selectors.totpUriField().value = otpUrl;
        refreshTotpPreview();
        renderTotpQr(otpUrl);
        openModal('totpModal');
        if (state.totpInterval) {
            clearInterval(state.totpInterval);
        }
        state.totpInterval = setInterval(refreshTotpPreview, 30000);
    }

    async function refreshTotpPreview() {
        if (!state.totpUserId) return;
        const code = await window.AuthService.previewTotp(state.totpUserId);
        selectors.totpPreview().textContent = code || '------';
    }

    async function onResetTotp() {
        if (!state.totpUserId) return;
        try {
            const updated = await window.AuthService.resetTotp(state.totpUserId);
            const otpUrl = window.AuthService.getOtpAuthUrl(updated);
            selectors.totpSecretField().value = updated.totpSecret;
            selectors.totpUriField().value = otpUrl;
            refreshTotpPreview();
            renderTotpQr(otpUrl);
            showToast('Secret régénéré.');
            loadUsers();
        } catch (error) {
            showToast(error.message || 'Impossible de régénérer le secret.');
        }
    }

    async function openLogFile() {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{
                    description: 'Fichiers CSV',
                    accept: { 'text/csv': ['.csv'] },
                }],
                suggestedName: 'log.csv',
            });
            state.logFileHandle = handle;
            const text = await readCSVFile(handle);
            state.logData = parseLogCSV(text);
            selectors.logStatus().textContent = `✓ ${state.logData.length} entrées chargées`;
            updateLogUserFilter();
            renderLogTable();
            showToast('log.csv chargé');
        } catch (error) {
            if (error.name !== 'AbortError') {
                showToast(error.message || 'Chargement impossible');
            }
        }
    }

    function parseLogCSV(csvText) {
        const lines = csvText.trim().split(/\r?\n/);
        if (lines.length <= 1) return [];
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const hasUserId = headers.includes('user_id');
        const hasUserName = headers.includes('user_name');
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const parts = line.split(',');
            const entry = {
                userId: hasUserId ? parts[headers.indexOf('user_id')]?.trim() || 'inconnu' : 'legacy',
                userName: hasUserName ? parts[headers.indexOf('user_name')]?.trim() || '—' : 'Sans suivi',
                horodatage: parts[headers.indexOf('horodatage')]?.trim() || '',
                action: parts[headers.indexOf('action')]?.trim() || '',
            };
            data.push(entry);
        }
        return data;
    }

    function updateLogUserFilter() {
        const select = selectors.logUserFilter();
        const unique = new Map();
        state.logData.forEach(entry => {
            if (!unique.has(entry.userId)) {
                unique.set(entry.userId, entry.userName || entry.userId);
            }
        });
        const options = ['<option value="all">Tous</option>'];
        Array.from(unique.entries())
            .sort((a, b) => a[1].localeCompare(b[1], 'fr', { sensitivity: 'base' }))
            .forEach(([id, name]) => {
                options.push(`<option value="${id}">${name || id}</option>`);
            });
        select.innerHTML = options.join('');
    }

    function renderLogTable() {
        const tbody = selectors.logTableBody();
        const data = getFilteredLogs();
        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="no-data">Aucune entrée pour ces filtres.</td></tr>';
            return;
        }
        const rows = data.slice(0, 200).map(entry => `
            <tr>
                <td>${entry.userName || entry.userId}</td>
                <td>${entry.horodatage}</td>
                <td><span class="action-badge">${formatAction(entry.action)}</span></td>
            </tr>
        `);
        tbody.innerHTML = rows.join('');
    }

    function getFilteredLogs() {
        let data = [...state.logData];
        const userId = selectors.logUserFilter().value;
        const actionFilter = selectors.logActionFilter().value;
        const start = selectors.logStartDate().value;
        const end = selectors.logEndDate().value;

        if (userId !== 'all') {
            data = data.filter(entry => entry.userId === userId);
        }

        if (actionFilter) {
            data = data.filter(entry => {
                if (actionFilter === 'reunion') {
                    return entry.action.startsWith('reunion');
                }
                return entry.action === actionFilter;
            });
        }

        if (start) {
            data = data.filter(entry => entry.horodatage.slice(0, 10) >= start);
        }

        if (end) {
            data = data.filter(entry => entry.horodatage.slice(0, 10) <= end);
        }

        return data;
    }

    function formatAction(action) {
        const map = {
            'login': '🔐 Login',
            'debut-shift': '▶️ Début shift',
            'pause': '⏸️ Pause',
            'reprise': '▶️ Reprise',
            'fin-shift': '⏹️ Fin shift',
            'logout': '🚪 Logout',
        };
        if (action.startsWith('reunion')) {
            return '👥 Réunion';
        }
        return map[action] || action;
    }

    function exportLogs(format) {
        const data = getFilteredLogs();
        if (!data.length) {
            showToast('Aucune donnée à exporter.');
            return;
        }
        const filename = `optitime_logs_${new Date().toISOString().slice(0, 10)}.${format === 'excel' ? 'xls' : format === 'pdf' ? 'pdf' : 'csv'}`;

        if (format === 'csv') {
            const header = 'user_id,user_name,horodatage,action\n';
            const body = data.map(entry =>
                `${entry.userId},${entry.userName || ''},${entry.horodatage},${entry.action}`
            ).join('\n');
            downloadFile(header + body, 'text/csv', filename);
        } else if (format === 'excel') {
            const rows = data.map(entry => `<tr><td>${entry.userName || entry.userId}</td><td>${entry.horodatage}</td><td>${formatAction(entry.action)}</td></tr>`).join('');
            const html = `<table><thead><tr><th>Utilisateur</th><th>Horodatage</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>`;
            downloadFile(html, 'application/vnd.ms-excel', filename);
        } else if (format === 'pdf') {
            if (!window.jspdf || !window.jspdf.jsPDF) {
                showToast('La bibliothèque jsPDF est indisponible.');
                return;
            }
            const doc = new window.jspdf.jsPDF({ orientation: 'landscape' });
            doc.setFontSize(14);
            doc.text('OptiTime - Export des journaux', 14, 20);
            doc.setFontSize(10);
            const rowsPerPage = 25;
            data.forEach((entry, index) => {
                const page = Math.floor(index / rowsPerPage);
                const y = 35 + (index % rowsPerPage) * 8;
                if (index && index % rowsPerPage === 0) {
                    doc.addPage();
                    doc.setFontSize(10);
                }
                doc.text(entry.userName || entry.userId, 14, y);
                doc.text(entry.horodatage, 90, y);
                doc.text(formatAction(entry.action), 170, y);
            });
            doc.save(filename);
        }
        showToast('Export généré.');
    }

    function downloadFile(content, mime, filename) {
        const blob = new Blob([content], { type: `${mime};charset=utf-8` });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function openModal(id) {
        document.getElementById(id).style.display = 'block';
    }

    function closeModal(id) {
        const modal = document.getElementById(id);
        modal.style.display = 'none';
        if (id === 'totpModal' && state.totpInterval) {
            clearInterval(state.totpInterval);
            state.totpInterval = null;
            state.totpUserId = null;
        }
    }

    function copyToClipboard(text, message) {
        if (!text) return;
        navigator.clipboard?.writeText(text).then(() => {
            showToast(message);
        }).catch(() => {
            showToast('Copie impossible');
        });
    }

    function showToast(message) {
        const toast = selectors.toast();
        toast.textContent = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    function renderLoginQr(otpUrl) {
        renderQrOnCanvas(otpUrl, selectors.loginQrCanvas());
    }

    function renderTotpQr(otpUrl) {
        renderQrOnCanvas(otpUrl, selectors.totpQrCanvas());
    }

    function renderQrOnCanvas(otpUrl, canvas) {
        if (!canvas) return;
        if (!otpUrl) {
            clearCanvas(canvas);
            return;
        }
        if (window.QRCode && QRCode.toCanvas) {
            QRCode.toCanvas(canvas, otpUrl, { width: 220 }, (error) => {
                if (error) {
                    console.error('QR code generation failed', error);
                }
            });
        } else {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#fff';
            ctx.font = '16px sans-serif';
            ctx.fillText('QR indisponible', 40, 110);
        }
    }

    function clearCanvas(canvas) {
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    function debounce(fn, delay = 200) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }
})();
