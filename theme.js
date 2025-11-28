// Gestion des thèmes
(function() {
    const themeKey = 'optitime-theme';
    
    // Détecter le thème système
    function getSystemTheme() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    // Obtenir le thème actuel
    function getTheme() {
        const saved = localStorage.getItem(themeKey);
        if (saved === 'system' || !saved) {
            return getSystemTheme();
        }
        return saved;
    }
    
    // Appliquer le thème
    function applyTheme(theme) {
        const root = document.documentElement;
        const actualTheme = theme === 'system' ? getSystemTheme() : theme;
        
        root.setAttribute('data-theme', actualTheme);
        root.setAttribute('data-theme-preference', theme);
        
        // Mettre à jour l'icône du bouton
        updateThemeButton(theme);
    }
    
    // Mettre à jour le bouton de thème
    function updateThemeButton(preference) {
        const btn = document.getElementById('themeToggle');
        if (!btn) return;
        
        const icons = {
            'light': '☀️',
            'dark': '🌙',
            'system': '💻'
        };
        
        btn.textContent = icons[preference] || icons['system'];
        btn.title = `Thème: ${preference === 'system' ? 'Système' : preference === 'dark' ? 'Sombre' : 'Clair'}`;
    }
    
    // Initialiser le thème
    function initTheme() {
        const preference = localStorage.getItem(themeKey) || 'system';
        applyTheme(preference);
        
        // Écouter les changements du système
        if (window.matchMedia) {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
                if (localStorage.getItem(themeKey) === 'system') {
                    applyTheme('system');
                }
            });
        }
    }
    
    // Changer le thème
    function toggleTheme() {
        const current = localStorage.getItem(themeKey) || 'system';
        let next;
        
        if (current === 'system') {
            next = 'light';
        } else if (current === 'light') {
            next = 'dark';
        } else {
            next = 'system';
        }
        
        localStorage.setItem(themeKey, next);
        applyTheme(next);
    }
    
    // Exposer les fonctions globalement
    window.themeManager = {
        init: initTheme,
        toggle: toggleTheme,
        getTheme: getTheme
    };
    
    // Initialiser au chargement
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTheme);
    } else {
        initTheme();
    }
})();

