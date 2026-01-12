// --- Theme Toggle Logic for The Fortune ---

document.addEventListener('DOMContentLoaded', () => {
    const headerRightPanel = document.querySelector('.header-right-panel') || createHeaderPanel();
    
    // 1. Create and inject the toggle button
    const toggleButton = document.createElement('button');
    toggleButton.id = 'theme-toggle-button';
    toggleButton.setAttribute('aria-label', 'Toggle dark and light mode');
    headerRightPanel.appendChild(toggleButton);

    // Function to create header panel if it doesn't exist (for simpler HTML)
    function createHeaderPanel() {
        const panel = document.createElement('div');
        panel.className = 'header-right-panel';
        const header = document.querySelector('header');
        const nav = document.querySelector('nav');
        header.appendChild(panel);
        if (nav) panel.prepend(nav); // Move nav inside the panel
        return panel;
    }

    // 2. Define theme constants and state variables
    const LIGHT_THEME = 'light';
    const DARK_THEME = 'dark';
    const SAVED_THEME_KEY = 'selected-theme';

    let currentTheme = getInitialTheme();

    // 3. Core functions
    function getInitialTheme() {
        const savedTheme = localStorage.getItem(SAVED_THEME_KEY);
        if (savedTheme) {
            return savedTheme;
        }
        // Check user's OS preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return DARK_THEME;
        }
        return LIGHT_THEME; // Default to light
    }

    function applyTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        toggleButton.innerHTML = theme === DARK_THEME ? '☀️' : '🌙';
        localStorage.setItem(SAVED_THEME_KEY, theme);
        currentTheme = theme;
    }

    // 4. Event listener for the button
    toggleButton.addEventListener('click', () => {
        const newTheme = currentTheme === DARK_THEME ? LIGHT_THEME : DARK_THEME;
        applyTheme(newTheme);
    });

    // 5. Apply the initial theme on page load
    applyTheme(currentTheme);
});
