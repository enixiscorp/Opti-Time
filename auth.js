// auth.js - Gestion des comptes, sessions et TOTP pour OptiTime
(function (global) {
    const USERS_KEY = 'optitime.users.v2';
    const SESSION_KEY = 'optitime.session.v2';
    const SESSION_DURATION_MS = 12 * 60 * 60 * 1000; // 12 heures
    const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const DEFAULT_ADMIN = {
        email: 'edemcyrille@gmail.com',
        password: 'Lyric2025*',
        totpSecret: 'JBSWY3DPEHPK3PXP', // Base32, 16 chars
    };

    let users = [];
    let session = null;
    let readyResolver;

    const readyPromise = new Promise((resolve) => {
        readyResolver = resolve;
    });

    function loadUsers() {
        try {
            const raw = localStorage.getItem(USERS_KEY);
            users = raw ? JSON.parse(raw) : [];
        } catch (error) {
            console.warn('Impossible de charger les utilisateurs:', error);
            users = [];
        }
    }

    function saveUsers() {
        localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }

    function loadSession() {
        try {
            const raw = localStorage.getItem(SESSION_KEY);
            if (!raw) {
                return null;
            }
            const data = JSON.parse(raw);
            if (!data || !data.expiresAt || data.expiresAt < Date.now()) {
                localStorage.removeItem(SESSION_KEY);
                return null;
            }
            return data;
        } catch (error) {
            console.warn('Impossible de charger la session:', error);
            return null;
        }
    }

    function saveSession() {
        if (session) {
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } else {
            localStorage.removeItem(SESSION_KEY);
        }
    }

    function ensureCryptoSupport() {
        if (!global.crypto || !global.crypto.subtle) {
            throw new Error('Ce navigateur ne supporte pas Web Crypto API (requis pour l’authentification).');
        }
    }

    async function hashPassword(password) {
        ensureCryptoSupport();
        const data = new TextEncoder().encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
    }

    function generateSecret(length = 32) {
        const bytes = new Uint8Array(length);
        crypto.getRandomValues(bytes);
        let secret = '';
        for (let i = 0; i < length; i++) {
            secret += BASE32_ALPHABET[bytes[i] % BASE32_ALPHABET.length];
        }
        return secret;
    }

    function base32ToUint8(base32) {
        const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '');
        const bytes = [];
        let buffer = 0;
        let bitsLeft = 0;
        for (const char of clean) {
            buffer = (buffer << 5) | BASE32_ALPHABET.indexOf(char);
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                bytes.push((buffer >>> (bitsLeft - 8)) & 0xff);
                bitsLeft -= 8;
            }
        }
        return new Uint8Array(bytes);
    }

    async function hotp(secret, counter, digits = 6) {
        ensureCryptoSupport();
        const key = base32ToUint8(secret);
        const counterBuffer = new ArrayBuffer(8);
        const view = new DataView(counterBuffer);
        const high = Math.floor(counter / 0x100000000);
        const low = counter & 0xffffffff;
        view.setUint32(0, high);
        view.setUint32(4, low);

        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            key,
            { name: 'HMAC', hash: { name: 'SHA-1' } },
            false,
            ['sign']
        );
        const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, counterBuffer));
        const offset = hmac[hmac.length - 1] & 0x0f;
        const binary =
            ((hmac[offset] & 0x7f) << 24) |
            ((hmac[offset + 1] & 0xff) << 16) |
            ((hmac[offset + 2] & 0xff) << 8) |
            (hmac[offset + 3] & 0xff);
        const otp = binary % 10 ** digits;
        return otp.toString().padStart(digits, '0');
    }

    async function totp(secret, windowOffset = 0, step = 30, digits = 6) {
        const counter = Math.floor(Date.now() / 1000 / step) + windowOffset;
        return hotp(secret, counter, digits);
    }

    async function verifyTotp(secret, code) {
        if (!secret) {
            return false;
        }
        const sanitized = String(code || '').trim().replace(/\s+/g, '');
        if (sanitized.length < 6) {
            return false;
        }
        const offsets = [-1, 0, 1];
        for (const offset of offsets) {
            const expected = await totp(secret, offset);
            if (expected === sanitized) {
                return true;
            }
        }
        return false;
    }

    function getUserByEmail(email) {
        const normalized = email.trim().toLowerCase();
        return users.find((user) => user.email === normalized) || null;
    }

    function getUserById(id) {
        return users.find((user) => user.id === id) || null;
    }

    async function seedAdminIfNeeded() {
        const defaultAdmin = getUserByEmail(DEFAULT_ADMIN.email);
        const now = new Date().toISOString();

        if (defaultAdmin) {
            await applyDefaultAdminCredentials(defaultAdmin, now);
            console.info(`Compte administrateur synchronisé (${DEFAULT_ADMIN.email}).`);
            saveUsers();
            return;
        }

        const admin = {
            id: crypto.randomUUID(),
            name: 'Administrateur OptiTime',
            email: DEFAULT_ADMIN.email,
            role: 'admin',
            isActive: true,
            createdAt: now,
            updatedAt: now,
        };
        await applyDefaultAdminCredentials(admin, now);
        users.push(admin);
        saveUsers();
        console.info(
            `Compte administrateur par défaut créé (${DEFAULT_ADMIN.email}). Pensez à personnaliser le mot de passe et à régénérer le secret TOTP.`
        );
    }

    async function applyDefaultAdminCredentials(user, timestamp) {
        Object.assign(user, {
            name: 'Administrateur OptiTime',
            role: 'admin',
            isActive: true,
            passwordHash: await hashPassword(DEFAULT_ADMIN.password),
            totpSecret: DEFAULT_ADMIN.totpSecret,
            updatedAt: timestamp || new Date().toISOString(),
        });
    }

    async function init() {
        loadUsers();
        session = loadSession();
        await seedAdminIfNeeded();
        readyResolver();
        return true;
    }

    function ensureActiveUser(user) {
        if (!user || !user.isActive) {
            throw new Error('Utilisateur désactivé ou introuvable.');
        }
    }

    async function verifyPassword({ email, password, allowedRoles = [] }) {
        await readyPromise;
        const user = getUserByEmail(email);
        ensureActiveUser(user);

        if (allowedRoles.length && !allowedRoles.includes(user.role)) {
            throw new Error('Droits insuffisants pour ce compte.');
        }

        const passwordHash = await hashPassword(password);
        if (passwordHash !== user.passwordHash) {
            throw new Error('Mot de passe incorrect.');
        }

        return {
            user,
            requiresTotp: Boolean(user.totpSecret),
            otpAuthUrl: getOtpAuthUrl(user),
        };
    }

    async function login({ email, password, totpCode, allowedRoles = [] }) {
        await readyPromise;
        const user = getUserByEmail(email);
        ensureActiveUser(user);

        if (allowedRoles.length && !allowedRoles.includes(user.role)) {
            throw new Error('Droits insuffisants pour ce compte.');
        }

        const passwordHash = await hashPassword(password);
        if (passwordHash !== user.passwordHash) {
            throw new Error('Mot de passe incorrect.');
        }

        if (user.totpSecret) {
            const valid = await verifyTotp(user.totpSecret, totpCode);
            if (!valid) {
                throw new Error('Code Authenticator invalide.');
            }
        }

        session = {
            token: crypto.randomUUID(),
            userId: user.id,
            role: user.role,
            email: user.email,
            createdAt: Date.now(),
            expiresAt: Date.now() + SESSION_DURATION_MS,
        };
        saveSession();
        return { user, session };
    }

    function logout() {
        session = null;
        saveSession();
    }

    function getSession() {
        if (!session) {
            session = loadSession();
        }
        return session;
    }

    function getCurrentUser() {
        const currentSession = getSession();
        if (!currentSession) {
            return null;
        }
        return getUserById(currentSession.userId);
    }

    function requireRole(role) {
        const currentUser = getCurrentUser();
        return currentUser && currentUser.role === role ? currentUser : null;
    }

    async function createUser({ name, email, password, role = 'user', isActive = true }) {
        await readyPromise;
        if (getUserByEmail(email)) {
            throw new Error('Un utilisateur avec cet email existe déjà.');
        }
        if (!password || password.length < 8) {
            throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
        }
        const now = new Date().toISOString();
        const user = {
            id: crypto.randomUUID(),
            name: name.trim(),
            email: email.trim().toLowerCase(),
            role,
            isActive,
            passwordHash: await hashPassword(password),
            totpSecret: generateSecret(),
            createdAt: now,
            updatedAt: now,
        };
        users.push(user);
        saveUsers();
        return user;
    }

    async function updateUser(id, payload) {
        await readyPromise;
        const user = getUserById(id);
        if (!user) {
            throw new Error('Utilisateur introuvable.');
        }
        Object.assign(user, payload, { updatedAt: new Date().toISOString() });
        saveUsers();
        return user;
    }

    async function resetPassword(id, newPassword) {
        if (!newPassword || newPassword.length < 8) {
            throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
        }
        return updateUser(id, { passwordHash: await hashPassword(newPassword) });
    }

    async function resetTotp(id) {
        return updateUser(id, { totpSecret: generateSecret() });
    }

    function deleteUser(id) {
        const index = users.findIndex((user) => user.id === id);
        if (index >= 0) {
            users.splice(index, 1);
            saveUsers();
        }
    }

    function getOtpAuthUrl(user, issuer = 'OptiTime') {
        const label = encodeURIComponent(`${issuer}:${user.email}`);
        const issuerParam = encodeURIComponent(issuer);
        return `otpauth://totp/${label}?secret=${user.totpSecret}&issuer=${issuerParam}`;
    }

    async function previewTotp(userId) {
        const user = getUserById(userId);
        if (!user || !user.totpSecret) {
            return null;
        }
        return totp(user.totpSecret);
    }

    global.AuthService = {
        init,
        ready: () => readyPromise,
        verifyPassword,
        login,
        logout,
        getSession,
        getCurrentUser,
        requireRole,
        getUsers: () => [...users],
        createUser,
        updateUser,
        resetPassword,
        resetTotp,
        deleteUser,
        verifyTotp,
        getOtpAuthUrl,
        previewTotp,
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        init();
    } else {
        document.addEventListener('DOMContentLoaded', init);
    }
})(window);

