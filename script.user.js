// ======================== KONFIGURACJA ========================
    const CONFIG = {
        ICONS: {
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
                    'https://i.imgur.com/PN7M0jC.png'
                ],
                ON: [
                    'https://i.imgur.com/aLIJ57i.png',
                    'https://i.imgur.com/aBjx3l2.png',
                    'https://i.imgur.com/tdLexLS.png',
                    'https://i.imgur.com/24X6V19.png',
                    'https://i.imgur.com/F9MmVRl.png',
                    'https://i.imgur.com/RIYmqMj.png',
                    'https://i.imgur.com/9GQvZe3.png'
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
        }
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

    // ======================== AUTO BATTLE (CLOSE FIGHT) ========================
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
                Utils.simulateKeyPress('f', 'KeyF', 70);
            }

            if (autoClose) {
                const winElem = document.querySelector('.win');
                const victoryTextFound = Array.from(document.querySelectorAll('*'))
                .some(el => el.textContent?.trim().toLowerCase().startsWith('zwyciężył:'));

                if (winElem || victoryTextFound) {
                    if (GM_getValue('minutnikEnabled', false)) {
                        Minutnik.recognizeNpc();
                    }
                    Utils.simulateKeyPress('z', 'KeyZ', 90);
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
                    MessageCanvas.show('Błąd', `Nie udało się pobrać postaci (${res.status})`, '#ff0000');
                    return;
                }

                this.characters = await res.json();

                if (!Array.isArray(this.characters) || this.characters.length === 0) {
                    console.warn('[CharacterSwitcher] Brak postaci do wyświetlenia');
                    MessageCanvas.show('Info', 'Brak postaci do wyświetlenia', '#ffa500');
                    return;
                }

                this.createPanel();
            } catch (err) {
                console.error('[CharacterSwitcher] Błąd przy pobieraniu postaci:', err);
                MessageCanvas.show('Błąd', 'Błąd przy pobieraniu postaci', '#ff0000');
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
                flexWrap: 'wrap',
                cursor: 'grab',
                boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                border: '1px solid rgba(76,175,80,0.3)',
                backdropFilter: 'blur(10px)',
                maxWidth: '600px',
                gap: '6px'
            });

            const savedPos = JSON.parse(localStorage.getItem('margatronPanelPos') || 'null');
            if (savedPos) {
                this.panel.style.top = savedPos.top + 'px';
                this.panel.style.left = savedPos.left + 'px';
            }

            this.makeDraggable(this.panel);
            this.renderCharacters();
            document.body.appendChild(this.panel);
        },

        renderCharacters() {
            this.panel.innerHTML = '';

            this.characters.forEach(character => {
                const container = document.createElement('div');
                Object.assign(container.style, {
                    width: '50px',
                    padding: '6px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    borderRadius: '8px',
                    background: 'rgba(6,29,2,0.03)',
                    border: '1px solid #1a4d0d',
                    transition: 'all 0.2s ease',
                    position: 'relative'
                });

                if (this.currentCharacterId === character.id) {
                    container.style.boxShadow = '0 0 12px rgba(76,175,80,0.5)';
                }

                const imgWrapper = document.createElement('div');
                Object.assign(imgWrapper.style, {
                    width: '32px',
                    height: '32px',
                    overflow: 'hidden',
                    borderRadius: '6px',
                    margin: '0 auto 4px'
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

                const nickname = document.createElement('span');
                nickname.textContent = character.name;
                Object.assign(nickname.style, {
                    display: 'block',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    color: '#fff',
                    fontWeight: '600',
                    textShadow: '0 1px 3px rgba(0,0,0,0.8)'
                });

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

                Object.assign(container.style, {
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    height: '72px',
                    width: '48px'
                });

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
                this.panel.appendChild(container);
            });
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
                    MessageCanvas.show('Błąd', `Nie udało się przełączyć (${joinRes.status})`, '#ff0000');
                    return;
                }

                const joinData = await joinRes.json();

                if (joinRes.ok && joinData) {
                    MessageCanvas.show(character.name, "Przełączono na: ", '#4CAF50');
                    setTimeout(() => {
                        window.location.href = 'https://world-retro.margatron.ovh/';
                    }, 500);
                } else {
                    MessageCanvas.show('Błąd', `Nie udało się przełączyć: ${joinData?.message || 'Nieznany błąd'}`, '#ff0000');
                }
            } catch (err) {
                console.error('[CharacterSwitcher]', err);
                MessageCanvas.show('Błąd', 'Błąd przy przełączaniu postaci', '#ff0000');
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

    // ======================== HOT KEYS ========================
    const HotKeys = {
        toggles: [
            { id: 'hotkeys-autofight', var: 'autofight', idx: 1, gmKey: 'autoFightEnabled', addon: 'autoBattleEnabled' },
            { id: 'hotkeys-autoclose', var: 'autoclose', idx: 0, gmKey: 'autoCloseEnabled', addon: 'autoBattleEnabled' },
            { id: 'hotkeys-autoheal', var: 'autoheal', idx: 2, gmKey: 'autoHealingEnabled', addon: 'autoHealEnabled' },
            { id: 'hotkeys-goldeater', var: 'goldeater', idx: 3, gmKey: 'eatGold', addon: 'autoGoldEnabled' },
            { id: 'hotkeys-disablemessage', var: 'disablemessage', idx: 4, gmKey: 'disableMessages', addon: 'hotKeysEnabled' },
            { id: 'hotkeys-lootfilter', var: 'lootfilter', idx: 5, gmKey: 'lootFilterDisable', addon: 'autoLootEnabled' },
            { id: 'hotkeys-agressive', var: 'agressive', idx: 6, gmKey: 'autoAgressiveDisable', addon: 'autoAgressiveEnabled' }
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

            this.toggles.forEach(({ id, var: toggleVar, idx, gmKey, addon }) => {
                if (!GM_getValue(addon, true)) return;

                const btn = this.createButton(id, toggleVar, idx, gmKey);
                container.appendChild(btn);
            });
        },

        remove(container) {
            this.toggles.forEach(({ id }) => {
                container.querySelector(`#${id}`)?.remove();
            });
        },

        createButton(id, toggleVar, iconIdx, gmKey) {
            const btn = document.createElement('div');
            btn.id = id;

            const isActive = window[toggleVar];
            Object.assign(btn.style, {
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '28px', height: '28px', cursor: 'pointer', margin: '0 4px',
                position: 'relative', left: '102%', userSelect: 'none',
                borderRadius: '4px', transition: 'all 0.2s ease',
                backgroundColor: isActive ? 'rgba(76, 175, 80, 0.15)' : 'transparent',
                border: isActive ? '1px solid rgba(76, 175, 80, 0.4)' : '1px solid transparent'
            });

            const img = document.createElement('img');
            img.src = isActive ? CONFIG.ICONS.HOTKEYS.ON[iconIdx] : CONFIG.ICONS.HOTKEYS.OFF[iconIdx];
            Object.assign(img.style, {
                width: '22px', height: '22px', transition: 'all 0.2s ease',
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
            { name: 'Zjawa Pustej Maski', lvl: '43', rank: 'ELITE_II' }
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
            removeBtn.textContent = '×';
            Object.assign(removeBtn.style, {
                background: 'rgba(255,0,0,0.2)', color: '#ff6666',
                border: '1px solid #ff0000', cursor: 'pointer',
                fontWeight: 'bold', fontSize: '16px', width: '16px', height: '16px',
                borderRadius: '4px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', transition: 'all 0.2s ease', flexShrink: '0'
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
        minimapObserver: null,
        domObserver: null,

        heroes: {
            'https://imgur.com/HTrYHtQ': { name: 'Opętany Paladyn', level: '85' },
            'https://imgur.com/hexZLez': { name: 'Mroczny Patryk', level: '35' },
            'https://imgur.com/qXHiy9S': { name: 'Domina Ecclesiae', level: '21' },
            'https://imgur.com/ewebWix': { name: 'Mietek Żul', level: '25' },
            'https://imgur.com/Qie2uT3': { name: 'Karmazynowy Mściciel', level: '45' },
            'https://imgur.com/D0iJz3a': { name: 'Złodziej', level: '50' },
            'https://imgur.com/eMzGapH': { name: 'Zły Przewodnik', level: '63' },
            'https://imgur.com/0WDZpm5': { name: 'Piekielny Kościej', level: '74' },
            'https://imgur.com/skOpwUb': { name: 'Kochanka Nocy', level: '100' },
            'https://imgur.com/RW3D9gW': { name: 'Perski Książę', level: '116' },
            'https://imgur.com/wvM31UN': { name: 'Baca Bez Łowiec', level: '123' },
            'https://imgur.com/FKmlDR4': { name: 'Czarująca Atalia', level: '157' },
            'https://imgur.com/Dm5OJfY': { name: 'Obłąkany łowca orków', level: '144' },
            'https://imgur.com/m1Vg4xt': { name: 'Święty braciszek', level: '165' },
            'https://imgur.com/MDqi6EC': { name: 'Viviana Nandin', level: '184' },
            'https://imgur.com/6rDwQMJ': { name: 'Demonis Pan Nicości', level: '210' },
            'https://imgur.com/LNt1IAy': { name: 'Tepeyollotl', level: '260' },
            'https://imgur.com/uyrpl8D': { name: 'Biała Dama', level: '40' }
        },

        titans: {
            'https://imgur.com/c69CflD': { name: 'Dziewicza Orlica', level: '51' },
            'https://imgur.com/oMwJcwU': { name: 'Zabójczy królik', level: '70' },
            'https://imgur.com/UrdUfAI': { name: 'Renegat Baulus', level: '101' },
            'https://imgur.com/ynYQXGx': { name: 'Piekielny Arcymag', level: '131' },
            'https://imgur.com/SgXGVN8': { name: 'Versus Zoons', level: '154' },
            'https://imgur.com/LhRANCD': { name: 'Łowczyni Wspomnień', level: '177' },
            'https://imgur.com/HWfQswl': { name: 'Przyzywacz demonów', level: '204' },
            'https://imgur.com/AIapXWH': { name: 'Maddok Magua', level: '231' },
            'https://imgur.com/UNWuaEn': { name: 'Tezcatlipoca', level: '258' },
            'https://imgur.com/Hz6VI9K': { name: 'Tanroth', level: '285' }
        },

        toggle(enabled) {
            GM_setValue('heroDetectorEnabled', enabled);
            if (enabled) {
                this.waitForMinimap();
            } else {
                this.stopMinimapObserver();
                this.stopDomObserver();
            }
        },

        waitForMinimap() {
            if (document.querySelector('.minimap-container')) {
                this.startMinimapObserver();
                return;
            }

            if (this.domObserver) return;

            this.domObserver = new MutationObserver(() => {
                if (document.querySelector('.minimap-container')) {
                    this.startMinimapObserver();
                    this.stopDomObserver();
                }
            });

            this.domObserver.observe(document.body, { childList: true, subtree: true });
        },

        stopDomObserver() {
            if (this.domObserver) {
                this.domObserver.disconnect();
                this.domObserver = null;
            }
        },

        startMinimapObserver() {
            if (this.minimapObserver) return;

            const minimapContainer = document.querySelector('.minimap-container');
            if (!minimapContainer) return;

            this.minimapObserver = new MutationObserver(() => {
                if (minimapContainer.offsetParent !== null) {
                    setTimeout(() => this.scanMinimap(), 200);
                }
            });

            this.minimapObserver.observe(minimapContainer, {
                attributes: true,
                attributeFilter: ['style', 'class'],
                childList: true,
                subtree: true
            });
        },

        stopMinimapObserver() {
            if (this.minimapObserver) {
                this.minimapObserver.disconnect();
                this.minimapObserver = null;
            }
        },

        scanMinimap() {
            const heroMarkers = document.querySelectorAll('.minimap-container .npc-marker.heros');
            const titanMarkers = document.querySelectorAll('.minimap-container .npc-marker.titan');

            let foundEntities = [];

            heroMarkers.forEach(marker => {
                try {
                    const npcData = JSON.parse(marker.getAttribute('data-npc'));
                    const name = npcData?.schema?.inner?.name;
                    const level = npcData?.schema?.inner?.lvl || '??';
                    const img = npcData?.schema?.inner?.img;

                    if (name && !this.detectedHeroes.has(name)) {
                        this.detectedHeroes.add(name);
                        foundEntities.push({ name, level, type: 'hero', img });
                    }
                } catch (err) {
                    console.warn('[HeroDetector] Błąd parsowania herosa:', err);
                }
            });

            titanMarkers.forEach(marker => {
                try {
                    const npcData = JSON.parse(marker.getAttribute('data-npc'));
                    const name = npcData?.schema?.inner?.name;
                    const level = npcData?.schema?.inner?.lvl || '??';
                    const img = npcData?.schema?.inner?.img;

                    if (name && !this.detectedTitans.has(name)) {
                        this.detectedTitans.add(name);
                        foundEntities.push({ name, level, type: 'titan', img });
                    }
                } catch (err) {
                    console.warn('[HeroDetector] Błąd parsowania tytana:', err);
                }
            });

            if (foundEntities.length > 0 && !this.alertDisplayed) {
                this.showAlert(foundEntities);
            }
        },

        getNpcImage(name, type) {
            const npcTypeArray = type === 'titan' ? this.titans : this.heroes;
            const foundKey = Object.keys(npcTypeArray).find(key =>
                                                            npcTypeArray[key].name.trim() === name.trim()
                                                           );
            return foundKey ? `${foundKey}.gif` : 'https://imgur.com/cUQtW6E.png';
        },

        showAlert(entities) {
            if (this.alertDisplayed || entities.length === 0) return;
            this.alertDisplayed = true;

            const alertDiv = document.createElement('div');
            Object.assign(alertDiv.style, {
                position: 'fixed', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)', background: '#081d03',
                color: 'white', padding: '20px', borderRadius: '10px',
                textAlign: 'center', zIndex: '9999',
                boxShadow: '0 0 15px 3px white', opacity: '0.95', maxWidth: '80vw'
            });

            const audioUrl = GM_getValue('audioUrl', 'https://files.catbox.moe/j6siq2.mp3');
            Utils.playAudio(audioUrl);

            const hasHeroes = entities.some(e => e.type === 'hero');
            const hasTitans = entities.some(e => e.type === 'titan');

            let title = '';
            if (hasHeroes && hasTitans) title = 'Znaleziono Herosów i Tytanów!';
            else if (hasHeroes) title = `Znaleziono ${entities.length > 1 ? 'Herosów' : 'Herosa'}!`;
            else title = `Znaleziono ${entities.length > 1 ? 'Tytanów' : 'Tytana'}!`;

            let innerHTML = `<p><strong>${title}</strong></p>`;
            innerHTML += `<div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 20px; margin-top: 15px;">`;

            entities.forEach(({ name, level, type }) => {
                const typeColor = type === 'titan' ? '#ff6c00' : '#ffc600';
                const typeName = type === 'titan' ? 'Tytan' : 'Heros';
                const imageUrl = this.getNpcImage(name, type);

                innerHTML += `
                <div style="width: 120px; text-align: center; color: white;">
                    <div style="margin-top: 8px; font-size: 14px; line-height: 1.2;">
                        ${name} <br>
                        <span style="color: ${typeColor};">${typeName}</span> ${level} lvl
                    </div>
                    <div style="width: 100%; height: 82px; display: flex; align-items: center; justify-content: center; background: #10240a; border-radius: 8px; margin-top: 8px;">
                        <img src="${imageUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />
                    </div>
                </div>`;
            });

            innerHTML += `</div>`;
            innerHTML += `<button id="closeHeroAlert" style="margin-top: 10px; padding: 5px 10px; background: #444; color: white; border: none; border-radius: 5px; cursor: pointer;">Zamknij</button>`;
            alertDiv.innerHTML = innerHTML;
            document.body.appendChild(alertDiv);

            document.getElementById('closeHeroAlert').onclick = () => {
                alertDiv.remove();
                this.alertDisplayed = false;
            };

            setTimeout(() => {
                if (alertDiv.parentNode) {
                    alertDiv.remove();
                    this.alertDisplayed = false;
                }
            }, 10000);
        }
    };

    document.addEventListener('keydown', (e) => {
        if (!GM_getValue('heroDetectorEnabled', true)) return;
        if (e.key.toLowerCase() === 'r') {
            HeroDetector.waitForMinimap();
            setTimeout(() => HeroDetector.scanMinimap(), 300);
        }
    });

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
                    setTimeout(() => item.classList.remove('notify-active'), 7000);
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
                            setTimeout(() => item.classList.remove('notify-active'), 7000);
                            setTimeout(() => el.classList.remove('glow-legendary-loot'), 7000);
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
        { id: 'minutnikEnabled', default: false, icon: 'https://i.imgur.com/Odc6ClZ.gif',
         title: 'Minutnik', desc: 'Odlicza czas do pojawienia się ElityII lub Elity',
         onToggle: (e) => Minutnik.toggle(e),
         settings: [
             { key: 'audioUrlMinutnik', label: 'Link do dźwięku', type: 'text', default: 'https://files.catbox.moe/od2lcz.mp3' }
         ]},
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
        createPanel() {
            if (document.getElementById('addon-panel')) return;

            const panel = document.createElement('div');
            panel.id = 'addon-panel';
            Object.assign(panel.style, {
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: '420px', background: 'linear-gradient(135deg, #0a1f0a 0%, #0e2a0e 100%)',
                color: '#fff', zIndex: '10000', border: '1px solid rgba(76, 175, 80, 0.3)',
                borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
                display: 'flex', flexDirection: 'column', backdropFilter: 'blur(10px)', overflow: 'hidden'
            });

            const header = this.createHeader(panel);
            const content = this.createContent();

            panel.appendChild(header);
            panel.appendChild(content);
            document.body.appendChild(panel);
        },

        createHeader(panel) {
            const header = document.createElement('div');
            header.innerHTML = `
                <div style="display:flex;align-items:center;gap:10px;">
                    <img src="${CONFIG.ICONS.DEFAULT}" style="width:24px;height:24px;filter:drop-shadow(0 2px 4px rgba(76,175,80,0.5));">
                    <span style="background:linear-gradient(135deg, #FFF 0%, #FFF 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-weight:700;">Panel Dodatków Margatron</span>
                </div>`;

            Object.assign(header.style, {
                position: 'relative', background: 'linear-gradient(135deg, rgba(6,29,2,0.9) 0%, rgba(14,42,14,0.9) 100%)',
                padding: '18px 20px', fontSize: '17px', fontWeight: 'bold', userSelect: 'none',
                borderBottom: '1px solid rgba(76,175,80,0.2)', backdropFilter: 'blur(10px)'
            });

            const closeBtn = this.createCloseButton(panel);
            header.appendChild(closeBtn);

            return header;
        },

        createCloseButton(panel) {
            const closeBtn = document.createElement('span');
            closeBtn.textContent = '✖';
            Object.assign(closeBtn.style, {
                position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)',
                cursor: 'pointer', fontSize: '18px', color: '#888', transition: 'all 0.2s ease',
                width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', borderRadius: '6px'
            });

            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.color = '#fff';
                closeBtn.style.background = 'rgba(255,255,255,0.1)';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.color = '#888';
                closeBtn.style.background = 'transparent';
            });
            closeBtn.addEventListener('click', () => {
                panel.style.borderColor = '#fff';
                setTimeout(() => {
                    panel.remove();
                    document.getElementById('settings-popup')?.remove();
                }, 200);
            });

            return closeBtn;
        },

        createContent() {
            const content = document.createElement('div');
            Object.assign(content.style, {
                padding: '20px', fontSize: '13px', maxHeight: '400px',
                overflowY: 'auto', overflowX: 'hidden'
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
                display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '12px',
                padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.05)', transition: 'all 0.3s ease'
            });

            block.addEventListener('mouseenter', () => {
                block.style.background = 'rgba(76,175,80,0.08)';
                block.style.borderColor = 'rgba(76,175,80,0.2)';
                block.style.transform = 'translateX(4px)';
            });
            block.addEventListener('mouseleave', () => {
                block.style.background = 'rgba(255,255,255,0.03)';
                block.style.borderColor = 'rgba(255,255,255,0.05)';
                block.style.transform = 'translateX(0)';
            });

            const iconWrapper = document.createElement('div');
            Object.assign(iconWrapper.style, {
                minWidth: '40px', height: '40px', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, rgba(76,175,80,0.15) 0%, rgba(76,175,80,0.05) 100%)',
                borderRadius: '10px', border: '1px solid rgba(76,175,80,0.2)',
                boxShadow: '0 2px 8px rgba(76,175,80,0.1)'
            });

            const img = document.createElement('img');
            img.src = addon.icon;
            Object.assign(img.style, { width: '28px', height: '28px' });
            iconWrapper.appendChild(img);

            const text = document.createElement('div');
            text.style.flex = '1';
            text.innerHTML = `
                <div style="font-size:14px;font-weight:600;color:#fff;margin-bottom:4px;">${addon.title}</div>
                <div style="color:#aaa;font-size:12px;line-height:1.4;">${addon.desc}</div>`;

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
                marginTop: '10px', display: 'flex',
                justifyContent: 'center', alignItems: 'center'
            });

            const label = document.createElement('label');
            label.style.cssText = 'position:relative;display:inline-block;width:50px;height:26px';

            const input = document.createElement('input');
            input.type = 'checkbox';
            input.checked = GM_getValue(addon.id, addon.default);
            input.style.cssText = 'opacity:0;width:0;height:0';

            const slider = document.createElement('span');
            Object.assign(slider.style, {
                position: 'absolute', cursor: 'pointer', top: '0', left: '0',
                right: '0', bottom: '0', background: '#444',
                transition: 'all .3s cubic-bezier(0.4, 0, 0.2, 1)',
                borderRadius: '34px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)'
            });

            const circle = document.createElement('span');
            Object.assign(circle.style, {
                position: 'absolute', height: '20px', width: '20px',
                left: '3px', bottom: '3px', background: 'white',
                transition: 'all .3s cubic-bezier(0.4, 0, 0.2, 1)',
                borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
            });

            slider.appendChild(circle);
            label.appendChild(input);
            label.appendChild(slider);
            wrapper.appendChild(label);

            input.addEventListener('change', () => {
                slider.style.backgroundColor = input.checked ? '#4CAF50' : '#444';
                circle.style.transform = input.checked ? 'translateX(24px)' : 'translateX(0)';
                circle.style.boxShadow = input.checked ?
                    '0 2px 8px rgba(76,175,80,0.4)' : '0 2px 4px rgba(0,0,0,0.3)';
                addon.onToggle(input.checked);
                HotKeys.toggle(GM_getValue('hotKeysEnabled'));
            });

            setTimeout(() => input.dispatchEvent(new Event('change')), 0);
            return wrapper;
        },

        createSeparator() {
            const separator = document.createElement('div');
            separator.style.cssText = `
                margin: 18px 0; height: 1px;
                background: linear-gradient(to right, rgba(76,175,80,0), rgba(76,175,80,0.3), rgba(76,175,80,0));`;
            return separator;
        },

        createSettingsButton(settings) {
            const icon = document.createElement('span');
            icon.textContent = '⚙️';
            Object.assign(icon.style, {
                marginLeft: '8px', cursor: 'pointer', fontSize: '16px',
                display: 'inline-block', transition: 'transform 0.3s ease',
                filter: 'grayscale(0.3)'
            });

            icon.addEventListener('mouseenter', () => {
                icon.style.transform = 'rotate(90deg)';
                icon.style.filter = 'grayscale(0)';
            });
            icon.addEventListener('mouseleave', () => {
                icon.style.transform = 'rotate(0deg)';
                icon.style.filter = 'grayscale(0.3)';
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
                position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                background: 'linear-gradient(135deg, #0e2a0e 0%, #1a3a1a 100%)',
                padding: '20px 24px', borderRadius: '16px',
                border: '1px solid rgba(76,175,80,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.7)', zIndex: '10001',
                color: 'white', fontSize: '13px', width: '320px',
                cursor: 'move', animation: 'fadeIn 0.2s ease'
            });

            const title = document.createElement('div');
            title.textContent = '⚙️ Ustawienia';
            Object.assign(title.style, {
                fontWeight: '700', fontSize: '16px', marginBottom: '16px',
                paddingBottom: '12px', borderBottom: '1px solid rgba(76,175,80,0.2)'
            });
            popup.appendChild(title);

            settings.forEach(setting => {
                popup.appendChild(this.createSettingControl(setting));
            });

            const closeBtn = document.createElement('button');
            closeBtn.textContent = 'Zapisz i zamknij';
            Object.assign(closeBtn.style, {
                marginTop: '16px', background: 'linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)',
                border: 'none', padding: '10px 20px', borderRadius: '8px',
                color: 'white', fontWeight: '600', cursor: 'pointer',
                display: 'block', width: '100%', fontSize: '14px',
                transition: 'all 0.2s ease', boxShadow: '0 2px 8px rgba(76,175,80,0.3)'
            });

            closeBtn.addEventListener('mouseenter', () => {
                closeBtn.style.transform = 'translateY(-2px)';
                closeBtn.style.boxShadow = '0 4px 12px rgba(76,175,80,0.4)';
            });
            closeBtn.addEventListener('mouseleave', () => {
                closeBtn.style.transform = 'translateY(0)';
                closeBtn.style.boxShadow = '0 2px 8px rgba(76,175,80,0.3)';
            });
            closeBtn.addEventListener('click', () => {
                Highlights.addStyles();
                setTimeout(() => popup.remove(), 200);
            });

            popup.appendChild(closeBtn);
            document.body.appendChild(popup);
        },

        createSettingControl(setting) {
            const wrapper = document.createElement('div');
            Object.assign(wrapper.style, {
                marginBottom: '14px', padding: '10px',
                background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.05)'
            });

            const value = GM_getValue(setting.key, setting.default);
            const labelEl = document.createElement('label');
            labelEl.textContent = setting.label;
            Object.assign(labelEl.style, {
                display: 'block', marginBottom: '6px', fontWeight: '500'
            });

            if (setting.type === 'text') {
                const input = document.createElement('input');
                input.type = 'text';
                input.value = value;
                Object.assign(input.style, {
                    width: '90%', padding: '12px 12px', borderRadius: '6px',
                    border: '1px solid rgba(76,175,80,0.3)',
                    background: 'rgba(0,0,0,0.3)', color: 'white',
                    fontSize: '13px', transition: 'all 0.2s ease'
                });
                input.addEventListener('focus', () => {
                    input.style.borderColor = '#4CAF50';
                    input.style.boxShadow = '0 0 0 3px rgba(76,175,80,0.1)';
                });
                input.addEventListener('blur', () => {
                    input.style.borderColor = 'rgba(76,175,80,0.3)';
                    input.style.boxShadow = 'none';
                });
                input.addEventListener('change', () => GM_setValue(setting.key, input.value));
                wrapper.appendChild(labelEl);
                wrapper.appendChild(input);
            }

            if (setting.type === 'checkbox') {
                const checkWrapper = document.createElement('div');
                Object.assign(checkWrapper.style, {
                    display: 'flex', alignItems: 'center', gap: '10px'
                });

                const input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = value;
                Object.assign(input.style, {
                    width: '18px', height: '18px', cursor: 'pointer', accentColor: '#4CAF50'
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
                    width: '90%', padding: '8px 12px', borderRadius: '6px',
                    border: '1px solid rgba(76,175,80,0.3)',
                    background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '13px'
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
                    width: '100%', height: '40px', borderRadius: '6px',
                    border: '1px solid rgba(76,175,80,0.3)',
                    background: 'transparent', cursor: 'pointer'
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
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '50px', height: '50px', cursor: 'pointer',
                position: 'fixed', right: '20px', top: '20px',
                borderRadius: '12px', background: 'rgba(76,175,80,0.1)',
                border: '1px solid rgba(76,175,80,0.2)',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: '9999'
            });

            const img = document.createElement('img');
            img.src = CONFIG.ICONS.DEFAULT;
            Object.assign(img.style, {
                width: '28px', height: '28px', transition: 'all 0.3s ease',
                filter: 'drop-shadow(0 2px 4px rgba(76,175,80,0.3))'
            });
            btn.appendChild(img);

            btn.addEventListener('mouseenter', () => {
                img.src = CONFIG.ICONS.HOVER;
                btn.style.background = 'rgba(76,175,80,0.2)';
                btn.style.transform = 'translateY(-4px)';
                btn.style.boxShadow = '0 6px 16px rgba(76,175,80,0.4)';
            });
            btn.addEventListener('mouseleave', () => {
                img.src = CONFIG.ICONS.DEFAULT;
                btn.style.background = 'rgba(76,175,80,0.1)';
                btn.style.transform = 'translateY(0)';
                btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            });
            btn.addEventListener('click', () => {
                const panel = document.getElementById('addon-panel');
                if (panel) {
                    setTimeout(() => panel.remove(), 200);
                } else {
                    this.createPanel();
                }
            });

            document.body.appendChild(btn);
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
        #addon-panel ::-webkit-scrollbar { width: 10px; }
        #addon-panel ::-webkit-scrollbar-track {
            background: rgba(6,29,2,0.5); border-radius: 10px; margin: 4px;
        }
        #addon-panel ::-webkit-scrollbar-thumb {
            background: linear-gradient(135deg, #2e7d32 0%, #4caf50 100%);
            border-radius: 10px; border: 2px solid rgba(6,29,2,0.5);
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
    });
