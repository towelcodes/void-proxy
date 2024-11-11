let deferredPrompt;

window.addEventListener('beforeinstallprompt', (event) => {
    console.log("event fired");
    // Prevent the default prompt
    event.preventDefault();

    // Stash the event so it can be triggered later
    deferredPrompt = event;

    // Show a custom install button or banner
    // Example: Show a button with an "Install" label
    const installButton = document.getElementById('installButton');
    installButton.style.display = 'block';

    // Handle the click event on the custom button
    installButton.addEventListener('click', () => {
        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the install prompt');
            } else {
                console.log('User dismissed the install prompt');
            }

            // Reset the deferred prompt variable
            deferredPrompt = null;
        });
    });
});