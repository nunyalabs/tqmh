document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');

    // On first load, ensure the admin user exists.
    // In a real-world scenario, this would be handled by a server-side setup script.
    ensureAdminExists();

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.classList.add('hidden');

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const user = await authenticateUser(username, password);
            if (user) {
                sessionStorage.setItem('currentUser', JSON.stringify(user));
                window.location.href = 'index.html';
            } else {
                loginError.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Login failed:', error);
            loginError.classList.remove('hidden');
        }
    });
});