(async function () {
    // Try to get the current user
    let user = null;
    try {
        const res = await fetch('/api/me', { credentials: 'same-origin' });
        if (res.ok) user = await res.json();
    } catch (e) { /* ignore */ }

    const loginLink = document.getElementById('loginLink');
    const signupLink = document.getElementById('signupLink');
    const logoutBtn = document.getElementById('logoutBtn');
    const welcome = document.getElementById('welcomeName');

    if (user) {
        // Hide login/signup, show welcome + logout
        if (loginLink) loginLink.style.display = 'none';
        if (signupLink) signupLink.style.display = 'none';
        if (welcome) {
            welcome.style.display = 'inline';
            welcome.textContent = `Hi, ${user.name || user.email}`;
        }
        if (logoutBtn) {
            logoutBtn.style.display = 'inline-block';
            logoutBtn.addEventListener('click', async () => {
                try {
                    await fetch('/api/logout', { method: 'POST' });
                } catch (e) { }
                // After logout → go to login
                location.href = '/login';
            });
        }
    } else {
        // Not logged in: show login/signup, hide logout/welcome
        if (loginLink) loginLink.style.display = 'inline';
        if (signupLink) signupLink.style.display = 'inline-block';
        if (welcome) welcome.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
})();  