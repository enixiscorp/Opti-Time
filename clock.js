// Horloge animée comme logo
(function() {
    let clockInterval = null;
    
    function createClock() {
        const clockContainer = document.getElementById('clockLogo');
        if (!clockContainer) return;
        
        // Vérifier si l'horloge existe déjà pour éviter les doublons
        if (clockContainer.querySelector('.animated-clock')) {
            return;
        }
        
        const clock = document.createElement('div');
        clock.className = 'animated-clock';
        clock.innerHTML = `
            <div class="clock-face">
                <div class="clock-center"></div>
                <div class="clock-hand hour-hand"></div>
                <div class="clock-hand minute-hand"></div>
                <div class="clock-hand second-hand"></div>
                <div class="clock-numbers">
                    <span class="number" style="--i: 1">12</span>
                    <span class="number" style="--i: 2">3</span>
                    <span class="number" style="--i: 3">6</span>
                    <span class="number" style="--i: 4">9</span>
                </div>
            </div>
        `;
        
        clockContainer.appendChild(clock);
        updateClock();
        
        // Mettre à jour toutes les secondes
        clockInterval = setInterval(updateClock, 1000);
        
        // Son de résonance unique à l'ouverture
        const hasPlayed = sessionStorage.getItem('optitime-clock-sound-played');
        if (!hasPlayed) {
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                // Créer une mélodie de résonance agréable (une seule fois)
                const playWelcomeSound = () => {
                    const notes = [
                        { freq: 523.25, time: 0 },    // C5
                        { freq: 659.25, time: 0.2 },  // E5
                        { freq: 783.99, time: 0.4 },  // G5
                        { freq: 1046.50, time: 0.6 }  // C6
                    ];
                    
                    notes.forEach(note => {
                        setTimeout(() => {
                            const oscillator = audioContext.createOscillator();
                            const gainNode = audioContext.createGain();
                            
                            oscillator.connect(gainNode);
                            gainNode.connect(audioContext.destination);
                            
                            oscillator.frequency.value = note.freq;
                            oscillator.type = 'sine';
                            
                            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
                            
                            oscillator.start(audioContext.currentTime);
                            oscillator.stop(audioContext.currentTime + 0.3);
                        }, note.time * 1000);
                    });
                    
                    // Marquer comme joué pour cette session
                    sessionStorage.setItem('optitime-clock-sound-played', 'true');
                };
                
                // Jouer après un court délai pour permettre l'interaction utilisateur
                setTimeout(playWelcomeSound, 500);
            } catch (e) {
                console.log('Audio non disponible');
            }
        }
    }
    
    function updateClock() {
        const now = new Date();
        const hours = now.getHours() % 12;
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        
        const hourHand = document.querySelector('.hour-hand');
        const minuteHand = document.querySelector('.minute-hand');
        const secondHand = document.querySelector('.second-hand');
        
        if (hourHand) {
            const hourAngle = (hours * 30) + (minutes * 0.5);
            hourHand.style.transform = `rotate(${hourAngle}deg)`;
        }
        
        if (minuteHand) {
            const minuteAngle = minutes * 6;
            minuteHand.style.transform = `rotate(${minuteAngle}deg)`;
        }
        
        if (secondHand) {
            const secondAngle = seconds * 6;
            secondHand.style.transform = `rotate(${secondAngle}deg)`;
        }
    }
    
    // Initialiser l'horloge
    function initClock() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createClock);
        } else {
            createClock();
        }
    }
    
    // Exposer la fonction
    window.clockManager = {
        init: initClock,
        update: updateClock
    };
    
    initClock();
})();

