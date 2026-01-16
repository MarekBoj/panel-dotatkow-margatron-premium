// ==UserScript==
// @name         Panel Dodatków - Margatron Premium
// @namespace    https://github.com/MarekBoj/panel-dotatkow-margatron-premium
// @version      3.0.3
// @description  Panel dodatków do Margatron (AutoHeal, LootFilter, AutoCloseFight, LegendNotifications, Highlights, AutoSell, HerosDetector, Procentownik, GoldEater, AutoGrp, Hotkeys, AutoFight, Minutnik, Przedmioty na Mapie, Gracze na Mapie, Licznik Ubić, Przełącznik Postaci)
// @author       DrMan
// @match        https://world-retro.margatron.ovh/*
// @updateURL    https://raw.githubusercontent.com/MarekBoj/panel-dotatkow-margatron-premium/main/script.user.js
// @downloadURL  https://raw.githubusercontent.com/MarekBoj/panel-dotatkow-margatron-premium/main/script.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    // ======================== AuthTokenFetch ========================
    let authToken;
    injectFetchHook();

    function injectFetchHook() {
        const script = document.createElement('script');
        script.textContent = `
            (function () {
                const originalFetch = window.fetch;

                window.fetch = async function (...args) {
                    try {
                        const opts = args[1];
                        const headers = opts?.headers;

                        let auth =
                            headers?.authorization ||
                            headers?.Authorization ||
                            (headers instanceof Headers ? headers.get('authorization') : null);

                        if (auth) {
                            window.__AUTH_TOKEN__ = auth;
                            console.log('[InjectedFetch] Token złapany:', auth.slice(0, 20) + '...');
                        }
                    } catch (e) {
                        console.error('[InjectedFetch] error', e);
                    }

                    return originalFetch.apply(this, args);
                };
            })();
        `;

        document.documentElement.appendChild(script);
        script.remove();
    }

    function waitForToken() {
        const interval = setInterval(() => {
            const token = unsafeWindow.__AUTH_TOKEN__;
            if (token) {
                clearInterval(interval);
                console.log('[Userscript] Token gotowy:', token);
                authToken = token;
            }
        }, 500);
    }

    waitForToken();

    // ======================== GRAPHQL MANAGER ========================
    const GraphQLManager = {
        API_URL: 'https://engine-retro.margatron.ovh/graphql',

        getToken() {
            return authToken;
        },

        async query(queryString) {
            const token = this.getToken();
            if (!token) {
                console.warn('[GraphQLManager] Brak tokena autoryzacji');
                throw new Error('Brak tokena autoryzacji');
            }

            try {
                const res = await fetch(this.API_URL, {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                        "authorization": token
                    },
                    body: JSON.stringify({ query: queryString })
                });

                const json = await res.json();

                if (json.errors) {
                    console.error('[GraphQLManager] GraphQL Errors:', json.errors);
                    throw new Error('GraphQL Error: ' + JSON.stringify(json.errors));
                }

                return json.data;
            } catch (e) {
                console.error('[GraphQLManager] Błąd zapytania:', e);
                throw e;
            }
        }
    };

    // ======================== KONFIGURACJA ========================
    const CONFIG = {
        ICONS: {
            KILL_COUNTER: 'https://i.imgur.com/5vXz9jK.png',
            DEFAULT: 'https://i.imgur.com/rjqhc5n.png',
            HOVER: 'https://i.imgur.com/Sa1MLfu.png',
            HOTKEYS: {
                OFF: [
                    'https://i.imgur.com/NGtHaDH.png',
                    'https://i.imgur.com/55JcyLB.png',
                    'https://i.imgur.com/0YaXQVO.png',
                    'https://i.imgur.com/txuzY4I.png',
                    'https://i.imgur.com/zvVWQaY.png',
                    'https://i.imgur.com/cUTbXHW.png',
                    'https://i.imgur.com/PN7M0jC.png',
                    'https://imgur.com/9HISvJE.png'
                ],
                ON: [
                    'https://i.imgur.com/aLIJ57i.png',
                    'https://i.imgur.com/aBjx3l2.png',
                    'https://i.imgur.com/tdLexLS.png',
                    'https://i.imgur.com/24X6V19.png',
                    'https://i.imgur.com/F9MmVRl.png',
                    'https://i.imgur.com/RIYmqMj.png',
                    'https://i.imgur.com/9GQvZe3.png',
                    'https://imgur.com/9HISvJE.png'
                ]
            }
        },
        COLORS: {
            RANK: {
                HERO: '#ffc600',
                TITAN: '#ff6c00',
                ELITE_II: '#54ff00',
                ELITE: '#00aeff'
            },
            RANK_NAMES: {
                HERO: 'Heros',
                TITAN: 'Tytan',
                ELITE_II: 'Elita II',
                ELITE: 'Elita'
            }
        },
        API: {
            CHARACTERS: 'https://margatron.ovh/game/api/characters',
            JOIN: 'https://margatron.ovh/game/api/characters/join'
        },
    };

    const Utils = {
        simulateKeyPress(key, code, keyCode) {
            const opts = { key, code, keyCode, which: keyCode, bubbles: true, cancelable: true };
            ['keydown', 'keyup'].forEach(type =>
                                         document.dispatchEvent(new KeyboardEvent(type, opts))
                                        );
        },

        formatTime(seconds) {
            const days = Math.floor(seconds / 86400);
            const hours = Math.floor((seconds % 86400) / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            const sec = seconds % 60;

            const pad = (n) => String(n).padStart(2, '0');

            if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(sec)}`;
            if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(sec)}`;
            return `${pad(minutes)}:${pad(sec)}`;
        },

        calculatePercentage(bar) {
            return bar ? parseFloat(bar.style.width) : 0;
        },

        parseItemData(item) {
            const dataAttr = item.getAttribute('data-item');
            if (!dataAttr) return null;
            try {
                return JSON.parse(dataAttr);
            } catch (e) {
                console.error('[Utils] Błąd parsowania:', e);
                return null;
            }
        },

        moveItemToRandomPosition(item, targetGrid) {
            const rect = targetGrid.getBoundingClientRect();
            const marginX = (rect.width - item.offsetWidth) * 0.4;
            const marginY = (rect.height - item.offsetHeight) * 0.4;

            const randomX = rect.left + marginX * (rect.width - item.offsetWidth - 2 * marginX);
            const randomY = rect.top + marginY * (rect.height - item.offsetHeight - 2 * marginY);

            item.dispatchEvent(new MouseEvent('mousedown', {
                bubbles: true, clientX: rect.left + 10, clientY: rect.top + 10
            }));
            targetGrid.dispatchEvent(new MouseEvent('mousemove', {
                bubbles: true, clientX: randomX, clientY: randomY
            }));
            targetGrid.dispatchEvent(new MouseEvent('mouseup', {
                bubbles: true, clientX: randomX, clientY: randomY
            }));
        },

        playAudio(url, volume = 1.0) {
            const audio = new Audio(url);
            audio.preload = "auto";
            audio.volume = volume;
            audio.play()
                .then(() => setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 5000))
                .catch(err => console.warn("Nie można odtworzyć dźwięku:", err));
        }
    };

    // ======================== INTERVALS MANAGER ========================

    class IntervalManager {
        constructor() {
            this.intervals = new Map();
        }

        set(name, callback, delay) {
            this.clear(name);
            this.intervals.set(name, setInterval(callback, delay));
        }

        clear(name) {
            const interval = this.intervals.get(name);
            if (interval) {
                clearInterval(interval);
                this.intervals.delete(name);
            }
        }

        clearAll() {
            this.intervals.forEach(interval => clearInterval(interval));
            this.intervals.clear();
        }
    }

    const intervalManager = new IntervalManager();

    // ======================== MESSAGE CANVAS ========================

    const MessageCanvas = {
        show(itemName, info, colour) {
            if (!GM_getValue('disableMessages', false)) return;

            const message = `${info} ${itemName}`;
            const parent = document.getElementById('game-map-window');
            if (!parent) return;

            if (getComputedStyle(parent).position === 'static') {
                parent.style.position = 'relative';
            }

            let messageCanvas = parent.querySelector('.message-canvas');
            if (!messageCanvas) {
                messageCanvas = this.createContainer();
                parent.appendChild(messageCanvas);
            }

            const canvas = this.createCanvas(message, colour);
            messageCanvas.appendChild(canvas);

            requestAnimationFrame(() => canvas.style.opacity = '1');
            setTimeout(() => {
                canvas.style.opacity = '0';
                setTimeout(() => {
                    canvas.remove();
                    if (messageCanvas.children.length === 0) messageCanvas.remove();
                }, 300);
            }, 1500);
        },

        createContainer() {
            const container = document.createElement('div');
            container.className = 'message-canvas';
            Object.assign(container.style, {
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)', display: 'flex',
                flexDirection: 'column', alignItems: 'center', gap: '6px',
                pointerEvents: 'none', zIndex: '9999'
            });
            return container;
        },

        createCanvas(message, colour) {
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.font = 'bold 20px Georgia';
            const textWidth = tempCtx.measureText(message).width + 40;

            const canvas = document.createElement('canvas');
            canvas.width = Math.max(360, textWidth);
            canvas.height = 50;
            canvas.style.opacity = '0';
            canvas.style.transition = 'opacity 0.3s ease';

            const ctx = canvas.getContext('2d');
            ctx.font = 'bold 20px Georgia';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 2;
            ctx.shadowBlur = 5;
            ctx.strokeStyle = 'black';
            ctx.lineWidth = 1;
            ctx.strokeText(message, canvas.width / 2, canvas.height / 2);
            ctx.fillStyle = colour;
            ctx.fillText(message, canvas.width / 2, canvas.height / 2);

            return canvas;
        }
    };

    // ======================== ITEMS ON MAP ========================
    const ItemsOnMap = {
        panel: null,
        items: [],
        isVisible: true,
        STORAGE_KEY: 'itemsOnMapPos',
        itemsList: null,
        updateInterval: null,

        ITEMS_QUERY: `
        query Items {
            itemsOnMap {
                id
                name
                rarity
                src
                mapLocation {
                   x
                   y
                }
            }
        }
    `,

        RARITY_ORDER: {
            'artefact': 0,
            'legendary': 1,
            'heroic': 2,
            'unique': 3,
            'upgraded': 4,
            'common': 5
        },

        RARITY_COLORS: {
            'unique': GM_getValue('highlightColorUnique', '#f5b536'),
            'heroic': GM_getValue('highlightColorHeroic', '#3193f5'),
            'upgraded': GM_getValue('highlightColorUpgraded', '#ebe7ba'),
            'legendary': GM_getValue('highlightColorLegendary', '#d1249e'),
            'artefact': GM_getValue('highlightColorArtefact', '#f5291b'),
            'common': '#ffffff'
        },

        toggle(enabled) {
            GM_setValue('itemsOnMapEnabled', enabled);
            if (enabled) {
                this.init();
                this.startUpdating();
            } else {
                this.stopUpdating();
                this.closePanel();
            }
        },

        init() {
            if (!this.panel) {
                this.createPanel();
            }
        },

        createPanel() {
            if (this.panel) return;

            this.panel = document.createElement('div');
            this.panel.id = 'items-on-map-panel';
            Object.assign(this.panel.style, {
                position: 'fixed',
                top: '15px',
                right: '10px',
                padding: '12px',
                backgroundColor: '#0b2505',
                borderRadius: '8px',
                color: 'white',
                fontFamily: 'times-new-roman',
                fontSize: '13px',
                zIndex: '9999',
                minWidth: '220px',
                maxWidth: '280px',
                boxShadow: '0 2px 15px rgba(0,0,0,0.7)',
                border: '2px solid #1a4d0d',
                display: 'block'
            });

            const savedPos = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || 'null');
            if (savedPos) {
                this.panel.style.top = savedPos.top + 'px';
                this.panel.style.left = savedPos.left + 'px';
                this.panel.style.right = 'auto';
            }

            const header = this.createHeader();
            this.itemsList = this.createItemsList();
            this.panel.appendChild(header);
            this.panel.appendChild(this.itemsList);
            document.body.appendChild(this.panel);

            this.makeDraggable(this.panel);
        },

        createHeader() {
            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
                paddingBottom: '8px',
                borderBottom: '1px solid #1a4d0d',
                userSelect: 'none'
            });

            const leftSide = document.createElement('div');
            Object.assign(leftSide.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            });

            const icon = document.createElement('img');
            icon.src = 'https://imgur.com/MYocJMU.png';
            Object.assign(icon.style, {
                width: '24px',
                height: '24px',
                borderRadius: '4px'
            });

            const title = document.createElement('span');
            title.textContent = 'Przedmioty na mapie';
            Object.assign(title.style, {
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#fff'
            });

            leftSide.appendChild(icon);
            leftSide.appendChild(title);

            const rightSide = document.createElement('div');
            Object.assign(rightSide.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            });

            const toggleBtn = document.createElement('button');
            toggleBtn.innerHTML = '⯅';
            Object.assign(toggleBtn.style, {
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '4px',
                transition: 'all 0.2s ease'
            });
            toggleBtn.title = 'Ukryj/Pokaż przedmioty';

            toggleBtn.addEventListener('mouseenter', () => {
                toggleBtn.style.transform = 'scale(1.1)';
            });
            toggleBtn.addEventListener('mouseleave', () => {
                toggleBtn.style.transform = 'scale(1)';
            });
            toggleBtn.addEventListener('click', () => {
                this.isVisible = !this.isVisible;
                toggleBtn.innerHTML = this.isVisible ? '⯅' : '⯆';
                this.itemsList.style.display = this.isVisible ? 'flex' : 'none';
            });

            rightSide.appendChild(toggleBtn);
            header.appendChild(leftSide);
            header.appendChild(rightSide);

            return header;
        },

        createItemsList() {
            const list = document.createElement('div');
            Object.assign(list.style, {
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                maxHeight: '200px',
                overflowY: 'auto',
                paddingRight: '4px',
                scrollbarWidth: 'thin',
                scrollbarColor: '#1a4d0d #061d02'
            });

            const style = document.createElement('style');
            style.innerHTML = `
            #items-on-map-panel ::-webkit-scrollbar {
                width: 8px;
            }
            #items-on-map-panel ::-webkit-scrollbar-track {
                background: #061d02;
                border-radius: 4px;
            }
            #items-on-map-panel ::-webkit-scrollbar-thumb {
                background: #1a4d0d;
                border-radius: 4px;
            }
            #items-on-map-panel ::-webkit-scrollbar-thumb:hover {
                background: #2d7a1a;
            }
        `;
            document.head.appendChild(style);

            return list;
        },

        async loadItems() {
            const token = GraphQLManager.getToken();
            console.log('[ItemsOnMap] Próba załadowania, token:', token ? 'Jest (' + token.substring(0, 15) + '...)' : 'Brak');
            if (!token) {
                this.renderStatus('Czekam na token');
                return;
            }

            try {
                const data = await GraphQLManager.query(this.ITEMS_QUERY);
                if (data.itemsOnMap.length == this.items.length) return;
                console.log('[ItemsOnMap] Na mapie jest przedmiotów:', data.itemsOnMap?.length || 0);
                this.items = data.itemsOnMap || [];
                this.sortItems();
                this.renderItems();
            } catch (e) {
                console.error('[ItemsOnMap] Błąd:', e);
                this.renderStatus('Błąd połączenia');
            }
        },

        sortItems() {
            this.items.sort((a, b) => {
                const rarityA = (a.rarity || 'common').toLowerCase();
                const rarityB = (b.rarity || 'common').toLowerCase();
                const orderA = this.RARITY_ORDER[rarityA] ?? 999;
                const orderB = this.RARITY_ORDER[rarityB] ?? 999;

                if (orderA !== orderB) {
                    return orderA - orderB;
                }
                return a.name.localeCompare(b.name);
            });
        },

        renderStatus(message) {
            if (!this.itemsList) return;
            this.itemsList.innerHTML = `
            <div style="text-align: center; padding: 10px; color: #888;">
                ${message}
            </div>
        `;
        },

        renderItems() {
            if (!this.itemsList) return;

            this.itemsList.innerHTML = '';

            if (this.items.length === 0) {
                this.renderStatus('Brak przedmiotów na mapie');
                return;
            }

            this.items.forEach((item, index) => {
                const row = this.createItemRow(item, index);
                this.itemsList.appendChild(row);
            });
        },

        createItemRow(item, index) {
            const rarity = (item.rarity || 'common').toLowerCase();
            const color = this.RARITY_COLORS[rarity] || '#888888';

            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                background: '#061d02',
                borderRadius: '6px',
                border: `1px solid ${color}33`,
                borderLeft: `3px solid ${color}`,
                transition: 'all 0.2s ease',
                fontSize: '12px'
            });

            row.addEventListener('mouseenter', () => {
                row.style.background = '#0a2505';
                row.style.transform = 'translateX(2px)';
                row.style.borderLeftWidth = '4px';
            });

            row.addEventListener('mouseleave', () => {
                row.style.background = '#061d02';
                row.style.transform = 'translateX(0)';
                row.style.borderLeftWidth = '3px';
            });

            const iconImg = document.createElement('img');
            iconImg.src = item.src;
            iconImg.alt = item.name;
            Object.assign(iconImg.style, {
                width: '24px',
                height: '24px',
                objectFit: 'contain'
            });

            const name = document.createElement('span');
            name.textContent = item.name;
            Object.assign(name.style, {
                flex: '1',
                color: '#e0e0e0',
                fontWeight: '500'
            });

            const xy = document.createElement('span');
            xy.textContent = `(${item.mapLocation.x}, ${item.mapLocation.y})`;
            Object.assign(name.style, {
                flex: '1',
                color: '#e0e0e0',
                fontWeight: '500'
            });

            const rarityBadge = document.createElement('span');
            rarityBadge.textContent = rarity.charAt(0).toUpperCase();
            Object.assign(rarityBadge.style, {
                color: color,
                fontSize: '10px',
                fontWeight: 'bold',
                padding: '2px 6px',
                background: `${color}22`,
                borderRadius: '3px',
                border: `1px solid ${color}44`
            });

            row.appendChild(iconImg);
            row.appendChild(name);
            row.appendChild(xy);
            row.appendChild(rarityBadge);

            return row;
        },

        makeDraggable(el) {
            let isDragging = false;
            let offsetX, offsetY;

            el.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                const header = el.querySelector('div');
                if (!header.contains(e.target)) return;

                isDragging = true;
                offsetX = e.clientX - el.offsetLeft;
                offsetY = e.clientY - el.offsetTop;
                el.style.cursor = 'grabbing';
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                el.style.left = (e.clientX - offsetX) + 'px';
                el.style.top = (e.clientY - offsetY) + 'px';
                el.style.right = 'auto';
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    el.style.cursor = 'grab';
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                        top: el.offsetTop,
                        left: el.offsetLeft
                    }));
                }
            });
        },

        startUpdating() {
            setTimeout(() => this.loadItems(), 2000);
            this.updateInterval = setInterval(() => this.loadItems(), 3000);
        },

        stopUpdating() {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
        },

        closePanel() {
            if (this.panel) {
                this.panel.remove();
                this.panel = null;
                this.itemsList = null;
            }
        }
    };

    // ======================== Players On Map ========================
    const PlayersOnMap = {
        panel: null,
        others: [],
        isVisible: true,
        STORAGE_KEY: 'playersOnMapPos',
        playerList: null,
        updateInterval: null,

        OTHERS_QUERY: `
    query Others {
        others {
            id
            name
            lvl
            x
            y
            profession
            inBattle
            src
        }
    }`,

        PROFFESIONS_ICON: {
            'm': 'https://imgur.com/y9NE54X.png',
            'b': 'https://imgur.com/5xvxA9c.png',
            't': 'https://imgur.com/nLssMnv.png',
            'p': 'https://imgur.com/lD6X0ey.png',
            'w': 'https://imgur.com/CiXp7Kw.png',
            'h': 'https://imgur.com/88UYWW0.png',
        },

        PROFFESIONS_NAMES: {
            'm': "Mag",
            'b': "Tancerz Ostrzy",
            't': "Tropiciel",
            'p': "Paladyn",
            'w': "Wojownik",
            'h': "Łowca"
        },

        PROFFESIONS_COLOR: {
            'm': '#00bceb',
            'b': '#ad810a',
            't': '#440083',
            'p': '#ffffff',
            'w': '#830000',
            'h': '#608300',
        },

        toggle(enabled) {
            GM_setValue('playersOnMapEnabled', enabled);
            if (enabled) {
                this.init();
                this.startUpdating();
            } else {
                this.stopUpdating();
                this.closePanel();
            }
        },

        init() {
            if (!this.panel) {
                this.createPanel();
            }
        },

        createPanel() {
            if (this.panel) return;

            this.panel = document.createElement('div');
            this.panel.id = 'players-on-map-panel';
            Object.assign(this.panel.style, {
                position: 'fixed',
                top: '15px',
                right: '10px',
                padding: '12px',
                backgroundColor: '#0b2505',
                borderRadius: '8px',
                color: 'white',
                fontFamily: 'times-new-roman',
                fontSize: '13px',
                zIndex: '9999',
                minWidth: '260px',
                maxWidth: '340px',
                boxShadow: '0 2px 15px rgba(0,0,0,0.7)',
                border: '2px solid #1a4d0d',
                display: 'block'
            });

            const savedPos = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || 'null');
            if (savedPos) {
                this.panel.style.top = savedPos.top + 'px';
                this.panel.style.left = savedPos.left + 'px';
                this.panel.style.right = 'auto';
            }

            const header = this.createHeader();
            this.playerList = this.createPlayersList();
            this.panel.appendChild(header);
            this.panel.appendChild(this.playerList);
            document.body.appendChild(this.panel);

            this.makeDraggable(this.panel);
        },

        createHeader() {
            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px',
                paddingBottom: '8px',
                borderBottom: '1px solid #1a4d0d',
                userSelect: 'none'
            });

            const leftSide = document.createElement('div');
            Object.assign(leftSide.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
            });

            const icon = document.createElement('img');
            icon.src = 'https://imgur.com/T8Lg000.png';
            Object.assign(icon.style, {
                width: '24px',
                height: '24px',
                borderRadius: '4px'
            });

            const title = document.createElement('span');
            title.textContent = 'Gracze na mapie';
            Object.assign(title.style, {
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#fff'
            });

            leftSide.appendChild(icon);
            leftSide.appendChild(title);

            const rightSide = document.createElement('div');
            Object.assign(rightSide.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            });

            const toggleBtn = document.createElement('button');
            toggleBtn.innerHTML = '⯅';
            Object.assign(toggleBtn.style, {
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '4px',
                transition: 'all 0.2s ease'
            });
            toggleBtn.title = 'Ukryj/Pokaż graczy';

            toggleBtn.addEventListener('mouseenter', () => {
                toggleBtn.style.transform = 'scale(1.1)';
            });
            toggleBtn.addEventListener('mouseleave', () => {
                toggleBtn.style.transform = 'scale(1)';
            });
            toggleBtn.addEventListener('click', () => {
                this.isVisible = !this.isVisible;
                toggleBtn.innerHTML = this.isVisible ? '⯅' : '⯆';
                this.playerList.style.display = this.isVisible ? 'flex' : 'none';
            });

            rightSide.appendChild(toggleBtn);
            header.appendChild(leftSide);
            header.appendChild(rightSide);

            return header;
        },

        createPlayersList() {
            const list = document.createElement('div');
            Object.assign(list.style, {
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                maxHeight: '200px',
                overflowY: 'auto',
                paddingRight: '4px',
                scrollbarWidth: 'thin',
                scrollbarColor: '#1a4d0d #061d02'
            });

            const style = document.createElement('style');
            style.innerHTML = `
            #players-on-map-panel ::-webkit-scrollbar {
                width: 8px;
            }
            #players-on-map-panel ::-webkit-scrollbar-track {
                background: #061d02;
                border-radius: 4px;
            }
            #players-on-map-panel ::-webkit-scrollbar-thumb {
                background: #1a4d0d;
                border-radius: 4px;
            }
            #players-on-map-panel ::-webkit-scrollbar-thumb:hover {
                background: #2d7a1a;
            }
        `;
            document.head.appendChild(style);

            return list;
        },

        async loadPlayers() {
            const token = GraphQLManager.getToken();
            console.log('[PlayersOnMap] Próba załadowania, token:', token ? 'JEST (' + token.substring(0, 15) + '...)' : 'BRAK');

            if (!token) {
                this.renderStatus('Czekam na token');
                return;
            }

            try {
                const data = await GraphQLManager.query(this.OTHERS_QUERY);
                if (data.others?.length === this.others.length) return;
                console.log('[PlayersOnMap] Otrzymano graczy:', data.others?.length || 0);
                this.others = data.others || [];
                this.sortPlayers();
                this.renderPlayers();
            } catch (e) {
                console.error('[PlayersOnMap] Błąd:', e);
                this.renderStatus('Błąd połączenia');
            }
        },

        sortPlayers() {
            this.others.sort((a, b) => {
                return a.name.localeCompare(b.name);
            });
        },

        renderStatus(message) {
            if (!this.playerList) return;
            this.playerList.innerHTML = `
            <div style="text-align: center; padding: 10px; color: #888;">
                ${message}
            </div>
        `;
        },

        renderPlayers() {
            if (!this.playerList) return;

            this.playerList.innerHTML = '';

            if (this.others.length === 0) {
                this.renderStatus('Brak graczy na mapie');
                return;
            }

            this.others.forEach((player, index) => {
                const row = this.createPlayerRow(player, index);
                this.playerList.appendChild(row);
            });
        },

        createPlayerRow(player, index) {
            const color = this.PROFFESIONS_COLOR[player.profession] || '#ffffff';
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 8px',
                background: '#061d02',
                borderRadius: '6px',
                border: `1px solid #ffffff33`,
                borderLeft: `3px solid ${color}`,
                transition: 'all 0.2s ease',
                fontSize: '12px'
            });

            row.addEventListener('mouseenter', () => {
                row.style.background = '#0a2505';
                row.style.transform = 'translateX(2px)';
                row.style.borderLeftWidth = '4px';
            });

            row.addEventListener('mouseleave', () => {
                row.style.background = '#061d02';
                row.style.transform = 'translateX(0)';
                row.style.borderLeftWidth = '3px';
            });

            const playerImg = document.createElement('img');
            playerImg.src = player.src;
            playerImg.alt = player.name;

            playerImg.onload = () => {
                const frameWidth = playerImg.naturalWidth / 4;
                const frameHeight = playerImg.naturalHeight / 4;

                Object.assign(playerImg.style, {
                    width: frameWidth + 'px',
                    height: frameHeight + 'px',
                    objectFit: 'none',
                    objectPosition: '0 0'
                });
            };

            const name = document.createElement('span');
            name.textContent = `${player.name} `;
            Object.assign(name.style, {
                flex: '1',
                color: '#e0e0e0',
                fontWeight: '500'
            });

            const level = document.createElement('span');
            level.textContent = `${player.lvl} lvl `;
            Object.assign(level.style, {
                flex: '1',
                color: '#ffffff',
                fontWeight: '500'
            });

            const profession = document.createElement('span');
            profession.textContent = ` [${this.PROFFESIONS_NAMES[player.profession]}] `;
            Object.assign(profession.style, {
                flex: '1',
                color: `${color}`,
                fontWeight: '500'
            });

            const iconImg = document.createElement('img');
            iconImg.src = this.PROFFESIONS_ICON[player.profession];
            iconImg.alt = player.name;
            Object.assign(iconImg.style, {
                width: '24px',
                height: '24px',
                objectFit: 'contain',
                background: '#061d02',
                borderRadius: '6px',
                border: `1px solid ${color}`,
            });

            row.appendChild(playerImg);
            row.appendChild(name);
            row.appendChild(level);
            row.appendChild(profession);
            row.appendChild(iconImg);
            return row;
        },

        makeDraggable(el) {
            let isDragging = false;
            let offsetX, offsetY;

            el.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                const header = el.querySelector('div');
                if (!header.contains(e.target)) return;

                isDragging = true;
                offsetX = e.clientX - el.offsetLeft;
                offsetY = e.clientY - el.offsetTop;
                el.style.cursor = 'grabbing';
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                el.style.left = (e.clientX - offsetX) + 'px';
                el.style.top = (e.clientY - offsetY) + 'px';
                el.style.right = 'auto';
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    el.style.cursor = 'grab';
                    localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                        top: el.offsetTop,
                        left: el.offsetLeft
                    }));
                }
            });
        },

        startUpdating() {
            setTimeout(() => this.loadPlayers(), 2000);
            this.updateInterval = setInterval(() => this.loadPlayers(), 3000);
        },

        stopUpdating() {
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
                this.updateInterval = null;
            }
        },

        closePanel() {
            if (this.panel) {
                this.panel.remove();
                this.panel = null;
                this.playerList = null;
            }
        }
    };

    // ======================== AUTO GRP ========================

    const AutoGrp = {
        toggle(enabled) {
            GM_setValue('autoGrpEnabled', enabled);
            if (enabled) {
                intervalManager.set('autoGrp', () => this.handle(), 500);
            } else {
                intervalManager.clear('autoGrp');
            }
        },

        handle() {
            const pcen = document.querySelector('.pcen');
            if (pcen?.textContent.includes('Akceptuj')) {
                pcen.click();
            }
        }
    };

    // ======================== AUTO FIGHT ========================
    const AutoFight = {
        toggle(enabled) {
            GM_setValue('autoAgressiveEnabled', enabled);
            if (enabled) {
                intervalManager.set('autoFight', () => this.execute(), 50);
            } else {
                intervalManager.clear('autoFight');
            }
        },

        execute() {
            if (!GM_getValue('autoAgressiveDisable', false)) return;
            Utils.simulateKeyPress('e', 'KeyE', 69);
        }
    };

    // ======================== LOOT FILTER ========================
    const LootFilter = {
        toggle(enabled) {
            GM_setValue('autoLootEnabled', enabled);
            if (enabled) {
                GM_setValue('lootFilterApply', false);
                intervalManager.set('lootFilter', () => this.handle(), 500);
            } else {
                intervalManager.clear('lootFilter');
            }
        },

        handle() {
            if (!GM_getValue('lootFilterDisable', false)) return;

            const acceptLoot = GM_getValue('autoLootAccept', false);
            const minPrice = GM_getValue('autoLootMinPrice', 10);
            const lootFiltered = GM_getValue('lootFilterApply', false);
            const rejectCommon = GM_getValue('autoLootRejectCommon', false);
            const acceptConsumables = GM_getValue('autoConsumablesAccept', false);
            const lootWrappers = document.querySelectorAll('.loot-wrapper');

            if (lootWrappers.length === 0) {
                GM_setValue('lootFilterApply', false);
                return;
            }

            let blockLootAccept = false;

            lootWrappers.forEach(wrapper => {
                const item = wrapper.querySelector('[data-item]');
                if (!item || lootFiltered || !item.closest('#loots')) return;

                const data = Utils.parseItemData(item);
                if (!data) return;

                const rarity = data.schema?.inner?.rarity?.toLowerCase();
                const type = data.schema?.inner?.category?.toLowerCase();
                const price = parseInt(data.schema?.inner?.price || 0);

                const isCommon = rarity === "common";
                const isConsumable = type === "consumable";
                const isGold = type === "golds";

                let shouldReject = true;

                if (isGold || (isConsumable && acceptConsumables) ||
                    (isCommon && !rejectCommon && price > minPrice)) {
                    shouldReject = false;
                }

                if (!isCommon) {
                    shouldReject = false;
                    blockLootAccept = true;
                }

                if (shouldReject) {
                    wrapper.querySelector('b.no')?.click();
                }
            });

            GM_setValue('lootFilterApply', true);
            const lootButton = document.querySelector('#loots_button');

            if (lootButton && acceptLoot && !blockLootAccept) {
                setTimeout(() => lootButton.click(), 50);
                GM_setValue('lootFilterApply', false);
            } else if (blockLootAccept) {
                GM_setValue('lootFilterApply', false);
            }
        }
    };

    // ======================== PROCENTOWNIK (HP/EXP) ========================
    const HPExpDisplay = {
        toggle(enabled) {
            GM_setValue('hpExpEnabled', enabled);
            if (enabled) {
                intervalManager.set('hpExp', () => this.update(), 500);
            } else {
                intervalManager.clear('hpExp');
                document.querySelectorAll('.health-percentage, .experienced-percentage')
                    .forEach(el => el.remove());
            }
        },

        update() {
            if (!GM_getValue('hpExpEnabled', true)) return;

            document.querySelectorAll('#panel .container .bars').forEach(container => {
                this.updateBar(container, '.bar.health', 'health-percentage', '40%', '-6px');
                this.updateBar(container, '.bar.experienced', 'experienced-percentage', '50%', '6px');
            });
        },

        updateBar(container, selector, className, top, marginTop) {
            const bar = container.querySelector(selector);
            if (!bar) return;

            const percentage = Utils.calculatePercentage(bar);
            let textEl = bar.querySelector(`.${className}`);

            if (!textEl) {
                textEl = document.createElement('div');
                textEl.classList.add(className);
                Object.assign(textEl.style, {
                    position: 'absolute', left: '53%', transform: 'translateX(-50%)',
                    fontSize: '10px', color: 'white', textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                    zIndex: '10', top, marginTop
                });
                bar.appendChild(textEl);
            }

            textEl.textContent = `${percentage.toFixed(1)}%`;
        }
    };

    // ======================== AUTOHEAL ========================
    const AutoHeal = {
        toggle(enabled) {
            GM_setValue('autoHealEnabled', enabled);
            if (enabled) {
                intervalManager.set('autoHeal', () => this.check(), 500);
            } else {
                intervalManager.clear('autoHeal');
            }
        },

        check() {
            const autoUse = GM_getValue('autoUse', false);
            const autoHealingEnabled = GM_getValue('autoHealingEnabled', false);
            const lifePercentageToHeal = GM_getValue('lifePercentageToHeal', '50');

            if (!autoUse || !autoHealingEnabled) return;

            const healthBar = document.querySelector('#panel .container .bars .bar.health');
            if (!healthBar) return;

            const currentHealthPercentage = Utils.calculatePercentage(healthBar);
            if (currentHealthPercentage < lifePercentageToHeal) {
                this.useConsumable();
            }
        },

        useConsumable() {
            if (document.querySelector('#game-map-window .dazed, #game-map-window .battle-window')) return;

            const items = document.querySelectorAll('#bag .items .item');
            for (let item of items) {
                const data = Utils.parseItemData(item);
                if (!data) continue;

                const isConsumable = data.schema?.inner?.category === 'consumable';
                const isInBag = data.schema?.inner?.location === 'BAG';
                const restoresHealth = data.schema?.inner?.attributes?.restoreHealthPoints > 0 ||
                      data.schema?.inner?.attributes?.healRemaining > 0;
                const isTeleport = Array.isArray(data.schema?.inner?.attributes?.teleportTo);

                if (isConsumable && isInBag && restoresHealth && !isTeleport) {
                    const equipmentGrid = document.querySelector('.equipment-grid');
                    if (equipmentGrid) {
                        Utils.moveItemToRandomPosition(item, equipmentGrid);
                        MessageCanvas.show(data.schema.inner.name || 'nieznany przedmiot', "Użyłeś: ", '#ffd700');
                        break;
                    }
                }
            }
        }
    };

    document.addEventListener('keydown', (e) => {
        if (!GM_getValue('autoHealEnabled', false)) return;
        const hotKey = (GM_getValue('hotKey', 'q') || 'q').toLowerCase();
        if (e.key.toLowerCase() === hotKey) {
            AutoHeal.useConsumable();
        }
    });

    // ======================== AUTO BATTLE ========================
    const AutoBattle = {
        toggle(enabled) {
            GM_setValue('autoBattleEnabled', enabled);
            if (enabled) {
                intervalManager.set('autoBattle', () => this.monitor(), 100);
            } else {
                intervalManager.clear('autoBattle');
            }
        },

        monitor() {
            const battleWindow = document.querySelector('.battle-window');
            if (!battleWindow) return;
            const autoFight = GM_getValue('autoFightEnabled', false);
            const autoClose = GM_getValue('autoCloseEnabled', false);
            if (autoFight && document.querySelector('.battle-btn')) {
                setTimeout(() => {
                    Utils.simulateKeyPress('f', 'KeyF', 70);
                }, 100);
            }

            if (autoClose) {
                const winElem = document.querySelector('.win');
                const victoryTextFound = Array.from(document.querySelectorAll('*'))
                .some(el => el.textContent?.trim().toLowerCase().startsWith('zwyciężył:'));

                if (winElem || victoryTextFound) {
                    setTimeout(() => {
                        if (GM_getValue('minutnikEnabled', false)) {
                            Minutnik.recognizeNpc();
                        }
                        Utils.simulateKeyPress('z', 'KeyZ', 90);
                    }, 100);
                }
            }
        }
    };

    // ======================== GOLD EATER ========================
    const GoldEater = {
        toggle(enabled) {
            GM_setValue('autoGoldEnabled', enabled);
            if (enabled) {
                intervalManager.set('goldEater', () => this.moveGolds(), 500);
            } else {
                intervalManager.clear('goldEater');
            }
        },

        moveGolds() {
            if (!GM_getValue('eatGold', false)) return;
            if (document.querySelector('#game-map-window .dazed, #game-map-window .battle-window')) return;

            const items = document.querySelectorAll('#bag .items .item');
            for (let item of items) {
                const data = Utils.parseItemData(item);
                if (!data) continue;

                const isGold = data.schema?.inner?.category === 'golds';
                const isInBag = data.schema?.inner?.location === 'BAG';
                const isCommon = data.schema?.inner?.rarity === 'common';

                if (isGold && isInBag && isCommon) {
                    const equipGrid = document.querySelector('.equipment-grid');
                    if (equipGrid) {
                        Utils.moveItemToRandomPosition(item, equipGrid);
                        MessageCanvas.show(data.schema.inner.name || 'nieznany przedmiot', "Zjadłeś: ", '#ffd700');
                        break;
                    }
                }
            }
        }
    };


    // ======================== CHARACTER SWITCHER ========================
    const CharacterSwitcher = {
        panel: null,
        characters: [],
        currentCharacterId: null,
        currentWorld: null,

        PROFFESIONS_ICON: {
            'm': 'https://imgur.com/y9NE54X.png',
            'b': 'https://imgur.com/5xvxA9c.png',
            't': 'https://imgur.com/nLssMnv.png',
            'p': 'https://imgur.com/lD6X0ey.png',
            'w': 'https://imgur.com/CiXp7Kw.png',
            'h': 'https://imgur.com/88UYWW0.png',
        },

        PROFFESIONS_COLOR: {
            'm': '#00bceb',
            'b': '#ad810a',
            't': '#440083',
            'p': '#ffffff',
            'w': '#830000',
            'h': '#608300',
        },

        async toggle(enabled) {
            GM_setValue('characterSwitcherEnabled', enabled);
            if (enabled) {
                await this.init();
            } else {
                this.remove();
            }
        },

        async init() {
            try {
                if (window.game && window.game.current_character_id) {
                    this.currentCharacterId = window.game.current_character_id;
                }

                const res = await fetch(CONFIG.API.CHARACTERS, {
                    credentials: 'include',
                    headers: {
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    }
                });

                if (!res.ok) {
                    console.error('[CharacterSwitcher] Status:', res.status, res.statusText);
                    MessageCanvas.show('Błąd', `Nie udało się pobrać postaci (${res.status})`, '#ffd700');
                    return;
                }

                this.characters = await res.json();

                if (!Array.isArray(this.characters) || this.characters.length === 0) {
                    console.warn('[CharacterSwitcher] Brak postaci do wyświetlenia');
                    MessageCanvas.show('Info', 'Brak postaci do wyświetlenia', '#ffd700');
                    return;
                }

                // Wykryj aktualny świat
                const currentChar = this.characters.find(c => c.id === this.currentCharacterId);
                this.currentWorld = currentChar?.world_name || 'retro';

                this.createPanel();
            } catch (err) {
                console.error('[CharacterSwitcher] Błąd przy pobieraniu postaci:', err);
                MessageCanvas.show('Błąd', 'Błąd przy pobieraniu postaci', '#ffd700');
            }
        },

        createPanel() {
            this.remove();

            this.panel = document.createElement('div');
            this.panel.id = 'character-switcher-panel';
            Object.assign(this.panel.style, {
                position: 'fixed',
                top: '50px',
                left: '20px',
                background: 'rgba(11, 37, 5, 0.85)',
                padding: '8px',
                borderRadius: '12px',
                zIndex: '9999',
                display: 'flex',
                flexDirection: 'column',
                cursor: 'grab',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                border: '1px solid rgba(76,175,80,0.3)',
                backdropFilter: 'blur(10px)',
                maxWidth: '600px',
                gap: '8px'
            });

            const savedPos = JSON.parse(localStorage.getItem('margatronPanelPos') || 'null');
            if (savedPos) {
                this.panel.style.top = savedPos.top + 'px';
                this.panel.style.left = savedPos.left + 'px';
            }

            this.makeDraggable(this.panel);
            const worlds = {};
            this.characters.forEach(char => {
                const worldName = char.world_name || 'retro';
                if (!worlds[worldName]) {
                    worlds[worldName] = [];
                }
                worlds[worldName].push(char);
            });

            if (Object.keys(worlds).length > 1) {
                const worldSwitcher = this.createWorldSwitcher(worlds);
                this.panel.appendChild(worldSwitcher);
            }

            const charactersContainer = document.createElement('div');
            charactersContainer.id = 'characters-container';
            Object.assign(charactersContainer.style, {
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                justifyContent: 'center',
                minHeight: '90px'
            });

            this.panel.appendChild(charactersContainer);
            document.body.appendChild(this.panel);
            this.renderCharacters(this.currentWorld);
        },

        createWorldSwitcher(worlds) {
            const container = document.createElement('div');
            container.id = 'world-switcher-container';
            Object.assign(container.style, {
                display: 'flex',
                gap: '6px',
                justifyContent: 'center',
                padding: '4px',
                borderBottom: '1px solid rgba(76,175,80,0.3)',
                marginBottom: '4px'
            });

            const worldNames = {
                'retro': 'Retro',
                'legacy': 'Legacy',
                'classic': 'Classic'
            };

            const sortedWorlds = Object.keys(worlds).sort((a, b) => {
                const order = { 'retro': 0, 'legacy': 1, 'classic': 2 };
                return (order[a] || 99) - (order[b] || 99);
            });

            sortedWorlds.forEach(worldKey => {
                const btn = document.createElement('button');
                btn.textContent = worldNames[worldKey] || worldKey;
                btn.dataset.world = worldKey;
                btn.className = 'world-switch-btn';
                const isActive = this.currentWorld === worldKey;
                Object.assign(btn.style, {
                    padding: '6px 16px',
                    background: isActive ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.05)',
                    border: isActive ? '1px solid rgba(76,175,80,0.6)' : '1px solid rgba(76,175,80,0.2)',
                    color: 'white',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: '600',
                    transition: 'all 0.2s ease',
                    fontFamily: 'times-new-roman'
                });

                btn.addEventListener('mouseenter', () => {
                    if (this.currentWorld !== worldKey) {
                        btn.style.background = 'rgba(76,175,80,0.15)';
                    }
                });

                btn.addEventListener('mouseleave', () => {
                    if (this.currentWorld !== worldKey) {
                        btn.style.background = 'rgba(255,255,255,0.05)';
                    }
                });

                btn.addEventListener('click', () => {
                    this.currentWorld = worldKey;
                    this.updateWorldButtons();
                    this.renderCharacters(worldKey);
                });

                container.appendChild(btn);
            });

            return container;
        },

        updateWorldButtons() {
            const container = document.getElementById('world-switcher-container');
            if (!container) return;

            container.querySelectorAll('.world-switch-btn').forEach(btn => {
                const isActive = btn.dataset.world === this.currentWorld;
                btn.style.background = isActive ? 'rgba(76,175,80,0.3)' : 'rgba(255,255,255,0.05)';
                btn.style.border = isActive ? '1px solid rgba(76,175,80,0.6)' : '1px solid rgba(76,175,80,0.2)';
            });
        },

        renderCharacters(worldName = 'retro') {
            const container = document.getElementById('characters-container');
            if (!container) return;

            container.innerHTML = '';

            const worldCharacters = this.characters.filter(c =>
                                                           (c.world_name || 'retro') === worldName
                                                          );

            worldCharacters.forEach(character => {
                const charElement = this.createCharacterElement(character);
                container.appendChild(charElement);
            });
        },

        createCharacterElement(character) {
            const container = document.createElement('div');
            Object.assign(container.style, {
                width: '56px',
                padding: '6px',
                textAlign: 'center',
                cursor: 'pointer',
                borderRadius: '8px',
                background: 'rgba(6,29,2,0.03)',
                border: '1px solid #1a4d0d',
                transition: 'all 0.2s ease',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'flex-start',
                gap: '4px',
                paddingTop: '20px'
            });

            if (this.currentCharacterId === character.id) {
                container.style.boxShadow = '0 0 12px rgba(76,175,80,0.5)';
            }

            const professionIcon = document.createElement('img');
            professionIcon.src = this.PROFFESIONS_ICON[character.profession] || this.PROFFESIONS_ICON['w'];
            Object.assign(professionIcon.style, {
                position: 'absolute',
                top: '4px',
                right: '4px',
                width: '16px',
                height: '16px',
                objectFit: 'contain',
                background: '#061d02',
                borderRadius: '4px',
                border: `1px solid ${this.PROFFESIONS_COLOR[character.profession] || '#ffffff'}`,
                padding: '1px'
            });

            const nickname = document.createElement('span');
            nickname.textContent = character.name;
            Object.assign(nickname.style, {
                display: 'block',
                fontSize: '11px',
                fontFamily: 'times-new-roman',
                color: '#fff',
                fontWeight: '600',
                textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
            });

            const imgWrapper = document.createElement('div');
            Object.assign(imgWrapper.style, {
                width: '32px',
                height: '32px',
                overflow: 'hidden',
                borderRadius: '6px'
            });

            const sprite = document.createElement('div');
            Object.assign(sprite.style, {
                width: '32px',
                height: '32px',
                backgroundImage: `url(${character.src})`,
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'auto',
                backgroundPosition: '0px 0px',
                imageRendering: 'pixelated'
            });

            imgWrapper.appendChild(sprite);

            const lvl = document.createElement('span');
            lvl.textContent = character.lvl + ' lvl';
            Object.assign(lvl.style, {
                display: 'block',
                fontSize: '11px',
                fontFamily: 'times-new-roman',
                color: '#fff',
                fontWeight: '600',
                textShadow: '0 1px 3px rgba(0,0,0,0.8)'
            });

            container.appendChild(professionIcon);
            container.appendChild(nickname);
            container.appendChild(imgWrapper);
            container.appendChild(lvl);
            container.title = character.name;

            container.addEventListener('mouseenter', () => {
                container.style.background = 'rgba(76,175,80,0.15)';
                container.style.transform = 'translateY(-2px)';
                container.style.boxShadow = '0 4px 12px rgba(76,175,80,0.3)';
            });

            container.addEventListener('mouseleave', () => {
                container.style.background = 'rgba(255,255,255,0.03)';
                container.style.transform = 'translateY(0)';
                container.style.boxShadow = this.currentCharacterId === character.id
                    ? '0 0 12px rgba(76,175,80,0.5)'
                : 'none';
            });

            container.addEventListener('click', () => this.switchCharacter(character));
            return container;
        },

        async switchCharacter(character) {
            try {
                const joinRes = await fetch(CONFIG.API.JOIN, {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({ character: character.id })
                });

                if (!joinRes.ok) {
                    const errorText = await joinRes.text();
                    console.error('[CharacterSwitcher] Join failed:', joinRes.status, errorText);
                    MessageCanvas.show('Błąd', `Nie udało się przełączyć (${joinRes.status})`, '#ffd700');
                    return;
                }

                const joinData = await joinRes.json();

                if (joinRes.ok && joinData) {
                    MessageCanvas.show(character.name, "Przełączono na: ", '#ffd700');
                    setTimeout(() => {
                        window.location.href = 'https://world-retro.margatron.ovh/';
                    }, 500);
                } else {
                    MessageCanvas.show('Błąd', `Nie udało się przełączyć: ${joinData?.message || 'Nieznany błąd'}`, '#ffd700');
                }
            } catch (err) {
                console.error('[CharacterSwitcher]', err);
                MessageCanvas.show('Błąd', 'Błąd przy przełączaniu postaci', '#ffd700');
            }
        },

        makeDraggable(el) {
            let isDragging = false;
            let offsetX, offsetY;

            el.addEventListener('mousedown', e => {
                if (e.target.closest('[title]')) return;
                isDragging = true;
                offsetX = e.clientX - el.offsetLeft;
                offsetY = e.clientY - el.offsetTop;
                el.style.cursor = 'grabbing';
            });

            document.addEventListener('mousemove', e => {
                if (!isDragging) return;
                el.style.left = (e.clientX - offsetX) + 'px';
                el.style.top = (e.clientY - offsetY) + 'px';
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    el.style.cursor = 'grab';
                    localStorage.setItem('margatronPanelPos', JSON.stringify({
                        top: el.offsetTop,
                        left: el.offsetLeft
                    }));
                }
            });
        },

        remove() {
            if (this.panel) {
                this.panel.remove();
                this.panel = null;
            }
        }
    };
    // ======================== Licznik Ubić ========================
    const KillCounter = {
        panel: null,
        stats: new Map(),
        currentBattleMobs: [],
        currentCategory: 'all',
        STORAGE_KEY: 'killCounterStats',

        monsters: [
            { name: 'Czarna Wilczyca', lvl: '20', rank: 'ELITE' },
            { name: 'Astratus', lvl: '22', rank: 'ELITE' },
            { name: 'Kotołak Tropiciel', lvl: '23', rank: 'ELITE' },
            { name: 'Władca rzek', lvl: '37', rank: 'ELITE_II' },
            { name: 'Razuglag Oklash', lvl: '47', rank: 'ELITE_II' },
            { name: 'Goplana', lvl: '75', rank: 'ELITE_II' },
            { name: 'Mroczny Patryk', lvl: '35', rank: 'HERO' },
            { name: 'Lisz', lvl: '60', rank: 'ELITE' },
            { name: 'Vonaros', lvl: '60', rank: 'ELITE' },
            { name: 'Wilcza Paszcza', lvl: '48', rank: 'ELITE' },
            { name: 'Gnom Figlid', lvl: '48', rank: 'ELITE' },
            { name: 'Krogor', lvl: '48', rank: 'ELITE' },
            { name: 'Thowar', lvl: '47', rank: 'ELITE' },
            { name: 'Wilcza Jagoda', lvl: '47', rank: 'ELITE' },
            { name: 'Tollok Shimger', lvl: '43', rank: 'ELITE' },
            { name: 'Herszt rozbójników', lvl: '37', rank: 'ELITE' },
            { name: 'Mula Furla', lvl: '34', rank: 'ELITE' },
            { name: 'Cerber', lvl: '28', rank: 'ELITE' },
            { name: 'Paladyński Apostata', lvl: '25', rank: 'ELITE' },
            { name: 'Astaratus', lvl: '22', rank: 'ELITE' },
            { name: 'Szczęt alias Gładki', lvl: '47', rank: 'ELITE_II' },
            { name: 'Tarmus Wuden', lvl: '50', rank: 'ELITE_II' },
            { name: 'Tollok Atamatu', lvl: '73', rank: 'ELITE_II' },
            { name: 'Tollok Utumutu', lvl: '73', rank: 'ELITE_II' },
            { name: 'Wyznawca ciemnych mocy', lvl: '82', rank: 'ELITE_II' },
            { name: 'Mazurnik Przybrzeżny', lvl: '82', rank: 'ELITE_II' },
            { name: 'Łowca czaszek', lvl: '84', rank: 'ELITE_II' },
            { name: 'Grabarz świątynny', lvl: '88', rank: 'ELITE_II' },
            { name: 'Podły zbrojmistrz', lvl: '89', rank: 'ELITE_II' },
            { name: 'Nieumarły krzyżowiec', lvl: '92', rank: 'ELITE_II' },
            { name: 'Szkielet władcy żywiołów', lvl: '92', rank: 'ELITE_II' },
            { name: 'Morthen', lvl: '96', rank: 'ELITE_II' },
            { name: 'Miłośnik Łowców', lvl: '108', rank: 'ELITE_II' },
            { name: 'Miłośnik Rycerzy', lvl: '108', rank: 'ELITE_II' },
            { name: 'Miłośnik Magii', lvl: '108', rank: 'ELITE_II' },
            { name: 'Wójt Fistuła', lvl: '118', rank: 'ELITE_II' },
            { name: 'Krab pustelnik', lvl: '123', rank: 'ELITE_II' },
            { name: 'Królowa śniegu', lvl: '124', rank: 'ELITE_II' },
            { name: 'Teściowa Rumcajsa', lvl: '125', rank: 'ELITE_II' },
            { name: 'Poskramiacz Hydr', lvl: '128', rank: 'ELITE_II' },
            { name: 'Pogromczyni Mantikor', lvl: '128', rank: 'ELITE_II' },
            { name: 'Pogromca gryfów', lvl: '128', rank: 'ELITE_II' },
            { name: 'Burkog Lorulk', lvl: '135', rank: 'ELITE_II' },
            { name: 'Jertek Moxos', lvl: '136', rank: 'ELITE_II' },
            { name: 'Berserker Amuno', lvl: '139', rank: 'ELITE_II' },
            { name: 'Fodug Zolash', lvl: '145', rank: 'ELITE_II' },
            { name: 'Mistrz Worundriel', lvl: '148', rank: 'ELITE_II' },
            { name: 'Goons Asterus', lvl: '150', rank: 'ELITE_II' },
            { name: 'Adariel', lvl: '155', rank: 'ELITE_II' },
            { name: 'Duch władcy klanów', lvl: '160', rank: 'ELITE_II' },
            { name: 'Ogr Stalowy Pazur', lvl: '164', rank: 'ELITE_II' },
            { name: 'Fursharag pożeracz umysłów', lvl: '170', rank: 'ELITE_II' },
            { name: 'Ziuggrael strażnik królowej', lvl: '170', rank: 'ELITE_II' },
            { name: 'Bragarth myśliwy dusz', lvl: '170', rank: 'ELITE_II' },
            { name: 'Lusgrathera królowa pramatka', lvl: '175', rank: 'ELITE_II' },
            { name: 'Borgoros Garamir III', lvl: '175', rank: 'ELITE_II' },
            { name: 'Chryzoprenia', lvl: '178', rank: 'ELITE_II' },
            { name: 'Czempion Furboli', lvl: '183', rank: 'ELITE_II' },
            { name: 'Torunia Ankelwald', lvl: '186', rank: 'ELITE_II' },
            { name: 'Breheret żelazny łeb', lvl: '192', rank: 'ELITE_II' },
            { name: 'Mysiur myświórowy król', lvl: '193', rank: 'ELITE_II' },
            { name: 'Sadolia nadzorczyni Hurys', lvl: '197', rank: 'ELITE_II' },
            { name: 'Bergermona krwawa hrabina', lvl: '200', rank: 'ELITE_II' },
            { name: 'Sataniel skrytobójca', lvl: '200', rank: 'ELITE_II' },
            { name: 'Annaniel wysysacz marzeń', lvl: '200', rank: 'ELITE_II' },
            { name: 'Gothardus kolekcjoner głów', lvl: '200', rank: 'ELITE_II' },
            { name: 'Zufulus smakosz serc', lvl: '205', rank: 'ELITE_II' },
            { name: 'Arachniregina Colosseus', lvl: '220', rank: 'ELITE_II' },
            { name: 'Mocny Maddoks', lvl: '235', rank: 'ELITE_II' },
            { name: 'Cuaitl Citlalin', lvl: '250', rank: 'ELITE_II' },
            { name: 'Quetzalcoatl', lvl: '260', rank: 'ELITE_II' },
            { name: 'Neferkar Set', lvl: '274', rank: 'ELITE_II' },
            { name: 'Nymphemonia', lvl: '287', rank: 'ELITE_II' },
            { name: 'Zorin', lvl: '300', rank: 'ELITE_II' },
            { name: 'Furion', lvl: '300', rank: 'ELITE_II' },
            { name: 'Artenius', lvl: '300', rank: 'ELITE_II' },
            { name: 'Domina Ecclesiae', lvl: '21', rank: 'HERO' },
            { name: 'Mietek Żul', lvl: '25', rank: 'HERO' },
            { name: 'Karmazynowy Mściciel', lvl: '45', rank: 'HERO' },
            { name: 'Złodziej', lvl: '50', rank: 'HERO' },
            { name: 'Zły Przewodnik', lvl: '63', rank: 'HERO' },
            { name: 'Piekielny Kościej', lvl: '74', rank: 'HERO' },
            { name: 'Opętany Paladyn', lvl: '85', rank: 'HERO' },
            { name: 'Kochanka Nocy', lvl: '100', rank: 'HERO' },
            { name: 'Perski Książę', lvl: '116', rank: 'HERO' },
            { name: 'Baca Bez Łowiec', lvl: '123', rank: 'HERO' },
            { name: 'Obłąkany łowca orków', lvl: '144', rank: 'HERO' },
            { name: 'Czarująca Atalia', lvl: '157', rank: 'HERO' },
            { name: 'Święty Braciszek', lvl: '165', rank: 'HERO' },
            { name: 'Viviana Nandin', lvl: '184', rank: 'HERO' },
            { name: 'Demonis Pan Nicości', lvl: '210', rank: 'HERO' },
            { name: 'Tepeyollotl', lvl: '260', rank: 'HERO' },
            { name: 'Dziewicza Orlica', lvl: '51', rank: 'TITAN' },
            { name: 'Zabójczy królik', lvl: '70', rank: 'TITAN' },
            { name: 'Renegat Baulus', lvl: '101', rank: 'TITAN' },
            { name: 'Piekielny Arcymag', lvl: '131', rank: 'TITAN' },
            { name: 'Versus Zoons', lvl: '154', rank: 'TITAN' },
            { name: 'Łowczyni Wspomnień', lvl: '177', rank: 'TITAN' },
            { name: 'Przyzywacz demonów', lvl: '204', rank: 'TITAN' },
            { name: 'Maddok Magua', lvl: '231', rank: 'TITAN' },
            { name: 'Tezcatlipoca', lvl: '258', rank: 'TITAN' },
            { name: 'Tanroth', lvl: '285', rank: 'TITAN' },
            { name: 'Biała Dama', lvl: '40', rank: 'HERO' },
            { name: 'Zjawa Pustej Maski', lvl: '43', rank: 'ELITE_II' },
            { name: 'Karnawałowa Piękność', lvl: '35', rank: 'ELITE' },
            { name: 'Dowódca Ghuli', lvl: '45', rank: 'ELITE' },
            { name: 'Łowca skór', lvl: '81', rank: 'ELITE' },
            { name: 'Zarządca magazynu', lvl: '82', rank: 'ELITE' },
            { name: 'Szalony miś', lvl: '115', rank: 'ELITE' },
            { name: 'Tollok Shimger', lvl: '43', rank: 'ELITE' },
            { name: 'Zabalsamowany wyznawca Seta', lvl: '118', rank: 'ELITE' },
            { name: 'Cheperu', lvl: '114', rank: 'ELITE' },
            { name: 'Henry Kaprawe Oko', lvl: '114', rank: 'ELITE' },
            { name: 'Marid', lvl: '120', rank: 'ELITE' },
            { name: 'Szkielet bosmana', lvl: '130', rank: 'ELITE' },
            { name: 'Monstrum z Bremus An', lvl: '85', rank: 'ELITE' },
        ],

        getMobInfo(mobName) {
            const normalized = mobName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const found = this.monsters.find(m => {
                const monsterNormalized = m.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                return monsterNormalized === normalized;
            });
            return found || { lvl: '??', rank: 'UNKNOWN' };
        },

        async imageToBase64(imgUrl) {
            try {
                const response = await fetch(imgUrl);
                const blob = await response.blob();
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                });
            } catch (e) {
                console.log('[KillCounter] Błąd konwersji obrazu', e);
                return null;
            }
        },

        toggle(enabled) {
            GM_setValue('killCounterEnabled', enabled);
            if (enabled) {
                this.loadStats();
                this.init();
                intervalManager.set('killCounter', () => this.monitorBattle(), 100);
            } else {
                intervalManager.clear('killCounter');
                this.closePanel();
            }
        },

        init() {
            this.createPanel();
        },

        monitorBattle() {
            const battleWindow = document.querySelector('.battle-window');
            if (battleWindow && this.currentBattleMobs.length === 0) {
                this.captureMobData();
            } else if (!battleWindow && this.currentBattleMobs.length > 0) {
                setTimeout(() => {
                    this.checkBattleResult();
                }, 100);
            }
        },

        checkBattleResult() {
            if (this.currentBattleMobs.length === 0) return;
            const isDead = document.querySelector('#game-map-window .dazed');

            if (!isDead) {
                setTimeout(() => {
                    this.countLoot();
                    this.incrementKillCount();
                    this.currentBattleMobs = [];
                }, 100);
            } else {
                this.currentBattleMobs = [];
            }
        },

        async captureMobData() {
            const battleWindow = document.querySelector('.battle-window');
            if (!battleWindow) return;
            this.currentBattleMobs = [];
            const opponentDivs = battleWindow.querySelectorAll('.opponent');
            for (const opponentDiv of opponentDivs) {
                let mobName = null;
                let mobLevel = '??';
                let mobImage = null;
                const imgElement = opponentDiv.querySelector('img');
                if (imgElement) {
                    mobImage = imgElement.src || imgElement.getAttribute('data-src');

                    const altText = imgElement.getAttribute('alt');
                    if (altText) {
                        mobName = altText
                            .replace(/&lt;br&gt;/g, ' ')
                            .replace(/<br>/g, ' ')
                            .replace(/\s+/g, ' ')
                            .trim();

                        const percentMatch = mobName.match(/(\d+)%/);
                        if (percentMatch) {
                            mobName = mobName.replace(/\d+%/, '').trim();
                        }
                    }

                    const dataHtml = imgElement.getAttribute('data-html');
                    if (dataHtml && !mobName) {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = dataHtml;
                        mobName = tempDiv.textContent.trim();
                    }
                }

                const dataNpc = opponentDiv.getAttribute('data-npc');
                if (dataNpc) {
                    try {
                        const data = JSON.parse(dataNpc);
                        mobLevel = data?.schema?.inner?.lvl || '??';

                        if (!mobName) {
                            mobName = data?.schema?.inner?.name;
                        }
                    } catch (e) {
                        console.log('[KillCounter] Błąd parsowania data-npc:', e);
                    }
                }

                if (!mobName) {
                    console.log('[KillCounter] Pominięto moba bez nazwy');
                    continue;
                }

                mobName = mobName
                    .replace(/\d+%/g, '')
                    .replace(/\[.*?\]/g, '')
                    .trim();

                const mobInfo = this.getMobInfo(mobName);
                if (mobInfo.rank === 'UNKNOWN') {
                    console.log('[KillCounter] Pominięto moba spoza listy:', mobName);
                    continue;
                }

                let imageBase64 = null;
                if (mobImage) {
                    imageBase64 = await this.imageToBase64(mobImage);
                }

                this.currentBattleMobs.push({
                    name: mobName,
                    level: mobInfo.lvl,
                    rank: mobInfo.rank,
                    image: imageBase64,
                    lootedItems: []
                });
            }

            console.log('[KillCounter] Zapisano moby:', this.currentBattleMobs);
        },

        countLoot() {
            if (this.currentBattleMobs.length === 0) return;

            const lootsWindow = document.querySelector('#loots');
            if (!lootsWindow) {
                console.log('[KillCounter] Brak okna łupów');
                return;
            }

            const lootItems = lootsWindow.querySelectorAll('.loot-wrapper [data-item]');
            console.log('[KillCounter] Znaleziono przedmiotów:', lootItems.length);
            const collectedLoots = [];
            lootItems.forEach(item => {
                const data = Utils.parseItemData(item);
                if (!data) return;

                const rarity = data.schema?.inner?.rarity?.toLowerCase();
                console.log('[KillCounter] Przedmiot:', data.schema?.inner?.name, 'Rzadkość:', rarity);

                if (rarity === 'unique' || rarity === 'heroic' || rarity === 'legendary') {
                    collectedLoots.push(rarity);
                }
            });

            console.log('[KillCounter] Zebrane looty:', collectedLoots);
            if (this.currentBattleMobs.length > 0) {
                collectedLoots.forEach((loot, index) => {
                    const mobIndex = index % this.currentBattleMobs.length;
                    this.currentBattleMobs[mobIndex].lootedItems.push(loot);
                });
            }

            console.log('[KillCounter] Looty przypisane do mobów:', this.currentBattleMobs);
        },

        incrementKillCount() {
            if (this.currentBattleMobs.length === 0) return;
            this.currentBattleMobs.forEach(currentMob => {
                const mobName = currentMob.name;
                const existing = this.stats.get(mobName) || {
                    name: mobName,
                    level: currentMob.level,
                    rank: currentMob.rank,
                    image: currentMob.image,
                    kills: 0,
                    unique: 0,
                    heroic: 0,
                    legendary: 0
                };

                if (currentMob.image) {
                    existing.image = currentMob.image;
                }

                existing.kills++;
                existing.unique += currentMob.lootedItems.filter(i => i === 'unique').length;
                existing.heroic += currentMob.lootedItems.filter(i => i === 'heroic').length;
                existing.legendary += currentMob.lootedItems.filter(i => i === 'legendary').length;
                console.log('[KillCounter] Aktualizacja statystyk dla:', mobName, existing);
                this.stats.set(mobName, existing);
            });

            this.saveStats();
            this.updatePanel();
        },

        saveStats() {
            const toSave = {};
            for (const [name, data] of this.stats.entries()) {
                toSave[name] = data;
            }
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toSave));
        },

        loadStats() {
            const stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
            for (const name in stored) {
                this.stats.set(name, stored[name]);
            }
        },

        createPanel() {
            if (this.panel) return;

            this.panel = document.createElement('div');
            this.panel.id = 'kill-counter-panel';
            Object.assign(this.panel.style, {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                padding: '15px',
                backgroundColor: 'rgba(11, 37, 5)',
                borderRadius: '12px',
                color: 'white',
                fontFamily: 'Times New Roman',
                fontSize: '13px',
                zIndex: '9998',
                minWidth: '250px',
                maxWidth: '500px',
                maxHeight: '80vh',
                boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
                border: '2px solid #1a4d0d',
                display: 'none'
            });

            const header = this.createHeader();
            const categories = this.createCategories();
            const content = this.createContent();

            this.panel.appendChild(header);
            this.panel.appendChild(categories);
            this.panel.appendChild(content);
            document.body.appendChild(this.panel);

            this.makeDraggable(this.panel);
        },

        createHeader() {
            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '15px',
                paddingBottom: '10px',
                borderBottom: '1px solid #1a4d0d'
            });

            const leftSide = document.createElement('div');
            Object.assign(leftSide.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            });

            const icon = document.createElement('img');
            icon.src = 'https://imgur.com/RuPIRfz.png';
            Object.assign(icon.style, {
                width: '28px',
                height: '28px',
                borderRadius: '6px'
            });

            const title = document.createElement('span');
            title.textContent = 'Licznik Ubić';
            Object.assign(title.style, {
                fontSize: '18px',
                fontWeight: 'bold',
                userSelect: 'none'
            });

            leftSide.appendChild(icon);
            leftSide.appendChild(title);

            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✖';
            Object.assign(closeBtn.style, {
                background: 'transparent',
                border: 'none',
                color: '#CC5252',
                fontSize: '20px',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                borderRadius: '6px',
                padding: '4px 8px'
            });

            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.color = '#ff6666';
                closeBtn.style.background = 'rgba(255,255,255,0.1)';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.color = '#CC5252';
                closeBtn.style.background = 'transparent';
            });

            closeBtn.addEventListener('click', () => this.closePanel());
            header.appendChild(leftSide);
            header.appendChild(closeBtn);

            return header;
        },

        createCategories() {
            const container = document.createElement('div');
            Object.assign(container.style, {
                display: 'flex',
                gap: '6px',
                marginBottom: '12px',
                flexWrap: 'wrap'
            });

            const categories = [
                { id: 'all', label: 'Wszystkie', color: '#1a4d0d' },
                { id: 'hero', label: 'Herosi', color: '#ffc600' },
                { id: 'titan', label: 'Tytani', color: '#ff6c00' },
                { id: 'elite2', label: 'Elita II', color: '#54ff00' },
                { id: 'elite', label: 'Elita', color: '#00aeff' },
            ];

            categories.forEach(cat => {
                const btn = document.createElement('button');
                btn.textContent = cat.label;
                Object.assign(btn.style, {
                    padding: '6px 12px',
                    background: this.currentCategory === cat.id ? cat.color : '#061d02',
                    border: `1px solid ${cat.color}`,
                    color: 'white',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    transition: 'all 0.2s ease',
                    fontFamily: 'times-new-roman'
                });

                btn.addEventListener('mouseenter', () => {
                    if (this.currentCategory !== cat.id) {
                        btn.style.background = `${cat.color}33`;
                    }
                });

                btn.addEventListener('mouseleave', () => {
                    if (this.currentCategory !== cat.id) {
                        btn.style.background = '#061d02';
                    }
                });

                btn.addEventListener('click', () => {
                    this.currentCategory = cat.id;
                    container.querySelectorAll('button').forEach((b, i) => {
                        b.style.background = categories[i].id === cat.id ? categories[i].color : '#061d02';
                    });
                    this.updatePanel();
                });

                container.appendChild(btn);
            });

            return container;
        },

        createContent() {
            const content = document.createElement('div');
            content.id = 'kill-counter-list';
            Object.assign(content.style, {
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '45vh',
                overflowY: 'auto',
                paddingRight: '8px',
                scrollbarWidth: 'thin',
                scrollbarColor: '#1a4d0d #061d02'
            });

            return content;
        },

        updatePanel() {
            const content = document.querySelector('#kill-counter-list');
            if (!content) return;
            content.innerHTML = '';

            let filtered = [...this.stats.entries()];

            if (this.currentCategory === 'hero') {
                filtered = filtered.filter(([_, data]) => data.rank === 'HERO');
            } else if (this.currentCategory === 'titan') {
                filtered = filtered.filter(([_, data]) => data.rank === 'TITAN');
            } else if (this.currentCategory === 'elite2') {
                filtered = filtered.filter(([_, data]) => data.rank === 'ELITE_II');
            } else if (this.currentCategory === 'elite') {
                filtered = filtered.filter(([_, data]) => data.rank === 'ELITE');
            } else if (this.currentCategory === 'unknown') {
                filtered = filtered.filter(([_, data]) => data.rank === 'UNKNOWN' || !data.rank);
            }

            const sorted = filtered.sort((a, b) => b[1].kills - a[1].kills);
            sorted.forEach(([name, data]) => {
                const row = this.createMobRow(data);
                content.appendChild(row);
            });

            if (sorted.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = 'Brak danych w tej kategorii';
                Object.assign(empty.style, {
                    textAlign: 'center',
                    padding: '20px',
                    color: '#888',
                    fontStyle: 'italic'
                });
                content.appendChild(empty);
            }
        },

        createMobRow(data) {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'grid',
                gridTemplateColumns: '70px 1fr',
                gap: '12px',
                alignItems: 'center',
                padding: '12px',
                background: '#061d02',
                borderRadius: '8px',
                border: '1px solid #1a4d0d',
                transition: 'all 0.2s ease',
                position: 'relative'
            });

            row.addEventListener('mouseenter', () => {
                row.style.background = '#0a2505';
                row.style.transform = 'translateX(4px)';
            });

            row.addEventListener('mouseleave', () => {
                row.style.background = '#061d02';
                row.style.transform = 'translateX(0)';
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️';
            Object.assign(deleteBtn.style, {
                position: 'absolute',
                top: '6px',
                right: '6px',
                background: 'rgba(255,0,0,0.2)',
                border: '1px solid #ff0000',
                color: '#ff6666',
                cursor: 'pointer',
                padding: '3px 5px',
                borderRadius: '4px',
                fontSize: '10px',
                transition: 'all 0.2s ease',
                lineHeight: '1',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            });

            deleteBtn.addEventListener('mouseenter', () => {
                deleteBtn.style.background = 'rgba(255,0,0,0.4)';
                deleteBtn.style.transform = 'scale(1.1)';
            });

            deleteBtn.addEventListener('mouseleave', () => {
                deleteBtn.style.background = 'rgba(255,0,0,0.2)';
                deleteBtn.style.transform = 'scale(1)';
            });

            deleteBtn.addEventListener('click', () => {
                this.stats.delete(data.name);
                this.saveStats();
                this.updatePanel();
            });

            const leftColumn = document.createElement('div');
            Object.assign(leftColumn.style, {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
            });

            const imgWrapper = document.createElement('div');
            Object.assign(imgWrapper.style, {
                width: '54px',
                height: '54px',
                borderRadius: '8px',
                overflow: 'hidden',
                background: '#10240a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #1a4d0d'
            });

            const img = document.createElement('img');
            img.src = data.image || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
            Object.assign(img.style, {
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
            });
            imgWrapper.appendChild(img);

            const levelSpan = document.createElement('span');
            levelSpan.textContent = `${data.level} lvl`;
            Object.assign(levelSpan.style, {
                fontSize: '11px',
                color: '#ffffff',
                fontWeight: '600'
            });

            const rankColors = {
                HERO: '#ffc600',
                TITAN: '#ff6c00',
                ELITE_II: '#54ff00',
                ELITE: '#00aeff',
                UNKNOWN: '#888',
                COMMON: '#888'
            };

            const rankNames = {
                HERO: 'Heros',
                TITAN: 'Tytan',
                ELITE_II: 'Elita II',
                ELITE: 'Elita',
                UNKNOWN: 'Nieznany',
                COMMON: ''
            };

            const rankSpan = document.createElement('span');
            rankSpan.textContent = rankNames[data.rank] || 'Nieznany';
            Object.assign(rankSpan.style, {
                fontSize: '10px',
                color: rankColors[data.rank] || '#888',
                fontWeight: 'bold',
                textAlign: 'center'
            });

            leftColumn.appendChild(imgWrapper);
            leftColumn.appendChild(levelSpan);
            if (rankSpan.textContent) leftColumn.appendChild(rankSpan);

            const rightColumn = document.createElement('div');
            Object.assign(rightColumn.style, {
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '30px'
            });

            const nameSpan = document.createElement('div');
            nameSpan.textContent = data.name;
            Object.assign(nameSpan.style, {
                fontWeight: 'bold',
                color: '#ffffff',
                fontSize: '17px'
            });

            const statsRow = document.createElement('div');
            Object.assign(statsRow.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                fontSize: '12px',
                flexWrap: 'wrap'
            });

            const itemColors = {
                unique: GM_getValue('highlightColorUnique', '#f5b536'),
                heroic: GM_getValue('highlightColorHeroic', '#3193f5'),
                legendary: GM_getValue('highlightColorLegendary', '#d1249e')
            };

            const killsSpan = document.createElement('span');
            killsSpan.innerHTML = `<strong style="color: #ffffff;">Ubicia:</strong> <span style="color: #fff;">${data.kills}</span>`;

            const uniqueSpan = document.createElement('span');
            uniqueSpan.innerHTML = `<strong style="color: ${itemColors.unique};">Unikat:</strong> <span style="color: #fff;">${data.unique}</span>`;

            const heroicSpan = document.createElement('span');
            heroicSpan.innerHTML = `<strong style="color: ${itemColors.heroic};">Heroiczny:</strong> <span style="color: #fff;">${data.heroic}</span>`;

            const legendarySpan = document.createElement('span');
            legendarySpan.innerHTML = `<strong style="color: ${itemColors.legendary};">Legendarny:</strong> <span style="color: #fff;">${data.legendary}</span>`;

            statsRow.appendChild(killsSpan);
            statsRow.appendChild(uniqueSpan);
            statsRow.appendChild(heroicSpan);
            statsRow.appendChild(legendarySpan);

            rightColumn.appendChild(nameSpan);
            rightColumn.appendChild(statsRow);

            row.appendChild(leftColumn);
            row.appendChild(rightColumn);
            row.appendChild(deleteBtn);

            return row;
        },

        makeDraggable(el) {
            let isDragging = false;
            let offsetX, offsetY;

            el.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                isDragging = true;
                offsetX = e.clientX - el.offsetLeft;
                offsetY = e.clientY - el.offsetTop;
                el.style.cursor = 'grabbing';
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                el.style.left = (e.clientX - offsetX) + 'px';
                el.style.top = (e.clientY - offsetY) + 'px';
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    el.style.cursor = 'grab';
                }
            });
        },

        openPanel() {
            if (this.panel) {
                this.panel.style.display = 'block';
                this.updatePanel();
            }
        },

        closePanel() {
            if (this.panel) {
                this.panel.style.display = 'none';
            }
        },

        togglePanel() {
            if (!this.panel) {
                this.createPanel();
            }

            if (this.panel.style.display === 'none') {
                this.openPanel();
            } else {
                this.closePanel();
            }
        }
    };

    // ======================== HOT KEYS ========================
    const HotKeys = {
        toggles: [
            { id: 'hotkeys-autofight', var: 'autofight', idx: 1, gmKey: 'autoFightEnabled', addon: 'autoBattleEnabled' },
            { id: 'hotkeys-autoclose', var: 'autoclose', idx: 0, gmKey: 'autoCloseEnabled', addon: 'autoBattleEnabled' },
            { id: 'hotkeys-autoheal', var: 'autoheal', idx: 2, gmKey: 'autoHealingEnabled', addon: 'autoHealEnabled', hasSettings: true },
            { id: 'hotkeys-goldeater', var: 'goldeater', idx: 3, gmKey: 'eatGold', addon: 'autoGoldEnabled' },
            { id: 'hotkeys-disablemessage', var: 'disablemessage', idx: 4, gmKey: 'disableMessages', addon: 'hotKeysEnabled' },
            { id: 'hotkeys-lootfilter', var: 'lootfilter', idx: 5, gmKey: 'lootFilterDisable', addon: 'autoLootEnabled', hasSettings: true },
            { id: 'hotkeys-agressive', var: 'agressive', idx: 6, gmKey: 'autoAgressiveDisable', addon: 'autoAgressiveEnabled' },
            { id: 'hotkeys-killcounter', var: 'killcounter', idx: 7, gmKey: 'killCounterPanelOpen', addon: 'killCounterEnabled', hasSettings: true }
        ],

        init() {
            this.toggles.forEach(t => {
                window[t.var] = GM_getValue(t.gmKey, false);
            });
        },

        toggle(enabled) {
            GM_setValue('hotKeysEnabled', enabled);
            const container = document.querySelector('#panel');
            if (!container) return;

            this.remove(container);
            if (enabled) this.add(container);
        },

        add(container) {
            if (document.getElementById('hotkeys-autofight')) return;

            this.toggles.forEach(({ id, var: toggleVar, idx, gmKey, addon, hasSettings }) => {
                if (!GM_getValue(addon, true)) return;

                const wrapper = this.createButtonWrapper(id, toggleVar, idx, gmKey, hasSettings, addon);
                container.appendChild(wrapper);
            });
        },

        remove(container) {
            this.toggles.forEach(({ id }) => {
                container.querySelector(`#${id}-wrapper`)?.remove();
            });
        },

        createButtonWrapper(id, toggleVar, iconIdx, gmKey, hasSettings, addonId) {
            const wrapper = document.createElement('div');
            wrapper.id = `${id}-wrapper`;
            Object.assign(wrapper.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                position: 'relative',
                left: '102%',
                margin: '0 4px'
            });

            const btn = this.createButton(id, toggleVar, iconIdx, gmKey);
            wrapper.appendChild(btn);

            if (hasSettings) {
                const settingsBtn = this.createSettingsButton(addonId);
                wrapper.appendChild(settingsBtn);
            }

            return wrapper;
        },

        createButton(id, toggleVar, iconIdx, gmKey) {
            const btn = document.createElement('div');
            btn.id = id;

            const isActive = window[toggleVar];
            Object.assign(btn.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '28px',
                height: '28px',
                cursor: 'pointer',
                userSelect: 'none',
                borderRadius: '4px',
                transition: 'all 0.2s ease',
                backgroundColor: isActive ? 'rgba(76, 175, 80, 0.15)' : 'transparent',
                border: isActive ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid transparent'
            });

            const img = document.createElement('img');
            img.src = isActive ? CONFIG.ICONS.HOTKEYS.ON[iconIdx] : CONFIG.ICONS.HOTKEYS.OFF[iconIdx];
            Object.assign(img.style, {
                width: '22px',
                height: '22px',
                transition: 'all 0.2s ease',
                filter: isActive ? 'drop-shadow(0 0 3px rgba(76, 175, 80, 0.6))' : 'none'
            });
            btn.appendChild(img);

            btn.addEventListener('mouseenter', () => {
                btn.style.backgroundColor = window[toggleVar] ?
                    'rgba(76, 175, 80, 0.25)' : 'rgba(255, 255, 255, 0.1)';
                img.style.transform = 'scale(1.1)';
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.backgroundColor = window[toggleVar] ?
                    'rgba(76, 175, 80, 0.15)' : 'transparent';
                img.style.transform = 'scale(1)';
            });

            btn.addEventListener('click', () => {
                if (id === 'hotkeys-killcounter') {
                    KillCounter.togglePanel();
                    return;
                }

                window[toggleVar] = !window[toggleVar];
                img.src = window[toggleVar] ?
                    CONFIG.ICONS.HOTKEYS.ON[iconIdx] : CONFIG.ICONS.HOTKEYS.OFF[iconIdx];
                btn.style.backgroundColor = window[toggleVar] ?
                    'rgba(76, 175, 80, 0.15)' : 'transparent';
                btn.style.border = window[toggleVar] ?
                    '1px solid rgba(76, 175, 80, 0.4)' : '1px solid transparent';
                img.style.filter = window[toggleVar] ?
                    'drop-shadow(0 0 3px rgba(76, 175, 80, 0.6))' : 'none';

                GM_setValue(gmKey, window[toggleVar]);
                btn.style.transform = 'scale(0.9)';
                setTimeout(() => btn.style.transform = 'scale(1)', 100);
            });

            return btn;
        },

        createSettingsButton(addonId) {
            const settingsBtn = document.createElement('div');
            Object.assign(settingsBtn.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '20px',
                height: '28px',
                cursor: 'pointer',
                userSelect: 'none',
                borderRadius: '4px',
                transition: 'all 0.2s ease',
                backgroundColor: 'transparent',
                border: '1px solid transparent',
                fontSize: '14px',
                opacity: '0.6'
            });

            settingsBtn.innerHTML = '⚙️';

            settingsBtn.addEventListener('mouseenter', () => {
                settingsBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                settingsBtn.style.opacity = '1';
                settingsBtn.style.transform = 'rotate(90deg)';
            });

            settingsBtn.addEventListener('mouseleave', () => {
                settingsBtn.style.backgroundColor = 'transparent';
                settingsBtn.style.opacity = '0.6';
                settingsBtn.style.transform = 'rotate(0deg)';
            });

            settingsBtn.addEventListener('click', () => {
                const addon = ADDONS.find(a => a.id === addonId);
                if (addon && addon.settings) {
                    document.getElementById('settings-popup')?.remove();
                    PanelUI.createSettingsPopup(addon.settings);
                    settingsBtn.style.transform = 'scale(0.9) rotate(90deg)';
                    setTimeout(() => {
                        settingsBtn.style.transform = 'rotate(90deg)';
                    }, 100);
                }
            });

            return settingsBtn;
        }
    };

    // ======================== MINUTNIK ========================
    const Minutnik = {
        timers: new Map(),
        container: null,
        compactMode: false,
        timersList: null,
        globalInterval: null,
        STORAGE_KEY: 'activeEliteTimers',

        monsters: [
            { name: 'Czarna Wilczyca', lvl: '20', rank: 'ELITE' },
            { name: 'Astratus', lvl: '22', rank: 'ELITE' },
            { name: 'Kotołak Tropiciel', lvl: '23', rank: 'ELITE' },
            { name: 'Władca rzek', lvl: '37', rank: 'ELITE_II' },
            { name: 'Razuglag Oklash', lvl: '47', rank: 'ELITE_II' },
            { name: 'Goplana', lvl: '75', rank: 'ELITE_II' },
            { name: 'Mroczny Patryk', lvl: '35', rank: 'HERO' },
            { name: 'Lisz', lvl: '60', rank: 'ELITE' },
            { name: 'Vonaros', lvl: '60', rank: 'ELITE' },
            { name: 'Wilcza Paszcza', lvl: '48', rank: 'ELITE' },
            { name: 'Gnom Figlid', lvl: '48', rank: 'ELITE' },
            { name: 'Krogor', lvl: '48', rank: 'ELITE' },
            { name: 'Thowar', lvl: '47', rank: 'ELITE' },
            { name: 'Wilcza Jagoda', lvl: '47', rank: 'ELITE' },
            { name: 'Tollok Shimger', lvl: '43', rank: 'ELITE' },
            { name: 'Herszt rozbójników', lvl: '37', rank: 'ELITE' },
            { name: 'Mula Furla', lvl: '34', rank: 'ELITE' },
            { name: 'Cerber', lvl: '28', rank: 'ELITE' },
            { name: 'Paladyński Apostata', lvl: '25', rank: 'ELITE' },
            { name: 'Astaratus', lvl: '22', rank: 'ELITE' },
            { name: 'Szczęt alias Gładki', lvl: '47', rank: 'ELITE_II' },
            { name: 'Tarmus Wuden', lvl: '50', rank: 'ELITE_II' },
            { name: 'Tollok Atamatu', lvl: '73', rank: 'ELITE_II' },
            { name: 'Tollok Utumutu', lvl: '73', rank: 'ELITE_II' },
            { name: 'Wyznawca ciemnych mocy', lvl: '82', rank: 'ELITE_II' },
            { name: 'Mazurnik Przybrzeżny', lvl: '82', rank: 'ELITE_II' },
            { name: 'Łowca czaszek', lvl: '84', rank: 'ELITE_II' },
            { name: 'Grabarz świątynny', lvl: '88', rank: 'ELITE_II' },
            { name: 'Podły zbrojmistrz', lvl: '89', rank: 'ELITE_II' },
            { name: 'Nieumarły krzyżowiec', lvl: '92', rank: 'ELITE_II' },
            { name: 'Szkielet władcy żywiołów', lvl: '92', rank: 'ELITE_II' },
            { name: 'Morthen', lvl: '96', rank: 'ELITE_II' },
            { name: 'Miłośnik Łowców', lvl: '108', rank: 'ELITE_II' },
            { name: 'Miłośnik Rycerzy', lvl: '108', rank: 'ELITE_II' },
            { name: 'Miłośnik Magii', lvl: '108', rank: 'ELITE_II' },
            { name: 'Wójt Fistuła', lvl: '118', rank: 'ELITE_II' },
            { name: 'Krab pustelnik', lvl: '123', rank: 'ELITE_II' },
            { name: 'Królowa śniegu', lvl: '124', rank: 'ELITE_II' },
            { name: 'Teściowa Rumcajsa', lvl: '125', rank: 'ELITE_II' },
            { name: 'Poskramiacz Hydr', lvl: '128', rank: 'ELITE_II' },
            { name: 'Pogromczyni Mantikor', lvl: '128', rank: 'ELITE_II' },
            { name: 'Pogromca gryfów', lvl: '128', rank: 'ELITE_II' },
            { name: 'Burkog Lorulk', lvl: '135', rank: 'ELITE_II' },
            { name: 'Jertek Moxos', lvl: '136', rank: 'ELITE_II' },
            { name: 'Berserker Amuno', lvl: '139', rank: 'ELITE_II' },
            { name: 'Fodug Zolash', lvl: '145', rank: 'ELITE_II' },
            { name: 'Mistrz Worundriel', lvl: '148', rank: 'ELITE_II' },
            { name: 'Goons Asterus', lvl: '150', rank: 'ELITE_II' },
            { name: 'Adariel', lvl: '155', rank: 'ELITE_II' },
            { name: 'Duch władcy klanów', lvl: '160', rank: 'ELITE_II' },
            { name: 'Ogr Stalowy Pazur', lvl: '164', rank: 'ELITE_II' },
            { name: 'Fursharag pożeracz umysłów', lvl: '170', rank: 'ELITE_II' },
            { name: 'Ziuggrael strażnik królowej', lvl: '170', rank: 'ELITE_II' },
            { name: 'Bragarth myśliwy dusz', lvl: '170', rank: 'ELITE_II' },
            { name: 'Lusgrathera królowa pramatka', lvl: '175', rank: 'ELITE_II' },
            { name: 'Borgoros Garamir III', lvl: '175', rank: 'ELITE_II' },
            { name: 'Chryzoprenia', lvl: '178', rank: 'ELITE_II' },
            { name: 'Czempion Furboli', lvl: '183', rank: 'ELITE_II' },
            { name: 'Torunia Ankelwald', lvl: '186', rank: 'ELITE_II' },
            { name: 'Breheret żelazny łeb', lvl: '192', rank: 'ELITE_II' },
            { name: 'Mysiur myświórowy król', lvl: '193', rank: 'ELITE_II' },
            { name: 'Sadolia nadzorczyni Hurys', lvl: '197', rank: 'ELITE_II' },
            { name: 'Bergermona krwawa hrabina', lvl: '200', rank: 'ELITE_II' },
            { name: 'Sataniel skrytobójca', lvl: '200', rank: 'ELITE_II' },
            { name: 'Annaniel wysysacz marzeń', lvl: '200', rank: 'ELITE_II' },
            { name: 'Gothardus kolekcjoner głów', lvl: '200', rank: 'ELITE_II' },
            { name: 'Zufulus smakosz serc', lvl: '205', rank: 'ELITE_II' },
            { name: 'Arachniregina Colosseus', lvl: '220', rank: 'ELITE_II' },
            { name: 'Mocny Maddoks', lvl: '235', rank: 'ELITE_II' },
            { name: 'Cuaitl Citlalin', lvl: '250', rank: 'ELITE_II' },
            { name: 'Quetzalcoatl', lvl: '260', rank: 'ELITE_II' },
            { name: 'Neferkar Set', lvl: '274', rank: 'ELITE_II' },
            { name: 'Nymphemonia', lvl: '287', rank: 'ELITE_II' },
            { name: 'Zorin', lvl: '300', rank: 'ELITE_II' },
            { name: 'Furion', lvl: '300', rank: 'ELITE_II' },
            { name: 'Artenius', lvl: '300', rank: 'ELITE_II' },
            { name: 'Domina Ecclesiae', lvl: '21', rank: 'HERO' },
            { name: 'Mietek Żul', lvl: '25', rank: 'HERO' },
            { name: 'Karmazynowy Mściciel', lvl: '45', rank: 'HERO' },
            { name: 'Złodziej', lvl: '50', rank: 'HERO' },
            { name: 'Zły Przewodnik', lvl: '63', rank: 'HERO' },
            { name: 'Piekielny Kościej', lvl: '74', rank: 'HERO' },
            { name: 'Opętany Paladyn', lvl: '85', rank: 'HERO' },
            { name: 'Kochanka Nocy', lvl: '100', rank: 'HERO' },
            { name: 'Perski Książę', lvl: '116', rank: 'HERO' },
            { name: 'Baca Bez Łowiec', lvl: '123', rank: 'HERO' },
            { name: 'Obłąkany łowca orków', lvl: '144', rank: 'HERO' },
            { name: 'Czarująca Atalia', lvl: '157', rank: 'HERO' },
            { name: 'Święty Braciszek', lvl: '165', rank: 'HERO' },
            { name: 'Viviana Nandin', lvl: '184', rank: 'HERO' },
            { name: 'Demonis Pan Nicości', lvl: '210', rank: 'HERO' },
            { name: 'Tepeyollotl', lvl: '260', rank: 'HERO' },
            { name: 'Dziewicza Orlica', lvl: '51', rank: 'TITAN' },
            { name: 'Zabójczy królik', lvl: '70', rank: 'TITAN' },
            { name: 'Renegat Baulus', lvl: '101', rank: 'TITAN' },
            { name: 'Piekielny Arcymag', lvl: '131', rank: 'TITAN' },
            { name: 'Versus Zoons', lvl: '154', rank: 'TITAN' },
            { name: 'Łowczyni Wspomnień', lvl: '177', rank: 'TITAN' },
            { name: 'Przyzywacz demonów', lvl: '204', rank: 'TITAN' },
            { name: 'Maddok Magua', lvl: '231', rank: 'TITAN' },
            { name: 'Tezcatlipoca', lvl: '258', rank: 'TITAN' },
            { name: 'Tanroth', lvl: '285', rank: 'TITAN' },
            { name: 'Biała Dama', lvl: '40', rank: 'HERO' },
            { name: 'Zjawa Pustej Maski', lvl: '43', rank: 'ELITE_II' },
            { name: 'Dowódca Ghuli', lvl: '45', rank: 'ELITE' },
            { name: 'Łowca skór', lvl: '81', rank: 'ELITE' },
            { name: 'Zarządca magazynu', lvl: '82', rank: 'ELITE' },
            { name: 'Szalony miś', lvl: '115', rank: 'ELITE' },
            { name: 'Tollok Shimger', lvl: '43', rank: 'ELITE' },
            { name: 'Zabalsamowany wyznawca Seta', lvl: '118', rank: 'ELITE' },
            { name: 'Cheperu', lvl: '114', rank: 'ELITE' },
            { name: 'Henry Kaprawe Oko', lvl: '114', rank: 'ELITE' },
            { name: 'Marid', lvl: '120', rank: 'ELITE' },
            { name: 'Szkielet bosmana', lvl: '130', rank: 'ELITE' },
            { name: 'Monstrum z Bremus An', lvl: '85', rank: 'ELITE' }
        ],

        toggle(enabled) {
            GM_setValue('minutnikEnabled', enabled);
            this.compactMode = GM_getValue('minutnikCompact', false);
            if (enabled) {
                this.loadTimers();
                setInterval(() => this.recognizeNpc(), 500);
            }
        },

        init() {
            this.container = this.createContainer();
            document.body.appendChild(this.container);
        },

        createContainer() {
            const container = document.createElement('div');
            Object.assign(container.style, {
                position: 'fixed', top: '15px', left: '10px', padding: '3px',
                backgroundColor: '#0b2505', borderRadius: '8px', color: 'white',
                fontFamily: 'times-new-roman', fontSize: '14px', zIndex: '9999',
                minWidth: '200px', boxShadow: '0 2px 15px rgba(0,0,0,0.7)',
                border: '2px solid #1a4d0d', display: 'none'
            });

            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex', alignItems: 'center', marginBottom: '10px',
                paddingBottom: '8px', borderBottom: '1px solid #1a4d0d'
            });

            const icon = document.createElement('img');
            icon.src = 'https://i.imgur.com/Odc6ClZ.gif';
            Object.assign(icon.style, {
                width: '24px', height: '24px', marginRight: '8px', borderRadius: '4px'
            });

            const title = document.createElement('span');
            title.textContent = 'Minutnik';
            Object.assign(title.style, {
                fontSize: '18px', fontWeight: 'bold', userSelect: 'none', color: '#fff'
            });

            const compactBtn = document.createElement('button');
            compactBtn.innerHTML = '☰';
            Object.assign(compactBtn.style, {
                marginLeft: 'auto',
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '18px',
                cursor: 'pointer',
                padding: '4px'
            });

            compactBtn.title = 'smallMode';

            compactBtn.addEventListener('click', () => {
                this.compactMode = !this.compactMode;
                GM_setValue('minutnikCompact', this.compactMode);
                this.updateAllTimers();
            });

            header.appendChild(icon);
            header.appendChild(title);
            header.appendChild(compactBtn);
            container.appendChild(header);

            this.timersList = document.createElement('div');
            Object.assign(this.timersList.style, {
                display: 'flex', flexDirection: 'column', gap: '6px',
                scrollbarWidth: 'thin', scrollbarColor: '#1a4d0d #061d02',
                maxHeight: '760px', overflowY: 'auto', paddingRight: '4px'
            });
            container.appendChild(this.timersList);

            return container;
        },

        recognizeNpc() {
            const logsContainer = document.querySelector('.logs');
            if (!logsContainer) return;

            const firstLog = logsContainer.querySelector('.txt');
            if (!firstLog) return;

            const logText = firstLog.textContent || firstLog.innerText;
            const btnClass = document.querySelector('.close-button') ? '.close-button' : '.long-button.close';

            const observer = new MutationObserver(() => {
                const btn = document.querySelector(btnClass);
                if (!btn || btn.offsetParent === null) {
                    const normalizedLogText = logText.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                    for (const mob of this.monsters) {
                        const normalizedMobName = mob.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

                        if (normalizedLogText.includes(normalizedMobName)) {
                            if (document.querySelector('#game-map-window .dazed')) break;

                            const { minTime, maxTime } = this.calculateRespawnTime(mob.lvl, mob.rank, mob.name);
                            this.addTimer(minTime, maxTime, mob.name, mob.rank, mob.lvl);
                            break;
                        }
                    }
                    observer.disconnect();
                }
            });

            observer.observe(document.body, {
                childList: true, subtree: true, attributes: true,
                attributeFilter: ['style', 'class']
            });
        },

        calculateRespawnTime(level, rank, mobName) {
            const lvl = parseInt(level);
            let cappedLevel, baseTime, time, minTime, maxTime;

            switch (rank) {
                case 'ELITE':
                    cappedLevel = Math.min(200, lvl);
                    baseTime = 40 + 10.85 * cappedLevel - 0.02721 * Math.pow(cappedLevel, 2);
                    time = Math.round(baseTime * 1.1);
                    return { minTime: time, maxTime: time + 107 };

                case 'ELITE_II':
                    if (mobName === 'Zjawa Pustej Maski') {
                        return { minTime: 420, maxTime: 470 };
                    }
                    cappedLevel = Math.min(200, lvl);
                    baseTime = 40 + 10.85 * cappedLevel - 0.02721 * Math.pow(cappedLevel, 2);
                    time = baseTime * 1.25;
                    return { minTime: Math.round(time), maxTime: Math.round(time + 107) };

                case 'HERO':
                    if (mobName === 'Biała Dama') {
                        return { minTime: 2300, maxTime: 4100 };
                    }
                    minTime = Math.max(69 * 60, Math.round((60 + lvl * 0.45) * 60));
                    maxTime = Math.max(120 * 60, Math.round((110 + lvl * 0.5) * 60));
                    return { minTime, maxTime };

                case 'TITAN':
                    minTime = 2664 + (lvl - 70) * (4325 - 2664) / (177 - 70);
                    maxTime = 3223 + (lvl - 70) * (4689 - 3223) / (177 - 70);
                    return {
                        minTime: Math.round(minTime * 60),
                        maxTime: Math.round(maxTime * 60)
                    };

                default:
                    return { minTime: 600, maxTime: 600 };
            }
        },

        addTimer(minTime, maxTime, mobName, rank, mobLvl, totalTime) {
            const now = Date.now();
            const minEndTime = now + minTime * 1000;
            const maxEndTime = now + maxTime * 1000;

            this.timers.set(mobName, { minEndTime, maxEndTime, rank, mobLvl, totalTime: minTime });
            this.saveTimers();

            if (!this.globalInterval) {
                this.globalInterval = setInterval(() => this.updateAllTimers(), 1000);
            }

            this.updateAllTimers();
        },

        saveTimers() {
            const toSave = {};
            for (const [mobName, data] of this.timers.entries()) {
                toSave[mobName] = data;
            }
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(toSave));
        },

        loadTimers() {
            const stored = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
            const now = Date.now();

            for (const mobName in stored) {
                const { minEndTime, maxEndTime, rank, mobLvl, totalTime } = stored[mobName];
                if (maxEndTime > now) {
                    this.timers.set(mobName, { minEndTime, maxEndTime, rank, mobLvl, totalTime });
                }
            }

            if (this.timers.size > 0 && !this.globalInterval) {
                this.globalInterval = setInterval(() => this.updateAllTimers(), 1000);
                this.updateAllTimers();
            }
        },

        updateAllTimers() {
            const now = Date.now();
            this.timersList.innerHTML = '';

            const sortedTimers = [...this.timers.entries()]
            .map(([mobName, data]) => ({
                mobName,
                data,
                maxDiff: Math.floor((data.maxEndTime - now) / 1000)
            }))
            .filter(t => t.maxDiff > 0)
            .sort((a, b) => a.maxDiff - b.maxDiff);

            for (const { mobName, data, maxDiff } of sortedTimers) {
                const { minEndTime, maxEndTime, rank, mobLvl, totalTime } = data;
                const minDiff = Math.floor((minEndTime - now) / 1000);

                if (maxDiff <= 0) {
                    const audioUrl = GM_getValue('audioUrlMinutnik', 'https://files.catbox.moe/od2lcz.mp3');
                    playAudio(audioUrl);
                    this.timers.delete(mobName);
                    continue;
                } else if (minDiff === 0) {
                    const audioUrl = GM_getValue('audioUrlMinutnik', 'https://files.catbox.moe/od2lcz.mp3');
                    playAudio(audioUrl);
                }

                const timerElement = this.createTimerElement(mobName, rank, mobLvl, minDiff, maxDiff, totalTime);
                this.timersList.appendChild(timerElement);
            }

            if (this.timers.size === 0) {
                clearInterval(this.globalInterval);
                this.globalInterval = null;
                this.container.style.display = 'none';
                this.timersList.innerHTML = '';
            } else {
                this.container.style.display = 'block';
            }

            this.saveTimers();

            if (!GM_getValue('minutnikEnabled', false)) {
                clearInterval(this.globalInterval);
                this.globalInterval = null;
                this.container.style.display = 'none';
                this.timersList.innerHTML = '';
            }
        },

        createCompactTimerElement(mobName, rank, mobLvl, minDiff, maxDiff, totalTime) {
            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 6px',
                fontSize: '13px',
                borderBottom: '1px solid rgba(255,255,255,0.12)',
                whiteSpace: 'nowrap'
            });

            const name = document.createElement('span');
            name.textContent = mobName;
            name.style.fontWeight = 'bold';
            name.style.color = '#e0e0e0';

            const lvl = document.createElement('span');
            lvl.textContent = `[${mobLvl}]`;
            lvl.style.color = '#a0a0a0';

            const rankColors = {
                HERO: '#ffc600',
                TITAN: '#ff6c00',
                ELITE_II: '#54ff00',
                ELITE: '#00aeff'
            };

            const rankNames = {
                HERO: 'H',
                TITAN: 'T',
                ELITE_II: 'E2',
                ELITE: 'E'
            };

            const rankBadge = document.createElement('span');
            rankBadge.textContent = rankNames[rank] || '';
            rankBadge.style.color = rankColors[rank] || '#fff';
            rankBadge.style.fontWeight = 'bold';

            const time = document.createElement('span');
            Object.assign(time.style, {
                marginLeft: 'auto',
                fontFamily: 'monospace',
                fontWeight: 'bold'
            });

            if (minDiff > 0) {
                time.textContent = formatTime(minDiff);
                time.style.color = '#a0a0a0';

                const percentRemaining = minDiff / totalTime;
                if (percentRemaining <= 0.1) {
                    time.textContent = formatTime(minDiff);
                    time.style.color = '#ffffff';
                }
            } else {
                const percentRemaining = maxDiff / totalTime;
                if (percentRemaining <= 0.2) {
                    time.textContent = formatTime(maxDiff);
                    time.style.color = '#c12a11';
                } else if (percentRemaining <= 0.5) {
                    time.textContent = formatTime(maxDiff);
                    time.style.color = '#d76f13';
                } else {
                    time.textContent = formatTime(maxDiff);
                    time.style.color = '#ebc21e';
                }
            }

            const remove = document.createElement('button');
            remove.textContent = '×';
            Object.assign(remove.style, {
                marginLeft: '6px',
                background: 'transparent',
                border: 'none',
                color: '#ff6666',
                fontSize: '16px',
                cursor: 'pointer',
                padding: '0 4px'
            });

            remove.addEventListener('click', () => {
                Minutnik.timers.delete(mobName);
                Minutnik.saveTimers();
                Minutnik.updateAllTimers();
            });

            row.append(name, lvl, rankBadge, time, remove);
            return row;
        },

        createTimerElement(mobName, rank, mobLvl, minDiff, maxDiff, totalTime) {
            if (this.compactMode) {
                return this.createCompactTimerElement(
                    mobName, rank, mobLvl, minDiff, maxDiff, totalTime
                );
            }

            const timerElement = document.createElement('div');
            Object.assign(timerElement.style, {
                display: 'flex', flexDirection: 'column', padding: '8px',
                backgroundColor: '#061d02', borderRadius: '6px',
                border: '1px solid #1a4d0d', transition: 'all 0.3s ease'
            });

            const topRow = document.createElement('div');
            Object.assign(topRow.style, {
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '4px'
            });

            const labelInfo = document.createElement('div');
            Object.assign(labelInfo.style, { flex: '1', display: 'flex', flexDirection: 'column' });

            const nameRow = document.createElement('div');
            Object.assign(nameRow.style, {
                display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap'
            });

            const nameSpan = document.createElement('span');
            Object.assign(nameSpan.style, { color: '#e0e0e0', fontWeight: 'bold' });
            nameSpan.textContent = mobName;

            const lvlSpan = document.createElement('span');
            Object.assign(lvlSpan.style, { color: '#a0a0a0', fontSize: '12px' });
            lvlSpan.textContent = `[${mobLvl}]`;

            nameRow.appendChild(nameSpan);
            nameRow.appendChild(lvlSpan);

            const rankColors = { HERO: '#ffc600', TITAN: '#ff6c00', ELITE_II: '#54ff00', ELITE: '#00aeff' };
            const rankNames = { HERO: 'Heros', TITAN: 'Tytan', ELITE_II: 'Elita II', ELITE: 'Elita' };
            const rankName = rankNames[rank];

            if (rankName) {
                const rankBadge = document.createElement('span');
                Object.assign(rankBadge.style, {
                    color: rankColors[rank], fontSize: '14px',
                    padding: '6px 8px', borderRadius: '3px', fontWeight: 'bold'
                });
                rankBadge.textContent = rankName;
                nameRow.appendChild(rankBadge);
            }

            labelInfo.appendChild(nameRow);

            const removeBtn = document.createElement('button');
            removeBtn.textContent = '🗑️';
            Object.assign(removeBtn.style, {
                background: 'rgba(255,0,0,0.2)',
                border: '1px solid #ff0000',
                color: '#ff6666',
                cursor: 'pointer',
                padding: '3px 5px',
                borderRadius: '4px',
                fontSize: '10px',
                transition: 'all 0.2s ease',
                lineHeight: '1',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            });

            removeBtn.addEventListener('mouseenter', () => {
                removeBtn.style.background = 'rgba(255,0,0,0.4)';
                removeBtn.style.transform = 'scale(1.1)';
            });
            removeBtn.addEventListener('mouseleave', () => {
                removeBtn.style.background = 'rgba(255,0,0,0.2)';
                removeBtn.style.transform = 'scale(1)';
            });
            removeBtn.addEventListener('click', () => {
                this.timers.delete(mobName);
                this.saveTimers();
                this.updateAllTimers();
            });

            topRow.appendChild(labelInfo);
            topRow.appendChild(removeBtn);

            const timeRow = document.createElement('div');
            Object.assign(timeRow.style, {
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginTop: '4px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)'
            });

            const timeLabel = document.createElement('span');
            const timeValue = document.createElement('span');
            Object.assign(timeValue.style, {
                fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace'
            });

            if (minDiff > 0) {
                timeLabel.textContent = 'Do minimalnego respu:';
                Object.assign(timeLabel.style, { fontSize: '12px', color: '#a0a0a0' });
                timeValue.textContent = formatTime(minDiff);
                timeValue.style.color = '#a0a0a0';

                const percentRemaining = minDiff / totalTime;
                if (percentRemaining <= 0.1) {
                    timeValue.style.color = '#ffffff';
                    timeLabel.textContent = 'Do minimalnego respu';
                    timeLabel.style.color = '#ffffff';
                    timerElement.style.borderColor = '#ffffff';
                }
            } else {
                const percentRemaining = maxDiff / totalTime;
                timeLabel.textContent = 'Do maksymalnego respu: ';
                timeValue.textContent = formatTime(maxDiff);

                if (percentRemaining <= 0.2) {
                    Object.assign(timeLabel.style, { fontSize: '12px', color: '#c12a11' });
                    timeValue.style.color = '#c12a11';
                    timerElement.style.borderColor = '#c12a11';
                } else if (percentRemaining <= 0.5) {
                    Object.assign(timeLabel.style, { fontSize: '12px', color: '#d76f13' });
                    timeValue.style.color = '#d76f13';
                    timerElement.style.borderColor = '#d76f13';
                } else {
                    Object.assign(timeLabel.style, { fontSize: '12px', color: '#ebc21e' });
                    timeValue.style.color = '#ebc21e';
                    timerElement.style.borderColor = '#ebc21e';
                }
            }

            timeRow.appendChild(timeLabel);
            timeRow.appendChild(timeValue);
            timerElement.appendChild(topRow);
            timerElement.appendChild(timeRow);

            return timerElement;
        }

    };

    function formatTime(seconds) {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const sec = seconds % 60;

        const pad = (n) => String(n).padStart(2, '0');

        if (days > 0) return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(sec)}`;
        if (hours > 0) return `${pad(hours)}:${pad(minutes)}:${pad(sec)}`;
        return `${pad(minutes)}:${pad(sec)}`;
    }

    function playAudio(url, volume = 1.0) {
        const audio = new Audio(url);
        audio.preload = "auto";
        audio.volume = volume;
        audio.play()
            .then(() => setTimeout(() => { audio.pause(); audio.currentTime = 0; }, 5000))
            .catch(err => console.warn("Nie można odtworzyć dźwięku:", err));
    }

    // ======================== HERO DETECTOR ========================

    const HeroDetector = {
        alertDisplayed: false,
        detectedHeroes: new Set(),
        detectedTitans: new Set(),
        checkInterval: null,

        HEROES_QUERY: `
        query HeroesOnMap {
            location {
                id
                name
            }
            npcs {
                id
                name
                lvl
                x
                y
                rank
                src
            }
        }
    `,

        toggle(enabled) {
            GM_setValue('heroDetectorEnabled', enabled);
            if (enabled) {
                this.startChecking();
            } else {
                this.stopChecking();
            }
        },

        startChecking() {
            setTimeout(() => this.checkForHeroes(), 1000);
            this.checkInterval = setInterval(() => this.checkForHeroes(), 5000);
        },

        stopChecking() {
            if (this.checkInterval) {
                clearInterval(this.checkInterval);
                this.checkInterval = null;
            }
        },

        async checkForHeroes() {
            const token = GraphQLManager.getToken();
            if (!token) {
                console.log('[HeroDetector] Czekam na token');
                return;
            }

            try {
                const data = await GraphQLManager.query(this.HEROES_QUERY);
                const location = data.location;
                const npcs = data.npcs || [];

                let foundEntities = [];

                npcs.forEach(npc => {
                    const rank = npc.rank?.toUpperCase();

                    if (rank === 'HERO' && !this.detectedHeroes.has(npc.name)) {
                        this.detectedHeroes.add(npc.name);
                        foundEntities.push({
                            name: npc.name,
                            level: npc.lvl || '??',
                            type: 'hero',
                            x: npc.x,
                            y: npc.y,
                            src: npc.src,
                            locationId: location.id,
                            locationName: location.name
                        });
                    }

                    if (rank === 'TITAN' && !this.detectedTitans.has(npc.name)) {
                        this.detectedTitans.add(npc.name);
                        foundEntities.push({
                            name: npc.name,
                            level: npc.lvl || '??',
                            type: 'titan',
                            x: npc.x,
                            y: npc.y,
                            src: npc.src,
                            locationId: location.id,
                            locationName: location.name
                        });
                    }
                });

                if (foundEntities.length > 0 && !this.alertDisplayed) {
                    this.showAlert(foundEntities);
                }

            } catch (e) {
                console.error('[HeroDetector] Błąd:', e);
            }
        },

        showAlert(entities) {
            if (this.alertDisplayed || entities.length === 0) return;
            this.alertDisplayed = true;

            const alertDiv = document.createElement('div');
            Object.assign(alertDiv.style, {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                background: '#0b2505',
                color: 'white',
                padding: '20px',
                borderRadius: '12px',
                textAlign: 'center',
                zIndex: '10001',
                border: '2px solid #1a4d0d',
                boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
                maxWidth: '80vw',
                fontFamily: 'times-new-roman'
            });

            const audioUrl = GM_getValue('audioUrl', 'https://files.catbox.moe/j6siq2.mp3');
            Utils.playAudio(audioUrl);
            const hasHeroes = entities.some(e => e.type === 'hero');
            const hasTitans = entities.some(e => e.type === 'titan');
            let title = '';
            if (hasHeroes && hasTitans) title = 'Znaleziono Herosów i Tytanów!';
            else if (hasHeroes) title = `Znaleziono ${entities.length > 1 ? 'Herosów' : 'Herosa'}!`;
            else title = `Znaleziono ${entities.length > 1 ? 'Tytanów' : 'Tytana'}!`;
            const header = document.createElement('div');
            Object.assign(header.style, {
                fontSize: '18px',
                fontWeight: 'bold',
                marginBottom: '15px',
                paddingBottom: '10px',
                borderBottom: '1px solid #1a4d0d'
            });
            header.textContent = title;
            alertDiv.appendChild(header);

            const entitiesContainer = document.createElement('div');
            Object.assign(entitiesContainer.style, {
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'center',
                gap: '15px',
                marginBottom: '15px'
            });

            entities.forEach(entity => {
                const card = this.createEntityCard(entity);
                entitiesContainer.appendChild(card);
            });

            alertDiv.appendChild(entitiesContainer);

            const buttonsContainer = document.createElement('div');
            Object.assign(buttonsContainer.style, {
                display: 'flex',
                gap: '10px',
                justifyContent: 'center',
                marginTop: '15px'
            });

            const copyBtn = this.createCopyButton(entities, alertDiv);
            buttonsContainer.appendChild(copyBtn);
            alertDiv.appendChild(buttonsContainer);
            document.body.appendChild(alertDiv);
            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                    this.alertDisplayed = false;
                }
            }, 15000);
        },

        createEntityCard(entity) {
            const card = document.createElement('div');
            Object.assign(card.style, {
                width: '140px',
                padding: '12px',
                background: '#061d02',
                borderRadius: '8px',
                border: '1px solid #1a4d0d',
                textAlign: 'center',
                transition: 'all 0.2s ease'
            });

            card.addEventListener('mouseenter', () => {
                card.style.border = '1px solid #3ebc35';
                card.style.transform = 'translateY(-6px)';
            });

            card.addEventListener('mouseleave', () => {
                card.style.border = '1px solid #1a4d0d';
                card.style.transform = 'translateY(0)';
            });

            const typeColor = entity.type === 'titan' ? '#ff6c00' : '#ffc600';
            const typeName = entity.type === 'titan' ? 'Tytan' : 'Heros';

            const imgWrapper = document.createElement('div');
            Object.assign(imgWrapper.style, {
                width: '100%',
                height: '80px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#10240a',
                borderRadius: '6px',
                marginBottom: '8px'
            });

            const img = document.createElement('img');
            img.src = entity.src || 'https://imgur.com/cUQtW6E.png';
            Object.assign(img.style, {
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
            });
            imgWrapper.appendChild(img);

            const name = document.createElement('div');
            name.textContent = entity.name;
            Object.assign(name.style, {
                fontSize: '16px',
                fontWeight: 'bold',
                color: '#e0e0e0',
                marginBottom: '4px'
            });

            const level = document.createElement('div');
            level.innerHTML = `<span style="color: ${typeColor};">${typeName}</span> ${entity.level} lvl`;
            Object.assign(level.style, {
                fontSize: '13px',
                marginBottom: '6px'
            });

            const location = document.createElement('div');
            location.textContent = entity.locationName;
            Object.assign(location.style, {
                fontSize: '12px',
                color: '#a0a0a0',
                marginBottom: '2px'
            });

            const coords = document.createElement('div');
            coords.textContent = `(${entity.x}, ${entity.y})`;
            Object.assign(coords.style, {
                fontSize: '12px',
                color: '#a0a0a0'
            });

            card.appendChild(imgWrapper);
            card.appendChild(name);
            card.appendChild(level);
            card.appendChild(location);
            card.appendChild(coords);

            return card;
        },

        createCopyButton(entities, alertDiv) {
            const btn = document.createElement('button');
            btn.textContent = 'Kopiuj i zamknij';
            Object.assign(btn.style, {
                padding: '10px 20px',
                background: '#1a4d0d',
                border: '1px solid #2d7a1a',
                borderRadius: '8px',
                color: 'white',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: 'times-new-roman'
            });

            btn.addEventListener('mouseenter', () => {
                btn.style.background = '#2d7a1a';
                btn.style.transform = 'translateY(-2px)';
            });

            btn.addEventListener('mouseleave', () => {
                btn.style.background = '#1a4d0d';
                btn.style.transform = 'translateY(0)';
            });

            btn.addEventListener('click', () => {
                const messages = entities.map(entity => {
                    const typeName = entity.type === 'titan' ? 'Tytana' : 'Herosa';
                    return `@Powiadomienie Znaleziono ${typeName}! ${entity.name} ${entity.level} lvl. [ID: ${entity.locationId}] ${entity.locationName} Koordynaty: (${entity.x}, ${entity.y}) Życzę Legendy! DrMan`;
                });

                const fullMessage = messages.join('\n');
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(fullMessage)
                        .then(() => {
                        btn.textContent = 'Skopiowano!';
                        setTimeout(() => {
                            alertDiv.remove();
                            this.alertDisplayed = false;
                        }, 500);
                    })
                        .catch(err => {
                        console.error('[HeroDetector] Błąd kopiowania:', err);
                        this.fallbackCopy(fullMessage);
                        btn.textContent = 'Skopiowano!';
                        setTimeout(() => {
                            alertDiv.remove();
                            this.alertDisplayed = false;
                        }, 500);
                    });
                } else {
                    this.fallbackCopy(fullMessage);
                    btn.textContent = 'Skopiowano!';
                    setTimeout(() => {
                        alertDiv.remove();
                        this.alertDisplayed = false;
                    }, 500);
                }
            });

            return btn;
        },

        fallbackCopy(text) {
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                console.error('[HeroDetector] Fallback copy failed:', err);
            }
            document.body.removeChild(textArea);
        },
    };

    // ======================== HIGHLIGHTS ========================
    const Highlights = {
        toggle(enabled) {
            GM_setValue('highlightItemsEnabled', enabled);
            if (enabled) {
                this.addStyles();
            } else {
                this.removeStyles();
            }
        },

        addStyles() {
            this.removeStyles();
            const style = document.createElement("style");
            style.id = "highlight-items-styles";

            const colors = {
                unique: GM_getValue('highlightColorUnique', '#f5b536'),
                heroic: GM_getValue('highlightColorHeroic', '#3193f5'),
                upgraded: GM_getValue('highlightColorUpgraded', '#ebe7ba'),
                legendary: GM_getValue('highlightColorLegendary', '#d1249e'),
                artefact: GM_getValue('highlightColorArtefact', '#f5291b')
            };

            style.innerHTML = `
                [data-item].item.heroic, [data-item].loot.heroic, .loot[data-item*='"rarity":"heroic"'] {
                    box-shadow: inset 0 0 0 1px ${colors.heroic}, 0 0 1px 0px ${colors.heroic} !important;
                }
                [data-item].item.unique, [data-item].loot.unique, .item.unique, .loot[data-item*='"rarity":"unique"'] {
                    box-shadow: inset 0 0 0 1px ${colors.unique}, 0 0 1px 0px ${colors.unique} !important;
                }
                [data-item].item.legendary, [data-item].loot.legendary, .loot[data-item*='"rarity":"legendary"'], .loot[data-item*='"legendaryBow":1'] {
                    box-shadow: inset 0 0 0 1px ${colors.legendary}, 0 0 4px 0px ${colors.legendary} !important;
                    animation: artefact-pulse 12s infinite;
                }
                [data-item].item.upgraded, [data-item].loot.upgraded, .loot[data-item*='"upgraded":1'] {
                    box-shadow: inset 0 0 0 1px ${colors.upgraded}, 0 0 1px 0px ${colors.upgraded} !important;
                }
                [data-item].item.artefact, [data-item].loot.artefact, .loot[data-item*='"rarity":"artefact"'] {
                    box-shadow: inset 0 0 0 1px ${colors.artefact}, 0 0 6px 0px ${colors.artefact} !important;
                    animation: artefact-pulse 12s infinite;
                }
                @keyframes artefact-pulse {
                    0%, 100% { box-shadow: inset 0 0 0 6px ${colors.artefact}, 0 0 12px 2px ${colors.artefact}; }
                    50% { box-shadow: inset 0 0 0 4px ${colors.artefact}, 0 0 20px 4px ${colors.artefact}; }
                }`;
            document.head.appendChild(style);
        },

        removeStyles() {
            document.getElementById('highlight-items-styles')?.remove();
        }
    };

    // ======================== LEGEND NOTIFICATION ========================
    const LegendNotification = {
        toggle(enabled) {
            GM_setValue('legendNotificationEnabled', enabled);
            if (enabled) {
                this.addStyles();
                intervalManager.set('legendNotif', () => this.check(), 500);
                this.loadConfetti();
            } else {
                intervalManager.clear('legendNotif');
            }
        },

        loadConfetti() {
            if (typeof confetti !== 'undefined') return;
            const script = document.createElement('script');
            script.src = "https://cdn.jsdelivr.net/npm/canvas-confetti@1.3.2/dist/confetti.browser.min.js";
            document.head.appendChild(script);
        },

        addStyles() {
            const glowColor = GM_getValue('legendGlowColor', '#a8157d');
            const style = document.createElement("style");
            style.innerHTML = `
                @keyframes glow-legendary-loot {
                    0% { box-shadow: 0 0 80px ${glowColor}, 0 0 120px ${glowColor}, 0 0 160px ${glowColor}; }
                    50% { box-shadow: 0 0 120px ${glowColor}, 0 0 180px ${glowColor}, 0 0 240px ${glowColor}; }
                    100% { box-shadow: 0 0 160px ${glowColor}, 0 0 220px ${glowColor}, 0 0 300px ${glowColor}; }
                }
                @keyframes fadeOutLegend {
                    0% { box-shadow: 0 0 80px ${glowColor}, 0 0 120px ${glowColor}; }
                    100% { box-shadow: 0 0 10px transparent, 0 0 20px transparent; }
                }
                .centered-div.glow-legendary-loot,
                .chat-left-bg.chatleft-absolute.glow-legendary-loot,
                #loots.glow-legendary-loot {
                    animation: glow-legendary-loot 6s ease-in-out, fadeOutLegend 12s ease-out forwards;
                }`;
            document.head.appendChild(style);
        },

        check() {
            document.querySelectorAll('[data-item]').forEach(item => {
                const data = Utils.parseItemData(item);
                if (!data || !data.schema?.inner || item.closest('#mapfield')) return;

                const itemId = data.schema.inner.id || JSON.stringify(data.schema.inner);
                const rarity = data.schema.inner.rarity?.toLowerCase();

                if (rarity === "heroic" && item.closest('div.loot')) {
                    if (item.classList.contains('notify-active')) {
                        return;
                    }

                    item.classList.add('notify-active');
                    setTimeout(() => item.classList.remove('notify-active'), 40000);
                    const color = GM_getValue('highlightColorHeroic', '#00a2ff');
                    MessageCanvas.show("", "Zdobyłeś Przedmiot Heroiczny", color);
                    this.triggerConfetti();
                }

                if (rarity === "legendary" && item.closest('div.loot')) {
                    if (item.classList.contains('notify-active')) {
                        return;
                    }

                    item.classList.add('notify-active');
                    const audioUrl = GM_getValue('audioUrl', 'https://files.catbox.moe/j6siq2.mp3');
                    const color = GM_getValue('legendGlowColor', '#a8157d');
                    MessageCanvas.show("", "Zdobyłeś Przedmiot Legendarny!!", color);
                    this.triggerConfetti();
                    Utils.playAudio(audioUrl);

                    ['.chat-left-bg.chatleft-absolute', '.centered-div', '#loots'].forEach(selector => {
                        const el = document.querySelector(selector);
                        if (el) {
                            el.classList.add('glow-legendary-loot');
                            setTimeout(() => item.classList.remove('notify-active'), 40000);
                            setTimeout(() => el.classList.remove('glow-legendary-loot'), 40000);
                        }
                    });
                }
            });
        },

        triggerConfetti() {
            if (typeof confetti === 'undefined') return;

            const duration = 3000;
            const animationEnd = Date.now() + duration;
            const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
            const randomInRange = (min, max) => Math.random() * (max - min) + min;

            const interval = setInterval(() => {
                const timeLeft = animationEnd - Date.now();
                if (timeLeft <= 0) return clearInterval(interval);

                const particleCount = 50 * (timeLeft / duration);
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
                confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
            }, 250);
        }
    };

    // ======================== AUTO SELLER ========================
    const AutoSeller = {
        toggle(enabled) {
            GM_setValue('autoSellerEnabled', enabled);
        },

        init() {
            document.addEventListener('keydown', (e) => {
                if (!GM_getValue('autoSellerEnabled', true)) return;
                if (e.key === 'o') this.moveItems();
            });
        },

        moveItems() {
            const sellRarityItems = GM_getValue('sellRarityItems', false);
            const sellConsumables = GM_getValue('sellConsumablesItems', false);
            const items = document.querySelectorAll('#bag .items .item');

            for (let item of items) {
                const data = Utils.parseItemData(item);
                if (!data) continue;

                const itemName = data.schema?.inner?.name || 'nieznany przedmiot';
                const isConsumable = data.schema?.inner?.category === 'consumable';
                const isCommon = data.schema?.inner?.rarity === 'common';
                const isKey = data.schema?.inner?.category === 'keys';
                const isQuest = data.schema?.inner?.category === 'quests';

                if (!isCommon && !sellRarityItems) continue;
                if (isConsumable && !sellConsumables) continue;
                if (isKey || isQuest) continue;

                const shopGrid = document.querySelector('.shop__store');
                if (shopGrid) {
                    Utils.moveItemToRandomPosition(item, shopGrid);
                    MessageCanvas.show(itemName, "Sprzedałeś: ", '#ffd700');
                    break;
                }
            }
        }
    };

    // ======================== ADDONS CONFIGURATION ========================
    const ADDONS = [
        { id: 'hpExpEnabled', default: false, icon: 'https://i.imgur.com/eNSbVfl.png',
         title: 'Procentownik', desc: 'Pokazuje procent życia i doświadczenia na paskach postaci.',
         onToggle: (e) => HPExpDisplay.toggle(e) },
        { id: 'autoHealEnabled', default: false, icon: 'https://i.imgur.com/jNmyFXZ.png',
         title: 'AutoHeal', desc: 'Automatycznie używa przedmiotu konsumpcyjnego po naciśnięciu "Q".',
         onToggle: (e) => AutoHeal.toggle(e),
         settings: [
             { key: 'hotKey', label: 'Przycisk odpowiedzialny za leczenie', type: 'text', default: 'Q' },
             { key: 'autoUse', label: 'Czy ma automatycznie leczyc?', type: 'checkbox', default: false },
             { key: 'lifePercentageToHeal', label: 'Od ilu % hp ma zaczać nas automatycznie leczyć?', type: 'number', default: '60' }
         ]},
        { id: 'autoBattleEnabled', default: false, icon: 'https://i.imgur.com/Aiv7rsW.png',
         title: 'AutoCloseFight', desc: 'Automatycznie zamyka walkę i klika szybką walkę.',
         onToggle: (e) => AutoBattle.toggle(e) },
        { id: 'autoGoldEnabled', default: false, icon: 'https://i.imgur.com/wfPsCpr.png',
         title: 'AutoGoldEater', desc: 'Automatycznie zjada złoto z torby.',
         onToggle: (e) => GoldEater.toggle(e) },
        { id: 'hotKeysEnabled', default: false, icon: 'https://i.imgur.com/9DXxMov.png',
         title: 'HotKeys', desc: 'Skroty do ustawień po prawej stronie',
         onToggle: (e) => HotKeys.toggle(e) },
        { id: 'heroDetectorEnabled', default: false, icon: 'https://i.imgur.com/31gX4Pq.png',
         title: 'HerosDetector', desc: 'Wykrywa herosów na mapie i wyświetla powiadomienie.',
         onToggle: (e) => HeroDetector.toggle(e),
         settings: [
             { key: 'audioUrl', label: 'Dźwięk powiadomienia o znalezieniu Herosa/Tytana', type: 'text', default: 'https://files.catbox.moe/j6siq2.mp3' }
         ]},
        {
            id: 'characterSwitcherEnabled',
            default: false,
            icon: 'https://imgur.com/chSiA4P.png',
            title: 'Przełącznik Postaci',
            desc: 'Szybkie przełączanie między postaciami bez przechodzenia do strony głównej.',
            onToggle: (e) => CharacterSwitcher.toggle(e)
        },
        { id: 'highlightItemsEnabled', default: false, icon: 'https://i.imgur.com/9O6R0uS.png',
         title: 'Highlights', desc: 'Dodaje obramowania do przedmiotów w zależności od ich rzadkości.',
         onToggle: (e) => Highlights.toggle(e),
         settings: [
             { key: 'highlightColorUnique', label: 'Kolor obramowania Unikatowy', type: 'color', default: '#f5b536' },
             { key: 'highlightColorHeroic', label: 'Kolor obramowania Heroiczny', type: 'color', default: '#3193f5' },
             { key: 'highlightColorUpgraded', label: 'Kolor obramowania Ulepszony', type: 'color', default: '#ebe7ba' },
             { key: 'highlightColorLegendary', label: 'Kolor obramowania Legendarny', type: 'color', default: '#d1249e' },
             { key: 'highlightColorArtefact', label: 'Kolor obramowania Artefakt', type: 'color', default: '#f5291b' }
         ]},
        { id: 'autoAgressiveEnabled', default: false, icon: 'https://i.imgur.com/SaxsS7m.png',
         title: 'AutoFight', desc: 'Automatycznie atakuje każdego potwora',
         onToggle: (e) => AutoFight.toggle(e) },
        { id: 'autoGrpEnabled', default: false, icon: 'https://i.imgur.com/uNSx11F.png',
         title: 'AutoGrp', desc: 'Automatycznie akceptuje zaproszenie do grupy.',
         onToggle: (e) => AutoGrp.toggle(e) },
        { id: 'legendNotificationEnabled', default: false, icon: 'https://i.imgur.com/O1JbNtq.png',
         title: 'LegendNotificator', desc: 'Efekt wizualny przy zdobyciu przedmiotu legendarnego.',
         onToggle: (e) => LegendNotification.toggle(e),
         settings: [
             { key: 'legendGlowColor', label: 'Kolor animacji okna łupów', type: 'color', default: '#a8157d' },
             { key: 'audioUrl', label: 'Dźwięk powiadomienia o legendzie', type: 'text', default: 'https://files.catbox.moe/j6siq2.mp3' }
         ]},
        { id: 'autoSellerEnabled', default: false, icon: 'https://i.imgur.com/cJrAlUI.png',
         title: 'AutoSeller', desc: 'Sprzedaje automatycznie przedmioty po naciśnięciu "O"',
         onToggle: (e) => AutoSeller.toggle(e),
         settings: [
             { key: 'sellRarityItems', label: 'Sprzedawaj rzadkie przedmioty', type: 'checkbox', default: false },
             { key: 'sellConsumablesItems', label: 'Sprzedawaj konsumpcyjne przedmioty', type: 'checkbox', default: false }
         ]},
        {
            id: 'itemsOnMapEnabled',
            default: false,
            icon: 'https://imgur.com/MYocJMU.png',
            title: 'Przedmioty na mapie',
            desc: 'Wyświetla listę przedmiotów znajdujących się na mapie.',
            onToggle: (e) => ItemsOnMap.toggle(e)
        },
        {
            id: 'playersOnMapEnabled',
            default: false,
            icon: 'https://imgur.com/T8Lg000.png',
            title: 'Gracze na mapie',
            desc: 'Wyświetla listę graczy znajdujących się na mapie.',
            onToggle: (e) => PlayersOnMap.toggle(e)
        },
        { id: 'minutnikEnabled', default: false, icon: 'https://i.imgur.com/Odc6ClZ.gif',
         title: 'Minutnik', desc: 'Odlicza czas do pojawienia się ElityII lub Elity',
         onToggle: (e) => Minutnik.toggle(e),
         settings: [
             { key: 'audioUrlMinutnik', label: 'Link do dźwięku', type: 'text', default: 'https://files.catbox.moe/od2lcz.mp3' }
         ]},
        {
            id: 'killCounterEnabled',
            default: false,
            icon: 'https://imgur.com/UvmjZe5.png',
            title: 'Licznik Ubić',
            desc: 'Zlicza zabite potwory i zdobyte z nich przedmioty.',
            onToggle: (e) => KillCounter.toggle(e),
            settings: [
                {
                    key: 'openKillCounterPanel',
                    label: 'Otwórz panel licznika',
                    type: 'button',
                    buttonText: 'Pokaż Licznik',
                    action: () => KillCounter.openPanel()
                }
            ]
        },
        { id: 'autoLootEnabled', default: false, icon: 'https://i.imgur.com/pVGWAkT.gif',
         title: 'LootFilter', desc: 'Automatycznie akceptuje lub odrzuca przedmioty w oknie łupów.',
         onToggle: (e) => LootFilter.toggle(e),
         settings: [
             { key: 'autoLootAccept', label: 'Automatyczne potwierdzenie lootu', type: 'checkbox', default: false },
             { key: 'autoLootMinPrice', label: 'Minimalna wartość przedmiotu', type: 'number', default: 100 },
             { key: 'autoLootRejectCommon', label: 'Zawsze odrzucaj zwykłe przedmioty', type: 'checkbox', default: false },
             { key: 'autoConsumablesAccept', label: 'Zawsze akceptuj konsumpcyjne', type: 'checkbox', default: false }
         ]}
    ];

    // ======================== PANEL UI ========================
    const PanelUI = {
        STORAGE_KEY: 'panelPos',

        createPanel() {
            if (document.getElementById('addon-panel')) return;

            const panel = document.createElement('div');
            panel.id = 'addon-panel';

            Object.assign(panel.style, {
                position: 'fixed',
                width: '420px',
                color: '#fff',
                zIndex: '10000',
                border: '2px solid #1a4d0d',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                background: '#0b2505',
                fontFamily: 'times-new-roman'
            });

            const savedPos = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || 'null');
            if (savedPos) {
                panel.style.top = savedPos.top + 'px';
                panel.style.left = savedPos.left + 'px';
            } else {
                // Centruj tylko przy pierwszym otwarciu
                panel.style.top = '50%';
                panel.style.left = '50%';
                panel.style.transform = 'translate(-50%, -50%)';
            }

            const header = this.createHeader(panel);
            const content = this.createContent();

            panel.appendChild(header);
            panel.appendChild(content);
            document.body.appendChild(panel);

            this.makeDraggable(panel);
        },

        createHeader(panel) {
            const header = document.createElement('div');
            Object.assign(header.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '15px 20px',
                fontSize: '16px',
                fontWeight: 'bold',
                userSelect: 'none',
                borderBottom: '1px solid #1a4d0d',
                background: '#0b2505',
                cursor: 'grab'
            });

            const leftSide = document.createElement('div');
            Object.assign(leftSide.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
            });

            const icon = document.createElement('img');
            icon.src = CONFIG.ICONS.DEFAULT;
            Object.assign(icon.style, {
                width: '24px',
                height: '24px',
                borderRadius: '4px'
            });

            const title = document.createElement('span');
            title.textContent = 'Panel Dodatków';
            Object.assign(title.style, {
                fontSize: '18px',
                fontWeight: 'bold',
                color: '#fff'
            });

            leftSide.appendChild(icon);
            leftSide.appendChild(title);

            const closeBtn = document.createElement('button');
            closeBtn.textContent = '✖';
            Object.assign(closeBtn.style, {
                background: 'transparent',
                border: 'none',
                color: '#CC5252',
                fontSize: '20px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                transition: 'all 0.2s ease'
            });

            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.color = '#ff6666';
                closeBtn.style.background = 'rgba(255,255,255,0.1)';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.color = '#CC5252';
                closeBtn.style.background = 'transparent';
            });
            closeBtn.addEventListener('click', () => {
                panel.remove();
                document.getElementById('settings-popup')?.remove();
            });

            header.appendChild(leftSide);
            header.appendChild(closeBtn);

            return header;
        },

        createContent() {
            const content = document.createElement('div');
            Object.assign(content.style, {
                padding: '15px',
                fontSize: '13px',
                maxHeight: '500px',
                overflowY: 'auto',
                overflowX: 'hidden',
                scrollbarWidth: 'thin',
                scrollbarColor: '#1a4d0d #061d02'
            });

            ADDONS.forEach((addon, index) => {
                const block = this.createAddonBlock(addon);
                content.appendChild(block);
                content.appendChild(this.createToggleSwitch(addon));

                if (index < ADDONS.length - 1) {
                    content.appendChild(this.createSeparator());
                }
            });

            return content;
        },

        createAddonBlock(addon) {
            const block = document.createElement('div');
            Object.assign(block.style, {
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '10px',
                padding: '10px',
                background: '#061d02',
                borderRadius: '8px',
                border: '1px solid #1a4d0d',
                transition: 'all 0.2s ease'
            });

            block.addEventListener('mouseenter', () => {
                block.style.background = '#0a2505';
                block.style.transform = 'translateX(2px)';
            });
            block.addEventListener('mouseleave', () => {
                block.style.background = '#061d02';
                block.style.transform = 'translateX(0)';
            });

            const iconWrapper = document.createElement('div');
            Object.assign(iconWrapper.style, {
                minWidth: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#10240a',
                borderRadius: '8px',
                border: '1px solid #1a4d0d'
            });

            const img = document.createElement('img');
            img.src = addon.icon;
            Object.assign(img.style, {
                width: '24px',
                height: '24px',
                objectFit: 'contain'
            });
            iconWrapper.appendChild(img);

            const text = document.createElement('div');
            text.style.flex = '1';
            text.innerHTML = `
            <div style="font-size:14px;font-weight:600;color:#e0e0e0;margin-bottom:3px;">${addon.title}</div>
            <div style="color:#a0a0a0;font-size:11px;line-height:1.3;">${addon.desc}</div>`;

            if (addon.settings) {
                text.appendChild(this.createSettingsButton(addon.settings));
            }

            block.appendChild(iconWrapper);
            block.appendChild(text);

            return block;
        },

        createToggleSwitch(addon) {
            const wrapper = document.createElement('div');
            Object.assign(wrapper.style, {
                marginTop: '8px',
                marginBottom: '4px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            });

            const label = document.createElement('label');
            label.style.cssText = 'position:relative;display:inline-block;width:48px;height:24px;';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = GM_getValue(addon.id, addon.default);
            input.style.cssText = 'opacity:0;width:0;height:0;';

            const slider = document.createElement('span');
            Object.assign(slider.style, {
                position: 'absolute',
                cursor: 'pointer',
                top: '0',
                left: '0',
                right: '0',
                bottom: '0',
                background: '#1a4d0d',
                transition: 'all .3s ease',
                borderRadius: '24px',
                border: '1px solid #2d7a1a'
            });

            const circle = document.createElement('span');
            Object.assign(circle.style, {
                position: 'absolute',
                height: '18px',
                width: '18px',
                left: '3px',
                bottom: '2px',
                background: '#fff',
                transition: 'all .3s ease',
                borderRadius: '50%',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            });

            slider.appendChild(circle);
            label.appendChild(input);
            label.appendChild(slider);
            wrapper.appendChild(label);

            input.addEventListener('change', () => {
                slider.style.backgroundColor = input.checked ? '#4CAF50' : '#1a4d0d';
                slider.style.borderColor = input.checked ? '#66bb6a' : '#2d7a1a';
                circle.style.transform = input.checked ? 'translateX(24px)' : 'translateX(0)';
                circle.style.boxShadow = input.checked ?
                    '0 2px 6px rgba(76,175,80,0.5)' : '0 2px 4px rgba(0,0,0,0.3)';
                addon.onToggle(input.checked);
                HotKeys.toggle(GM_getValue('hotKeysEnabled'));
            });

            setTimeout(() => input.dispatchEvent(new Event('change')), 0);
            return wrapper;
        },

        createSeparator() {
            const separator = document.createElement('div');
            Object.assign(separator.style, {
                margin: '12px 0',
                height: '1px',
                background: '#1a4d0d'
            });
            return separator;
        },

        createSettingsButton(settings) {
            const icon = document.createElement('span');
            icon.textContent = '⚙️';
            Object.assign(icon.style, {
                marginLeft: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                display: 'inline-block',
                transition: 'transform 0.2s ease',
                opacity: '0.7'
            });

            icon.addEventListener('mouseenter', () => {
                icon.style.transform = 'rotate(90deg)';
                icon.style.opacity = '1';
            });
            icon.addEventListener('mouseleave', () => {
                icon.style.transform = 'rotate(0deg)';
                icon.style.opacity = '0.7';
            });
            icon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!document.getElementById('settings-popup')) {
                    this.createSettingsPopup(settings);
                }
            });

            return icon;
        },

        createSettingsPopup(settings) {
            const popup = document.createElement('div');
            popup.id = 'settings-popup';
            Object.assign(popup.style, {
                position: 'fixed',
                padding: '15px',
                borderRadius: '12px',
                border: '2px solid #1a4d0d',
                boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
                zIndex: '10002',
                color: 'white',
                fontSize: '13px',
                width: '340px',
                cursor: 'grab',
                background: '#0b2505',
                fontFamily: 'times-new-roman'
            });

            // Wycentruj popup
            popup.style.top = '50%';
            popup.style.left = '50%';
            popup.style.transform = 'translate(-50%, -50%)';

            const title = document.createElement('div');
            title.textContent = '⚙️ Ustawienia';
            Object.assign(title.style, {
                fontWeight: 'bold',
                fontSize: '16px',
                marginBottom: '12px',
                paddingBottom: '10px',
                borderBottom: '1px solid #1a4d0d',
                userSelect: 'none'
            });
            popup.appendChild(title);

            const scrollContainer = document.createElement('div');
            Object.assign(scrollContainer.style, {
                maxHeight: '400px',
                overflowY: 'auto',
                paddingRight: '4px',
                scrollbarWidth: 'thin',
                scrollbarColor: '#1a4d0d #061d02'
            });

            settings.forEach(setting => {
                scrollContainer.appendChild(this.createSettingControl(setting));
            });

            popup.appendChild(scrollContainer);

            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Zapisz i zamknij';
            Object.assign(closeBtn.style, {
                marginTop: '12px',
                background: '#4CAF50',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                color: 'white',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'block',
                width: '100%',
                fontSize: '13px',
                transition: 'all 0.2s ease',
                fontFamily: 'times-new-roman'
            });

            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.background = '#66bb6a';
                closeBtn.style.transform = 'translateY(-2px)';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.background = '#4CAF50';
                closeBtn.style.transform = 'translateY(0)';
            });
            closeBtn.addEventListener('click', () => {
                Highlights.addStyles();
                popup.remove();
            });

            popup.appendChild(closeBtn);
            document.body.appendChild(popup);

            this.makeDraggablePopup(popup);
        },

        createSettingControl(setting) {
            const wrapper = document.createElement('div');
            Object.assign(wrapper.style, {
                marginBottom: '12px',
                padding: '10px',
                background: '#061d02',
                borderRadius: '8px',
                border: '1px solid #1a4d0d'
            });

            const value = GM_getValue(setting.key, setting.default);
            const labelEl = document.createElement('label');
            labelEl.textContent = setting.label;
            Object.assign(labelEl.style, {
                display: 'block',
                marginBottom: '6px',
                fontWeight: '600',
                fontSize: '12px',
                color: '#e0e0e0'
            });

            if (setting.type === 'text') {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = value;
                Object.assign(input.style, {
                    width: 'calc(100% - 24px)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #1a4d0d',
                    background: '#10240a',
                    color: 'white',
                    fontSize: '12px',
                    fontFamily: 'times-new-roman',
                    transition: 'all 0.2s ease'
                });
                input.addEventListener('focus', () => {
                    input.style.borderColor = '#4CAF50';
                    input.style.background = '#0a2505';
                });
                input.addEventListener('blur', () => {
                    input.style.borderColor = '#1a4d0d';
                    input.style.background = '#10240a';
                });
                input.addEventListener('change', () => GM_setValue(setting.key, input.value));
                wrapper.appendChild(labelEl);
                wrapper.appendChild(input);
            }

            if (setting.type === 'button') {
                const button = document.createElement('button');
                button.textContent = setting.buttonText || 'Kliknij';
                Object.assign(button.style, {
                    width: '100%',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    border: '1px solid #1a4d0d',
                    background: '#10240a',
                    color: 'white',
                    fontSize: '13px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    fontFamily: 'times-new-roman'
                });

                button.addEventListener('mouseenter', () => {
                    button.style.background = '#0a2505';
                    button.style.borderColor = '#4CAF50';
                    button.style.transform = 'translateY(-2px)';
                });

                button.addEventListener('mouseleave', () => {
                    button.style.background = '#10240a';
                    button.style.borderColor = '#1a4d0d';
                    button.style.transform = 'translateY(0)';
                });

                button.addEventListener('click', () => {
                    if (setting.action) setting.action();
                });

                wrapper.appendChild(button);
            }

            if (setting.type === 'checkbox') {
                const checkWrapper = document.createElement('div');
                Object.assign(checkWrapper.style, {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                });

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = value;
                Object.assign(input.style, {
                    width: '16px',
                    height: '16px',
                    cursor: 'pointer',
                    accentColor: '#4CAF50'
                });
                input.addEventListener('change', () => GM_setValue(setting.key, input.checked));

                checkWrapper.appendChild(labelEl);
                checkWrapper.appendChild(input);
                wrapper.appendChild(checkWrapper);
            }

            if (setting.type === 'number') {
                const input = document.createElement('input');
                input.type = 'number';
                input.value = value;
                Object.assign(input.style, {
                    width: 'calc(100% - 24px)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #1a4d0d',
                    background: '#10240a',
                    color: 'white',
                    fontSize: '12px',
                    fontFamily: 'times-new-roman',
                    transition: 'all 0.2s ease'
                });
                input.addEventListener('focus', () => {
                    input.style.borderColor = '#4CAF50';
                    input.style.background = '#0a2505';
                });
                input.addEventListener('blur', () => {
                    input.style.borderColor = '#1a4d0d';
                    input.style.background = '#10240a';
                });
                input.addEventListener('change', () => GM_setValue(setting.key, parseInt(input.value)));
                wrapper.appendChild(labelEl);
                wrapper.appendChild(input);
            }

            if (setting.type === 'color') {
                const input = document.createElement('input');
                input.type = 'color';
                input.value = value;
                Object.assign(input.style, {
                    width: '100%',
                    height: '36px',
                    borderRadius: '6px',
                    border: '1px solid #1a4d0d',
                    background: 'transparent',
                    cursor: 'pointer'
                });
                input.addEventListener('input', () => {
                    GM_setValue(setting.key, input.value);
                    Highlights.addStyles();
                });
                wrapper.appendChild(labelEl);
                wrapper.appendChild(input);
            }

            return wrapper;
        },

        createToggleButton() {
            if (document.getElementById('addon-panel-toggle')) return;

            const btn = document.createElement('div');
            btn.id = 'addon-panel-toggle';
            Object.assign(btn.style, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '48px',
                height: '48px',
                cursor: 'pointer',
                position: 'fixed',
                right: '20px',
                top: '20px',
                borderRadius: '12px',
                background: '#061d02',
                border: '2px solid #1a4d0d',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                zIndex: '9999'
            });

            const img = document.createElement('img');
            img.src = CONFIG.ICONS.DEFAULT;
            Object.assign(img.style, {
                width: '28px',
                height: '28px',
                transition: 'all 0.3s ease'
            });
            btn.appendChild(img);

            btn.addEventListener('mouseenter', () => {
                img.src = CONFIG.ICONS.HOVER;
                btn.style.background = '#0a2505';
                btn.style.borderColor = '#4CAF50';
                btn.style.transform = 'translateY(-4px)';
                btn.style.boxShadow = '0 6px 16px rgba(76,175,80,0.4)';
            });
            btn.addEventListener('mouseleave', () => {
                img.src = CONFIG.ICONS.DEFAULT;
                btn.style.background = '#061d02';
                btn.style.borderColor = '#1a4d0d';
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
            });
            btn.addEventListener('click', () => {
                const panel = document.getElementById('addon-panel');
                if (panel) {
                    panel.remove();
                } else {
                    this.createPanel();
                }
            });

            document.body.appendChild(btn);
        },

        makeDraggable(el) {
            let isDragging = false;
            let startX, startY;
            let initialLeft, initialTop;

            const header = el.querySelector('div'); // header element

            header.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'BUTTON' ||
                    e.target.tagName === 'INPUT' ||
                    e.target.closest('button') ||
                    e.target.closest('input')) return;

                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;

                // Usuń transform i pobierz aktualne pozycje
                const rect = el.getBoundingClientRect();
                el.style.transform = 'none';
                el.style.left = rect.left + 'px';
                el.style.top = rect.top + 'px';

                initialLeft = rect.left;
                initialTop = rect.top;

                header.style.cursor = 'grabbing';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;

                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                el.style.left = (initialLeft + deltaX) + 'px';
                el.style.top = (initialTop + deltaY) + 'px';
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    header.style.cursor = 'grab';

                    // Zapisz pozycję dla głównego panelu
                    if (el.id === 'addon-panel') {
                        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
                            top: parseInt(el.style.top),
                            left: parseInt(el.style.left)
                        }));
                    }
                }
            });
        },

        makeDraggablePopup(el) {
            let isDragging = false;
            let startX, startY;
            let initialLeft, initialTop;

            const header = el.querySelector('div'); // header element

            header.addEventListener('mousedown', (e) => {
                if (e.target.tagName === 'BUTTON' ||
                    e.target.tagName === 'INPUT' ||
                    e.target.closest('button') ||
                    e.target.closest('input')) return;

                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;

                // Usuń transform i pobierz aktualne pozycje
                const rect = el.getBoundingClientRect();
                el.style.transform = 'none';
                el.style.left = rect.left + 'px';
                el.style.top = rect.top + 'px';

                initialLeft = rect.left;
                initialTop = rect.top;

                el.style.cursor = 'grabbing';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;

                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;

                el.style.left = (initialLeft + deltaX) + 'px';
                el.style.top = (initialTop + deltaY) + 'px';
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    el.style.cursor = 'grab';
                }
            });
        }
    };

    // ======================== GLOBAL STYLES ========================

    const GlobalStyles = document.createElement('style');
    GlobalStyles.innerHTML = `
        * { outline: none !important; }
        *:focus { outline: none !important; }
        @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, -45%) scale(0.95); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        #addon-panel ::-webkit-scrollbar {
           width: 8px;
        }
        #addon-panel ::-webkit-scrollbar-track {
           background: #061d02;
           border-radius: 4px;
        }
        #addon-panel ::-webkit-scrollbar-thumb {
                background: #1a4d0d;
                border-radius: 4px;
        }
        #addon-panel ::-webkit-scrollbar-thumb:hover {
                background: #2d7a1a;
        }
        #character-switcher-panel:active {
        cursor: grabbing !important;
    }

    #character-switcher-panel > div img {
        transition: transform 0.2s ease;
    }

    #character-switcher-panel > div:hover img {
        transform: scale(1.1);
    }
        #addon-panel ::-webkit-scrollbar-thumb:hover {
            background: linear-gradient(135deg, #388e3c 0%, #66bb6a 100%);
        }`;
    document.head.appendChild(GlobalStyles);


    // ======================== INICJALIZACJA ========================
    window.addEventListener('load', () => {
        HotKeys.init();
        Minutnik.init();
        KillCounter.init();
        AutoSeller.init();
        const observer = new MutationObserver((mutations, obs) => {
            const container = document.querySelector('#panel .small-buttons');
            if (container) {
                PanelUI.createToggleButton();
                obs.disconnect();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        ADDONS.forEach(addon => addon.onToggle(GM_getValue(addon.id, addon.default)));
        HeroDetector.checkForHeroes();
    });
})();
