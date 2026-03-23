(function () {
    // Service Worker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then((registration) => {
                    console.log('ServiceWorker registered with Stale-While-Revalidate strategy');

                    // Optional: Check for updates manually
                    registration.update();
                }, (err) => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }

    // Geolocation Caching with 30-Day Expiry
    const originalGetCurrentPosition = navigator.geolocation.getCurrentPosition.bind(navigator.geolocation);
    const CACHE_KEY = 'cached_geolocation';
    const CACHE_EXPIRY_DAYS = 30;

    navigator.geolocation.getCurrentPosition = function (successCallback, errorCallback, options) {
        const cachedData = localStorage.getItem(CACHE_KEY);
        let shouldUseCache = false;
        let coords = null;

        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData);
                const timestamp = parsed.timestamp || 0;
                const now = Date.now();
                const daysDiff = (now - timestamp) / (1000 * 60 * 60 * 24);

                if (daysDiff < CACHE_EXPIRY_DAYS) {
                    shouldUseCache = true;
                    coords = parsed.coords;
                    console.log(`Using cached location (${Math.round(daysDiff)} days old)`);
                } else {
                    console.log('Cached location expired, refreshing from network...');
                }
            } catch (e) {
                console.warn('Error parsing cached location, refreshing...');
            }
        }

        if (shouldUseCache && coords) {
            // Create mock position object
            const mockPosition = {
                coords: {
                    latitude: coords.latitude,
                    longitude: coords.longitude,
                    accuracy: coords.accuracy || 100,
                    altitude: null,
                    altitudeAccuracy: null,
                    heading: null,
                    speed: null
                },
                timestamp: Date.now()
            };

            // Return cached data immediately
            successCallback(mockPosition);

            // Silent background update if online (to keep cache fresh)
            if (navigator.onLine) {
                originalGetCurrentPosition((position) => {
                    const { latitude, longitude, accuracy } = position.coords;
                    localStorage.setItem(CACHE_KEY, JSON.stringify({
                        coords: { latitude, longitude, accuracy },
                        timestamp: Date.now()
                    }));
                }, () => { }, options);
            }

        } else {
            // Fetch fresh data (expired or first time)
            originalGetCurrentPosition((position) => {
                const { latitude, longitude, accuracy } = position.coords;
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    coords: { latitude, longitude, accuracy },
                    timestamp: Date.now()
                }));
                successCallback(position);
            }, errorCallback, options);
        }
    };
    // PWA Install Prompt Logic
    window.addEventListener('load', () => {
        // Check if already installed
        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || document.referrer.includes('android-app://');
        if (isStandalone) return;

        // Check if dismissed recently (7 days)
        const dismissedTime = localStorage.getItem('pwa_dismissed_time');
        if (dismissedTime) {
            const daysSinceDismissal = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissal < 7) return;
        }

        let deferredPrompt;
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        // Create UI Elements
        const createBanner = (type) => {
            const banner = document.createElement('div');
            banner.id = 'pwa-install-banner';
            banner.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                width: 90%;
                max-width: 400px;
                background: white;
                border-radius: 16px;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                padding: 16px;
                display: flex;
                align-items: center;
                gap: 12px;
                z-index: 9999;
                font-family: 'Inter', sans-serif;
                border: 1px solid #f0fdf4;
                animation: slideUp 0.5s ease-out;
            `;

            // Inject keyframes
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideUp {
                    from { transform: translate(-50%, 100%); opacity: 0; }
                    to { transform: translate(-50%, 0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);

            const content = type === 'ios'
                ? `
                    <div style="flex: 1;">
                        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">Uygulamayı Yükle</h3>
                        <p style="margin: 4px 0 0; font-size: 13px; color: #6b7280; line-height: 1.4;">
                            Daha iyi deneyim için: <br>
                            1. <span style="display: inline-block; vertical-align: middle;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg></span> Paylaş butonuna basın <br>
                            2. "Ana Ekrana Ekle"yi seçin
                        </p>
                    </div>
                    <button id="pwa-close" style="background: none; border: none; padding: 4px; cursor: pointer; color: #9ca3af;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                `
                : `
                    <div style="width: 48px; height: 48px; background: #0d9488; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                        <img src="./icon.png" style="width: 32px; height: 32px; object-fit: contain;" alt="App Icon">
                    </div>
                    <div style="flex: 1;">
                        <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">Namaz Vakitleri</h3>
                        <p style="margin: 2px 0 0; font-size: 13px; color: #6b7280;">İnternetsiz çalışır</p>
                    </div>
                    <button id="pwa-install-btn" style="background: #0d9488; color: white; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 500; font-size: 13px; cursor: pointer;">Yükle</button>
                    <button id="pwa-close" style="background: none; border: none; padding: 4px; cursor: pointer; color: #9ca3af; margin-left: 4px;">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                `;

            banner.innerHTML = content;
            document.body.appendChild(banner);

            // Close Logic
            document.getElementById('pwa-close').addEventListener('click', () => {
                banner.remove();
                localStorage.setItem('pwa_dismissed_time', Date.now());
            });

            // Install Logic for Android/Desktop
            if (type === 'native') {
                document.getElementById('pwa-install-btn').addEventListener('click', () => {
                    if (deferredPrompt) {
                        deferredPrompt.prompt();
                        deferredPrompt.userChoice.then((choiceResult) => {
                            if (choiceResult.outcome === 'accepted') {
                                console.log('User accepted the install prompt');
                            }
                            deferredPrompt = null;
                            banner.remove();
                        });
                    }
                });
            }
        };

        // Android/Desktop: Listen for install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            createBanner('native');
        });

        // iOS: Show instructions immediately (if valid and not dismissed)
        if (isIOS) {
            // setTimeout to respect original load time slightly
            setTimeout(() => createBanner('ios'), 2000);
        }
    });

})();
